import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './utils/prisma.js';

async function seed() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('admin123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@sakanat.com' },
    update: {},
    create: {
      name: 'مدير النظام',
      email: 'admin@sakanat.com',
      phone: '0591234567',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 's12345678@stu.najah.edu' },
    update: {},
    create: {
      name: 'طالب تجريبي',
      email: 's12345678@stu.najah.edu',
      phone: '0599999999',
      password: userPassword,
      role: 'STUDENT',
    },
  });

  await prisma.user.upsert({
    where: { email: 'owner@test.com' },
    update: {},
    create: {
      name: 'أحمد نصار',
      email: 'owner@test.com',
      phone: '0591234568',
      password: userPassword,
      role: 'OWNER',
    },
  });

  console.log('Seeding complete!');
  console.log('Admin: admin@sakanat.com / admin123');
  console.log('Student: s12345678@stu.najah.edu / user123');
  console.log('Owner: owner@test.com / user123');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
