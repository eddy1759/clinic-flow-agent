import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { EmailService } from 'src/common/email/email.service';
import { google, calendar_v3 } from 'googleapis';
import {
  addMinutes,
  startOfDay,
  endOfDay,
  isBefore,
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

export interface CreateAppointmentData {
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  providerId: string;
  startTime: Date;
  serviceType: string;
  idempotencyKey?: string;
}

@Injectable()
export class SchedulingService {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;
  private readonly logger = new Logger(SchedulingService.name);

  private readonly CLINIC_OPEN_HOUR = 9;
  private readonly CLINIC_CLOSE_HOUR = 17;
  private readonly SLOT_DURATION_MIN = 30;

  private readonly SERVICE_DURATIONS: Record<string, number> = {
    'General Consultation': 15,
    'Dental Cleaning': 30,
    Surgery: 60,
    'Root Canal': 90,
    'Follow Up': 30,
  };

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
      this.logger.log({
        event: 'GCAL_INITIALIZED',
        calendarId: this.calendarId,
      });
    } catch (error) {
      this.logger.error({
        event: 'GCAL_INIT_FAILED',
        error: error.message,
      });
    }
  }

  async getAvailability(
    dateStr: string,
    providerId: string = 'default',
  ): Promise<string[]> {
    const startTime = Date.now();

    this.logger.log({
      event: 'AVAILABILITY_CHECK_START',
      providerId,
      date: dateStr,
    });

    try {
      const targetDate = parseISO(dateStr);

      if (isNaN(targetDate.getTime())) {
        this.logger.warn({
          event: 'INVALID_DATE',
          dateStr,
        });
        return [];
      }

      const dayStart = startOfDay(targetDate);
      const dayEnd = endOfDay(targetDate);

      // Fetch busy slots from Google Calendar
      const gCalBusySlots = await this.fetchBusySlots(dayStart, dayEnd);

      // Fetch busy slots from internal DB
      const dbBusySlots = await this.prisma.appointment.findMany({
        where: {
          providerId,
          status: {
            in: [AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED],
          },
          startTime: { gte: dayStart, lt: dayEnd },
        },
        select: { startTime: true, endTime: true },
      });

      const allBusySlots = [
        ...gCalBusySlots,
        ...dbBusySlots.map((appt) => ({
          start: appt.startTime,
          end: appt.endTime,
        })),
      ];

      // Generate available slots
      const availableSlots: string[] = [];
      let currentSlot = new Date(targetDate);
      currentSlot.setHours(this.CLINIC_OPEN_HOUR, 0, 0, 0);

      const clinicClose = new Date(targetDate);
      clinicClose.setHours(this.CLINIC_CLOSE_HOUR, 0, 0, 0);

      const now = new Date();

      // Loop through potential slots
      while (
        isBefore(addMinutes(currentSlot, this.SLOT_DURATION_MIN), clinicClose)
      ) {
        const slotEnd = addMinutes(currentSlot, this.SLOT_DURATION_MIN);

        // Cannot be in the past
        if (isBefore(currentSlot, now)) {
          currentSlot = addMinutes(currentSlot, this.SLOT_DURATION_MIN);
          continue;
        }

        // Check overlap with ALL Busy Events (GCal + DB)
        const isBusy = allBusySlots.some((busy) =>
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

      this.logger.log({
        event: 'AVAILABILITY_CHECK_COMPLETE',
        date: dateStr,
        slotsFound: availableSlots.length,
        duration_ms: Date.now() - startTime,
      });

      return availableSlots;
    } catch (error) {
      this.logger.error({
        event: 'AVAILABILITY_CHECK_FAILED',
        date: dateStr,
        error: error.message,
        duration_ms: Date.now() - startTime,
      });
      return [];
    }
  }

  async createAppointment(data: CreateAppointmentData) {
    const startTime = Date.now();
    const duration = this.getDuration(data.serviceType);
    const endTime = addMinutes(data.startTime, duration);

    const finalIdempotencyKey = data.idempotencyKey || uuidv4();

    this.logger.log({
      event: 'BOOKING_ATTEMPT',
      patientId: data.patientId,
      requestedTime: data.startTime.toISOString(),
      service: data.serviceType,
    });

    try {
      const hasGCalConflict = await this.checkGoogleCalendarConflict(
        data.startTime,
        endTime,
      );

      if (hasGCalConflict) {
        this.logger.warn({
          event: 'BOOKING_BLOCKED_GCAL_CONFLICT',
          patientId: data.patientId,
          time: data.startTime.toISOString(),
        });

        throw new ConflictException(
          'This time slot is already booked in the calendar. Please choose a different time.',
        );
      }

      const availableSlots = await this.getAvailability(
        format(data.startTime, 'yyyy-MM-dd'),
        data.providerId,
      );

      const requestedSlot = format(data.startTime, "yyyy-MM-dd'T'HH:mm:ssXXX");

      if (!availableSlots.includes(requestedSlot)) {
        this.logger.warn({
          event: 'BOOKING_BLOCKED_SLOT_UNAVAILABLE',
          patientId: data.patientId,
          time: data.startTime.toISOString(),
        });

        throw new ConflictException(
          'This slot was just booked by another patient. Please choose a different time.',
        );
      }

      const appointment = await this.prisma.$transaction(
        async (tx) => {
          // prevent duplicate bookings from retries
          if (finalIdempotencyKey) {
            const existing = await tx.appointment.findFirst({
              where: {
                idempotencyKey: finalIdempotencyKey,
                status: { not: AppointmentStatus.CANCELLED },
              },
            });

            if (existing) {
              this.logger.log({
                event: 'BOOKING_IDEMPOTENT_RETURN',
                appointmentId: existing.id,
              });
              return existing;
            }
          }

          // Race Condition Protection
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

          const newAppointment = await tx.appointment.create({
            data: {
              patient: { connect: { id: data.patientId } },
              providerId: data.providerId,
              startTime: data.startTime,
              endTime: endTime,
              serviceType: data.serviceType,
              status: AppointmentStatus.CONFIRMED,
              idempotencyKey: finalIdempotencyKey,
              googleEventId: null, // Will be updated after GCal creation
            },
          });

          await tx.auditLog.create({
            data: {
              action: 'CREATE_APPT',
              patient: { connect: { id: data.patientId } },
              metadata: {
                appointmentId: newAppointment.id,
                time: data.startTime.toISOString(),
                service: data.serviceType,
              },
            },
          });

          return newAppointment;
        },
        {
          isolationLevel: 'Serializable', // Strongest isolation level
          timeout: 10000, // 10 seconds max
        },
      );

      let googleEventId: string | null = null;

      try {
        const gCalRes = await this.calendar.events.insert({
          calendarId: this.calendarId,
          sendUpdates: 'none',
          requestBody: {
            summary: `${data.serviceType} - ${data.patientName}`,
            description: `
              Patient: ${data.patientName}
              Email: ${data.patientEmail}
              Phone: ${data.patientPhone}
              Service: ${data.serviceType}
            `.trim(),
            location: 'City Health Clinic, Main Office',
            start: { dateTime: data.startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
          },
        });

        googleEventId = gCalRes.data.id || null;

        // Update appointment with Google Event ID
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId },
        });
      } catch (error) {
        this.logger.error({
          event: 'GCAL_EVENT_CREATE_FAILED',
          appointmentId: appointment.id,
          error: error.message,
        });
      }

      if (data.patientEmail) {
        const timeStr = data.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        this.emailService
          .sendAppointmentConfirmation(
            data.patientEmail,
            data.patientName,
            data.startTime,
            timeStr,
            data.serviceType,
          )
          .catch((err) => {
            this.logger.error({
              event: 'EMAIL_SEND_FAILED',
              appointmentId: appointment.id,
              error: err.message,
            });
          });
      }

      this.logger.log({
        event: 'BOOKING_SUCCESS',
        appointmentId: appointment.id,
        patientId: data.patientId,
        time: data.startTime.toISOString(),
        service: data.serviceType,
        googleEventId,
        duration_ms: Date.now() - startTime,
      });

      return appointment;
    } catch (error) {
      this.logger.error({
        event: 'BOOKING_FAILED',
        patientId: data.patientId,
        time: data.startTime.toISOString(),
        error: error.message,
        duration_ms: Date.now() - startTime,
      });

      // Re-throw to be handled by agent
      throw error;
    }
  }

  async cancelAppointment(appointmentId: string) {
    const startTime = Date.now();

    this.logger.log({
      event: 'CANCEL_ATTEMPT',
      appointmentId,
    });

    try {
      const appt = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!appt) {
        throw new BadRequestException('Appointment not found');
      }

      if (appt.status === AppointmentStatus.CANCELLED) {
        this.logger.warn({
          event: 'CANCEL_ALREADY_CANCELLED',
          appointmentId,
        });
        return appt;
      }

      // Delete from Google Calendar
      if (appt.googleEventId) {
        try {
          await this.calendar.events.delete({
            calendarId: this.calendarId,
            eventId: appt.googleEventId,
          });
        } catch (error) {
          this.logger.warn({
            event: 'GCAL_DELETE_FAILED',
            appointmentId,
            googleEventId: appt.googleEventId,
            error: error.message,
          });
        }
      }

      // Update database
      const updated = await this.prisma.$transaction(async (tx) => {
        const cancelled = await tx.appointment.update({
          where: { id: appointmentId },
          data: { status: AppointmentStatus.CANCELLED },
        });

        await tx.auditLog.create({
          data: {
            action: 'CANCEL_APPT',
            patientId: appt.patientId,
            metadata: {
              appointmentId,
              cancelledAt: new Date().toISOString(),
            },
          },
        });

        return cancelled;
      });

      this.logger.log({
        event: 'CANCEL_SUCCESS',
        appointmentId,
        duration_ms: Date.now() - startTime,
      });

      return updated;
    } catch (error) {
      this.logger.error({
        event: 'CANCEL_FAILED',
        appointmentId,
        error: error.message,
        duration_ms: Date.now() - startTime,
      });
      throw error;
    }
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
        start: new Date(item.start?.dateTime || item.start?.date || start),
        end: new Date(item.end?.dateTime || item.end?.date || end),
      }));
    } catch (error) {
      this.logger.error({
        event: 'GCAL_FETCH_FAILED',
        error: error.message,
      });
      return [];
    }
  }

  private async checkGoogleCalendarConflict(
    start: Date,
    end: Date,
  ): Promise<boolean> {
    try {
      const events = await this.fetchBusySlots(start, end);

      const hasConflict = events.some((event) =>
        areIntervalsOverlapping(
          { start, end },
          { start: event.start, end: event.end },
        ),
      );

      if (hasConflict) {
        this.logger.warn({
          event: 'GCAL_CONFLICT_DETECTED',
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }

      return hasConflict;
    } catch (error) {
      this.logger.error({
        event: 'GCAL_CONFLICT_CHECK_FAILED',
        error: error.message,
      });
      return false;
    }
  }

  private getDuration(serviceType: string): number {
    return this.SERVICE_DURATIONS[serviceType] || 30; // Default 30 min
  }
}
