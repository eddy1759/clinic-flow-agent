import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { EmailService } from 'src/common/email/email.service';
import { google, calendar_v3 } from 'googleapis';
import {
  addMinutes,
  startOfDay,
  endOfDay,
  isBefore,
  // isAfter,
  format,
  parseISO,
  areIntervalsOverlapping,
} from 'date-fns';

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

@Injectable()
export class SchedulingService {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;
  private readonly logger = new Logger(SchedulingService.name);

  private readonly CLINIC_OPEN_HOUR = 9;
  private readonly CLINIC_CLOSE_HOUR = 17;
  private readonly SLOT_DURATION_MIN = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.initGoogleCalender();
  }

  private initGoogleCalender() {
    try {
      const auth = new google.auth.JWT({
        email: this.config.get<string>('GOOGLE_CLIENT_EMAIL'),
        key: (this.config.get<string>('GOOGLE_PRIVATE_KEY') || '').replace(
          /\\n/g,
          '\n',
        ),
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
      this.calendar = google.calendar({ version: 'v3', auth });
      this.calendarId = this.config.get<string>('CLINIC_CALENDAR_ID');
      this.logger.log(`✅ Google Calendar connected: ${this.calendarId}`);
    } catch (error) {
      this.logger.error('Failed to initialize Google Calendar', error);
    }
  }

  async getAvailability(
    dateStr: string,
    providerId: string = 'default',
  ): Promise<string[]> {
    this.logger.log(
      `Checking availability for Provider: ${providerId} on ${dateStr}`,
    );
    const targetDate = parseISO(dateStr);

    if (isNaN(targetDate.getTime())) return [];

    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const gCalBusySlots = await this.fetchBusySlots(dayStart, dayEnd);

    const availableSlots: string[] = [];
    let currentSlot = new Date(targetDate);
    currentSlot.setHours(this.CLINIC_OPEN_HOUR, 0, 0, 0);

    const clinicClose = new Date(targetDate);
    clinicClose.setHours(this.CLINIC_CLOSE_HOUR, 0, 0, 0);
    const now = new Date();

    // 3. Loop and Filter
    while (
      isBefore(addMinutes(currentSlot, this.SLOT_DURATION_MIN), clinicClose)
    ) {
      const slotEnd = addMinutes(currentSlot, this.SLOT_DURATION_MIN);

      // Rule A: Cannot be in the past
      if (isBefore(currentSlot, now)) {
        currentSlot = addMinutes(currentSlot, this.SLOT_DURATION_MIN);
        continue;
      }

      // Rule B: Check overlap with GCal Events
      const isBusy = gCalBusySlots.some((busy) =>
        areIntervalsOverlapping(
          { start: currentSlot, end: slotEnd },
          { start: busy.start, end: busy.end },
        ),
      );

      if (!isBusy) {
        availableSlots.push(format(currentSlot, "yyyy-MM-dd'T'HH:mm:ssXXX"));
      }

      currentSlot = addMinutes(currentSlot, this.SLOT_DURATION_MIN);
    }

    return availableSlots;
  }

  async createAppointments(data: {
    patientId: string;
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    providerId: string;
    startTime: Date;
    serviceType: string;
  }) {
    // Standard duration is 60 minutes (adjust if your logic differs)
    const duration = this.getDuration(data.serviceType);
    const endTime = addMinutes(data.startTime, duration);

    // // ---------------------------------------------------------
    // // STEP 1: GUARD - Check Local Database for Conflicts
    // // ---------------------------------------------------------
    // const existingAppt = await this.prisma.appointment.findFirst({
    //   where: {
    //     status: {
    //       in: [AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED],
    //     },
    //     // Logic: (StartA < EndB) and (EndA > StartB) means overlap
    //     AND: [
    //       { startTime: { lt: endTime } },
    //       { endTime: { gt: data.startTime } },
    //     ],
    //   },
    // });

    // if (existingAppt) {
    //   this.logger.warn(`Double booking attempt blocked for ${data.startTime}`);
    //   throw new ConflictException(
    //     'This time slot is already booked in our system. Please choose another time.',
    //   );
    // }

    // // ---------------------------------------------------------
    // // STEP 2: GUARD - Check Google Calendar directly (Real-time)
    // // ---------------------------------------------------------
    // // This catches cases where the doctor blocked a slot manually on their phone
    // try {
    //   const gCalCheck = await this.calendar.events.list({
    //     calendarId: this.calendarId,
    //     timeMin: data.startTime.toISOString(),
    //     timeMax: endTime.toISOString(),
    //     singleEvents: true,
    //   });

    //   // If GCal returns any events that overlap, block it.
    //   if (gCalCheck.data.items && gCalCheck.data.items.length > 0) {
    //     this.logger.warn(`GCal conflict found for ${data.startTime}`);
    //     throw new ConflictException(
    //       'The calendar shows a conflict at this time (external event).',
    //     );
    //   }
    // } catch (error) {
    //   // If it's a ConflictException, rethrow it.
    //   // If it's a Google API error, log it but maybe allow proceeding (fail open)
    //   // or block (fail closed) depending on your risk tolerance.
    //   if (error instanceof ConflictException) throw error;
    //   this.logger.error('Error checking GCal conflicts', error);
    // }

    // // ---------------------------------------------------------
    // // STEP 3: PROCEED WITH BOOKING (Logic remains the same)
    // // ---------------------------------------------------------
    // let googleEventId: string | null = null;

    // try {
    //   const gCalRes = await this.calendar.events.insert({
    //     calendarId: this.calendarId,
    //     sendUpdates: 'none',
    //     requestBody: {
    //       summary: `Appointmen with ${data.patientName} for ${data.serviceType}`,
    //       description: `
    //         Patient: ${data.patientName}
    //         Email: ${data.patientEmail}
    //         Service: ${data.serviceType}
    //       `,
    //       location: 'City Health Clinic, Main Office',
    //       start: { dateTime: data.startTime.toISOString() },
    //       end: { dateTime: endTime.toISOString() },
    //     },
    //   });
    //   googleEventId = gCalRes.data.id || null;
    // } catch (error) {
    //   this.logger.error('Failed to create Google Calendar event', error);
    // }

    // if (data.patientEmail) {
    //   const timeStr = data.startTime.toLocaleTimeString('en-US', {
    //     hour: 'numeric',
    //     minute: '2-digit',
    //   });
    //   // Fire and forget (don't await)
    //   this.emailService.sendAppointmentConfirmation(
    //     data.patientEmail,
    //     data.patientName,
    //     data.startTime,
    //     timeStr,
    //     data.serviceType,
    //   );
    // }

    // return this.prisma.$transaction(async (tx) => {
    //   const appointment = await tx.appointment.create({
    //     data: {
    //       patient: { connect: { id: data.patientId } },
    //       createdAt: new Date(),
    //       providerId: data.providerId,
    //       startTime: data.startTime,
    //       endTime: endTime,
    //       serviceType: data.serviceType,
    //       status: AppointmentStatus.CONFIRMED,
    //       googleEventId: googleEventId,
    //     },
    //   });

    //   await tx.auditLog.create({
    //     data: {
    //       action: 'CREATE_APPT',
    //       patient: { connect: { id: data.patientId } },
    //       metadata: {
    //         appointmentId: appointment.id,
    //         googleEventId,
    //         time: data.startTime,
    //         patientName: data.patientName,
    //       },
    //     },
    //   });
    //   return appointment;
    // });
    return this.prisma.$transaction(
      async (tx) => {
        // A. DB GUARD: Check for conflicts within the transaction scope
        const conflict = await tx.appointment.findFirst({
          where: {
            status: {
              in: [AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED],
            },
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gt: data.startTime } },
            ],
          },
        });

        if (conflict) {
          throw new ConflictException('Slot taken (DB Conflict)');
        }

        // B. EXTERNAL GUARD: Check Google Calendar (Real-time)
        // Note: We do this inside the transaction to ensure we don't hold the DB lock
        // too long, but strictly speaking, external calls inside DB tx are discouraged.
        // However, for booking integrity, we check it here or accept a compensation logic later.
        try {
          const gCalCheck = await this.calendar.events.list({
            calendarId: this.calendarId,
            timeMin: data.startTime.toISOString(),
            timeMax: endTime.toISOString(),
            singleEvents: true,
          });

          if (gCalCheck.data.items && gCalCheck.data.items.length > 0) {
            throw new ConflictException(
              'Slot taken (Google Calendar Conflict)',
            );
          }
        } catch (error) {
          if (error instanceof ConflictException) throw error;
          // Log but don't fail transaction on Google API network blip, unless strict strictness needed
          this.logger.error(
            'GCal check failed, proceeding with DB lock',
            error,
          );
        }

        // C. CREATE EXTERNAL EVENT (Google Calendar)
        let googleEventId: string | null = null;
        try {
          const gCalRes = await this.calendar.events.insert({
            calendarId: this.calendarId,
            sendUpdates: 'none',
            requestBody: {
              summary: `Appointment with ${data.patientName}`,
              description: `Service: ${data.serviceType}\nPhone: ${data.patientPhone}`,
              start: { dateTime: data.startTime.toISOString() },
              end: { dateTime: endTime.toISOString() },
            },
          });
          googleEventId = gCalRes.data.id || null;
        } catch (e) {
          this.logger.error('Failed to create GCal event', e);
        }

        // D. ATOMIC INSERT (The Booking)
        const appointment = await tx.appointment.create({
          data: {
            patient: { connect: { id: data.patientId } },
            createdAt: new Date(),
            providerId: data.providerId,
            startTime: data.startTime,
            endTime: endTime,
            serviceType: data.serviceType,
            status: AppointmentStatus.CONFIRMED,
            googleEventId: googleEventId,
          },
        });

        // E. AUDIT LOG
        await tx.auditLog.create({
          data: {
            action: 'CREATE_APPT',
            patient: { connect: { id: data.patientId } },
            metadata: {
              appointmentId: appointment.id,
              time: data.startTime,
            },
          },
        });

        // F. SEND EMAIL (Side Effect - do NOT await this to keep TX fast)
        if (data.patientEmail) {
          const timeStr = data.startTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });
          this.emailService
            .sendAppointmentConfirmation(
              data.patientEmail,
              data.patientName,
              data.startTime,
              timeStr,
              data.serviceType,
            )
            .catch((err) => this.logger.error('Email failed', err));
        }

        return appointment;
      },
      {
        // 3. SET ISOLATION LEVEL
        // 'Serializable' ensures that if two requests run this exact logic at the same time,
        // one will succeed and the other will fail with a serialization error.
        isolationLevel: 'Serializable',
        timeout: 10000, // 10s max for the transaction
      },
    );
  }

  async cancelAppointment(appointmentId: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appt) throw new BadRequestException('Appointment not found');

    if (appt.googleEventId) {
      try {
        await this.calendar.events.delete({
          calendarId: this.calendarId,
          eventId: appt.googleEventId,
        });
      } catch (error) {
        this.logger.warn(
          'Failed to delete GCal event, proceeding with local cancel',
          error,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.CANCELLED },
      });

      await tx.auditLog.create({
        data: {
          action: 'CANCEL_APPT',
          patientId: appt.patientId,
          metadata: { appointmentId: appointmentId },
        },
      });

      return updated;
    });
  }

  private async fetchBusySlots(start: Date, end: Date) {
    try {
      const res = await Promise.race([
        this.calendar.events.list({
          calendarId: this.calendarId,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GCal API Timeout')), 5000),
        ),
      ]);

      return (res.data.items || []).map((item) => ({
        start: new Date(item.start.dateTime || item.start.date),
        end: new Date(item.end.dateTime || item.end.date),
      }));
    } catch (error) {
      this.logger.error('Failed to fetch GCal events', error);
      return [];
    }
  }

  private async checkConflict(start: Date, end: Date): Promise<boolean> {
    const events = await this.fetchBusySlots(start, end);
    return events.some((event) =>
      areIntervalsOverlapping(
        { start, end },
        { start: event.start, end: event.end },
      ),
    );
  }

  private getDuration(serviceType: string): number {
    const mapping: Record<string, number> = {
      'Dental Cleaning': 30,
      'General Consultation': 15,
      Surgery: 60,
      'Root Canal': 90,
    };
    // Default to 30 if unknown
    return mapping[serviceType] || 30;
  }
}
