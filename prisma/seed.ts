import { prisma } from '../src/database/prisma';

async function main() {
  console.log('Iniciando poblamiento de la base de datos...');

  // 1. Limpiar base de datos (opcional, cuidado en prod)
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  // 2. Crear un Dueño de Negocio
  const owner = await prisma.user.upsert({
    where: { email: 'owner@bookio.com' },
    update: {},
    create: {
      id: 'mock-firebase-owner-uid',
      email: 'owner@bookio.com',
      name: 'Carlos Dueño',
      role: 'BUSINESS_OWNER',
      phone: '+523312345678',
    },
  });

  // 3. Crear un Cliente
  const client = await prisma.user.upsert({
    where: { email: 'client@bookio.com' },
    update: {},
    create: {
      id: 'mock-firebase-client-uid',
      email: 'client@bookio.com',
      name: 'Ana Cliente',
      role: 'CLIENT',
      phone: '+523398765432',
    },
  });

  // 4. Crear un Negocio con Servicios y Horarios
  const business = await prisma.business.create({
    data: {
      owner_id: owner.id,
      name: 'Spa Relajación Total',
      type: 'SPA',
      address: 'Av. Vallarta 1234, Guadalajara',
      latitude: 20.6736,
      longitude: -103.344,
      average_rating: 4.8,
      review_count: 24,
      services: {
        create: [
          { name: 'Masaje Sueco', duration_minutes: 60, price: 500.00 },
          { name: 'Tratamiento Facial', duration_minutes: 45, price: 350.00 }
        ]
      },
      schedules: {
        create: [
          { day_of_week: 1, start_time: '09:00', end_time: '18:00' },
          { day_of_week: 2, start_time: '09:00', end_time: '18:00' },
          { day_of_week: 3, start_time: '09:00', end_time: '18:00' },
          { day_of_week: 4, start_time: '09:00', end_time: '18:00' },
          { day_of_week: 5, start_time: '09:00', end_time: '18:00' }
        ]
      }
    },
    include: {
      services: true
    }
  });

  // 5. Crear otro negocio para variedad (Barbería)
  const barber = await prisma.business.create({
    data: {
      owner_id: owner.id,
      name: 'Barbería Clásica',
      type: 'BARBERSHOP',
      address: 'Av. Chapultepec 567, Guadalajara',
      latitude: 20.669,
      longitude: -103.368,
      average_rating: 4.5,
      review_count: 10,
      services: {
        create: [
          { name: 'Corte de Cabello Clásico', duration_minutes: 30, price: 200.00 },
          { name: 'Arreglo de Barba', duration_minutes: 20, price: 150.00 }
        ]
      }
    }
  });

  // 6. Crear una Cita (Appointment) de prueba para el cliente en el Spa
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setMinutes(tomorrowEnd.getMinutes() + business.services[0].duration_minutes);

  await prisma.appointment.create({
    data: {
      business_id: business.id,
      client_id: client.id,
      service_id: business.services[0].id,
      start_datetime: tomorrow,
      end_datetime: tomorrowEnd,
      status: 'CONFIRMED'
    }
  });

  console.log('Base de datos poblada exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error poblado la bd:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
