import { SecurityService } from './security.service';

describe('SecurityService', () => {
  const secret = '12345678901234567890123456789012';

  function createService() {
    return new SecurityService({
      get: jest.fn((key: string) => key === 'ENCRYPTION_SECRET_KEY' ? secret : undefined),
    } as never);
  }

  it('encrypts and decrypts patient data', () => {
    const service = createService();
    const encrypted = service.encrypt('Ada Okafor');

    expect(encrypted).not.toContain('Ada Okafor');
    expect(service.decrypt(encrypted)).toBe('Ada Okafor');
  });

  it('normalizes a phone number before hashing', () => {
    const service = createService();
    expect(service.hashPhone('+234 800-123-4567')).toBe(service.hashPhone('2348001234567'));
  });

  it('rejects malformed encrypted payloads', () => {
    const service = createService();
    expect(() => service.decrypt('abcd')).toThrow('Failed to decrypt data.');
  });
});
