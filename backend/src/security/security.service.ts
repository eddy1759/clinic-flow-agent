import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class SecurityService {
  private readonly key: Buffer;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly SALT = 'c39f303aa3a4b27ec2540d4dfdffdc07';
  private readonly AUTH_TAG_LENGTH = 16;

  constructor(private config: ConfigService) {
    const secret =
      this.config.get<string>('ENCRYPTION_SECRET_KEY') ??
      this.config.get<string>('ENCRYTPION_SECRET_KEY');

    if (!secret) {
      throw new Error('ENCRYPTION_SECRET_KEY is required');
    }
    if (secret.length !== 32) {
      throw new Error('ENCRYPTION_SECRET_KEY must be exactly 32 characters');
    }

    this.key = crypto.scryptSync(secret, this.SALT, 32);
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipheriv(
        this.ALGORITHM,
        this.key,
        iv,
      ) as crypto.CipherGCM;

      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();
      return Buffer.concat([iv, authTag, encrypted]).toString('hex');
    } catch {
      throw new InternalServerErrorException('Failed to encrypt data.');
    }
  }

  decrypt(text: string): string {
    try {
      const data = Buffer.from(text, 'hex');
      if (data.length <= this.IV_LENGTH + this.AUTH_TAG_LENGTH) {
        throw new Error('Invalid encrypted payload');
      }
      const iv = data.subarray(0, this.IV_LENGTH);
      const authTag = data.subarray(
        this.IV_LENGTH,
        this.IV_LENGTH + this.AUTH_TAG_LENGTH,
      );

      const encrypted = data.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        this.key,
        iv,
      ) as crypto.DecipherGCM;

      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException('Failed to decrypt data.');
    }
  }

  hashPhone(phone: string): string {
    const normalized = phone.replace(/\D/g, '');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}
