import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Options } from 'nodemailer/lib/smtp-transport';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT')),
      secure: true, // Port 465 requires secure: true
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
      tls: {
        rejectUnauthorized: false, // Fixes some local SSL certificate issues
      },
      family: 4, // Force IPv4
    } as Options);
  }

  async sendAppointmentConfirmation(
    to: string,
    name: string,
    rawDate: Date,
    time: string,
    service: string,
  ) {
    // 1. SAFETY: Ensure we have a valid Date object
    const dateObj = new Date(rawDate);

    const formattedDate = dateObj.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 2. Generate iCal Content (Robust Formatting)
    const startUTC =
      dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endObj = new Date(dateObj.getTime() + 60 * 60 * 1000); // +1 Hour
    const endUTC =
      endObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const now =
      new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // Remove any existing \r to prevent \r\r\n issues, then normalize to \r\n
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//City Health Clinic//Appointment System//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${Date.now()}@cityhealth.com
DTSTAMP:${now}
DTSTART:${startUTC}
DTEND:${endUTC}
SUMMARY:${service} Appointment
DESCRIPTION:Appointment with ${name} for ${service}.
LOCATION:City Health Clinic
STATUS:CONFIRMED
ORGANIZER;CN=City Health:mailto:${this.config.get('SMTP_USER')}
ATTENDEE;RSVP=TRUE:mailto:${to}
END:VEVENT
END:VCALENDAR`
      .replace(/\r?\n/g, '\r\n')
      .trim();

    try {
      await this.transporter.sendMail({
        from: this.config.get('SMTP_FROM'),
        to: to,
        subject: `📅 Appointment Confirmed: ${service}`,
        // 3. ROBUST HTML BODY
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
            <h2 style="color: #2563eb;">Appointment Confirmed</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>Your appointment has been successfully booked.</p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Service:</strong> ${service}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${time}</p>
            </div>

            <p>A calendar invitation is attached. Please accept it to add it to your calendar.</p>
            <p>Best regards,<br/>City Health Team</p>
          </div>
        `,
        // 4. USE 'alternatives' FOR CALENDAR INVITES (Most compatible method)
        alternatives: [
          {
            contentType: 'text/calendar; method=REQUEST',
            content: icsContent,
          },
        ],
        // Fallback attachment just in case
        attachments: [
          {
            filename: 'invite.ics',
            content: icsContent,
            contentType: 'text/calendar',
          },
        ],
      });
      this.logger.log(`✅ Email + Calendar Invite sent to ${to}`);
    } catch (error) {
      // 5. DETAILED ERROR LOGGING
      this.logger.error(`❌ FAILED to send email to ${to}`);
      this.logger.error(error.message);
      if (error.response) this.logger.error(error.response);
    }
  }
}
