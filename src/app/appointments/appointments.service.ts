import { prisma } from '../../database/prisma';
import { publishEvent } from '../middlewares/sns.service';

export class AppointmentsService {
  /**
   * Obtiene los slots disponibles para un negocio en una fecha dada basado en sus Schedules y citas existentes.
   */
  public async getAvailableSlots(businessId: string, dateStr: string, serviceDurationMinutes: number) {
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getUTCDay();

    const schedule = await prisma.schedule.findUnique({
      where: {
        business_id_day_of_week: {
          business_id: businessId,
          day_of_week: dayOfWeek,
        },
      },
    });

    if (!schedule) return [];

    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        business_id: businessId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        start_datetime: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      orderBy: { start_datetime: 'asc' },
    });

    const availableSlots: string[] = [];
    const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
    const [endHour, endMinute] = schedule.end_time.split(':').map(Number);

    let currentSlotTime = new Date(targetDate);
    currentSlotTime.setUTCHours(startHour, startMinute, 0, 0);

    const endWorkingTime = new Date(targetDate);
    endWorkingTime.setUTCHours(endHour, endMinute, 0, 0);

    while (currentSlotTime < endWorkingTime) {
      const slotEnd = new Date(currentSlotTime.getTime() + serviceDurationMinutes * 60000);

      if (slotEnd > endWorkingTime) break;

      const isOverlapping = appointments.some((appt) => {
        return (
          (currentSlotTime >= appt.start_datetime && currentSlotTime < appt.end_datetime) ||
          (slotEnd > appt.start_datetime && slotEnd <= appt.end_datetime) ||
          (currentSlotTime <= appt.start_datetime && slotEnd >= appt.end_datetime)
        );
      });

      if (!isOverlapping) {
        availableSlots.push(
          `${currentSlotTime.getUTCHours().toString().padStart(2, '0')}:${currentSlotTime.getUTCMinutes().toString().padStart(2, '0')}`
        );
      }
      currentSlotTime = new Date(currentSlotTime.getTime() + serviceDurationMinutes * 60000);
    }

    return availableSlots;
  }

  /**
   * Crea una reservación utilizando Transacciones ACID para evitar el Overbooking.
   */
  public async createAppointment(data: {
    businessId: string;
    clientId: string;
    serviceId: string;
    startDatetime: Date;
    endDatetime: Date;
  }) {
    const appointment = await prisma.$transaction(async (tx) => {
      const overlapping = await tx.appointment.findFirst({
        where: {
          business_id: data.businessId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          OR: [
            {
              start_datetime: { lt: data.endDatetime },
              end_datetime: { gt: data.startDatetime },
            },
          ],
        },
      });

      if (overlapping) {
        throw new Error('Conflict: Time slot is already booked.');
      }

      const newAppointment = await tx.appointment.create({
        data: {
          business_id: data.businessId,
          client_id: data.clientId,
          service_id: data.serviceId,
          start_datetime: data.startDatetime,
          end_datetime: data.endDatetime,
          status: 'CONFIRMED',
        },
      });

      return newAppointment;
    });

    await publishEvent('AppointmentConfirmed', {
      appointmentId: appointment.id,
      businessId: appointment.business_id,
      clientId: appointment.client_id,
      startDatetime: appointment.start_datetime,
    });

    return appointment;
  }

  public async getAppointmentsByFilter(filters: { businessId?: string; clientId?: string }) {
    const whereClause: any = {};
    if (filters.businessId) whereClause.business_id = filters.businessId;
    if (filters.clientId) whereClause.client_id = filters.clientId;

    return prisma.appointment.findMany({
      where: whereClause,
      include: {
        service: true,
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { start_datetime: 'desc' },
    });
  }

  public async updateAppointmentStatus(id: string, status: 'PENDING' | 'CONFIRMED' | 'CANCELLED') {
    return prisma.appointment.update({
      where: { id },
      data: { status },
    });
  }

  public async deleteAppointment(id: string) {
    return prisma.appointment.delete({
      where: { id },
    });
  }
}
