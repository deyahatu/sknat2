import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './utils/prisma.js';

async function seed() {
  console.log('🌱 Seeding database...');

  const pw = await bcrypt.hash('Test1234!', 12);

  // ── Admin ──
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sknat.com' },
    update: {},
    create: { name: 'مدير النظام', email: 'admin@sknat.com', phone: '0500000000', password: pw, role: 'ADMIN', idNumber: '000000000' },
  });

  // ── Owners ──
  const owner1 = await prisma.user.upsert({
    where: { email: 'ahmad@owner.com' },
    update: {},
    create: { name: 'أحمد نصار', email: 'ahmad@owner.com', phone: '0591000001', password: pw, role: 'OWNER', idNumber: '111111111', idPhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
  });
  const owner2 = await prisma.user.upsert({
    where: { email: 'sara@owner.com' },
    update: {},
    create: { name: 'سارة عبد الله', email: 'sara@owner.com', phone: '0591000002', password: pw, role: 'OWNER', idNumber: '222222222', idPhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
  });

  // ── Students ──
  const students = [];
  const studentData = [
    { name: 'محمد علي', email: 's11111111@stu.najah.edu', phone: '0592000001', idNumber: '311111111', gender: 'MALE', major: 'هندسة حاسوب' },
    { name: 'يوسف خالد', email: 's22222222@stu.najah.edu', phone: '0592000002', idNumber: '322222222', gender: 'MALE', major: 'هندسة كهربائية' },
    { name: 'ريم حسن', email: 's33333333@stu.najah.edu', phone: '0592000003', idNumber: '333333333', gender: 'FEMALE', major: 'طب بشري' },
    { name: 'نور أحمد', email: 's44444444@stu.najah.edu', phone: '0592000004', idNumber: '344444444', gender: 'FEMALE', major: 'صيدلة' },
    { name: 'عمر سعيد', email: 's55555555@stu.najah.edu', phone: '0592000005', idNumber: '355555555', gender: 'MALE', major: 'حقوق' },
  ];
  for (const s of studentData) {
    const st = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { ...s, password: pw, role: 'STUDENT', idPhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
    });
    students.push(st);
  }

  // ── Properties ──
  const prop1 = await prisma.property.upsert({
    where: { id: 'seed-prop-1' },
    update: {},
    create: {
      id: 'seed-prop-1',
      title: 'شقة النخبة الطلابية',
      kind: 'APARTMENT',
      city: 'رفيديا',
      address: 'شارع الجامعة - بجانب مسجد النور',
      campus: 'OLD',
      distance: 5,
      description: 'شقة مميزة قريبة من الحرم القديم، مؤثثة بالكامل مع خدمات ممتازة',
      policy: 'ممنوع التدخين، الهدوء بعد 10 مساءً',
      targetGender: 'MALE',
      sharedServices: ['واي فاي', 'غسالة', 'مطبخ مشترك'],
      bathrooms: 2,
      area: 120,
      images: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
      available: true,
      ownerId: owner1.id,
    },
  });

  const prop2 = await prisma.property.upsert({
    where: { id: 'seed-prop-2' },
    update: {},
    create: {
      id: 'seed-prop-2',
      title: 'استوديو الأمل',
      kind: 'STUDIO',
      city: 'المساكن',
      address: 'قرب دوار المساكن',
      campus: 'NEW',
      distance: 10,
      description: 'استوديو مستقل مع مطبخ وحمام خاص',
      policy: 'لا حيوانات أليفة',
      targetGender: 'FEMALE',
      sharedServices: ['واي فاي', 'موقف سيارات'],
      bathrooms: 1,
      area: 40,
      images: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
      available: true,
      studioPrice: 600,
      ownerId: owner2.id,
    },
  });

  const prop3 = await prisma.property.upsert({
    where: { id: 'seed-prop-3' },
    update: {},
    create: {
      id: 'seed-prop-3',
      title: 'شقة الياسمين',
      kind: 'APARTMENT',
      city: 'خلة العامود',
      address: 'شارع فيصل',
      campus: 'NEW',
      distance: 8,
      description: 'شقة واسعة مع إطلالة جميلة، قريبة من الحرم الجديد',
      policy: 'ممنوع التدخين',
      targetGender: 'MALE',
      sharedServices: ['واي فاي', 'مصعد', 'حراسة'],
      bathrooms: 3,
      area: 150,
      images: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
      available: true,
      ownerId: owner1.id,
    },
  });

  // ── Room Variants ──
  // Prop1: 3 rooms
  const rooms1 = [];
  for (let i = 1; i <= 3; i++) {
    const r = await prisma.roomVariant.upsert({
      where: { id: `seed-room-1-${i}` },
      update: {},
      create: {
        id: `seed-room-1-${i}`,
        name: `الغرفة ${i}`,
        kind: i <= 2 ? 'SINGLE' : 'DOUBLE',
        capacity: i <= 2 ? 1 : 2,
        fullPrice: i <= 2 ? 500 : 800,
        halfPrice: i <= 2 ? null : 400,
        services: ['حمام خاص', 'تكييف'],
        isOccupied: i === 1,
        patternName: i <= 2 ? 'غرفة مفردة' : 'غرفة مزدوجة',
        patternColor: i <= 2 ? '#4f46e5' : '#0891b2',
        propertyId: prop1.id,
      },
    });
    rooms1.push(r);
  }

  // Prop2: studio variant
  await prisma.roomVariant.upsert({
    where: { id: 'seed-room-2-1' },
    update: {},
    create: {
      id: 'seed-room-2-1',
      name: 'الاستوديو',
      kind: 'SINGLE',
      capacity: 1,
      fullPrice: 600,
      services: ['واي فاي', 'موقف سيارات'],
      isOccupied: false,
      propertyId: prop2.id,
    },
  });

  // Prop3: 4 rooms
  for (let i = 1; i <= 4; i++) {
    await prisma.roomVariant.upsert({
      where: { id: `seed-room-3-${i}` },
      update: {},
      create: {
        id: `seed-room-3-${i}`,
        name: `الغرفة ${i}`,
        kind: 'SINGLE',
        capacity: 1,
        fullPrice: 450,
        services: ['تكييف', 'مكتب دراسة'],
        isOccupied: i <= 2,
        patternName: 'غرفة مفردة',
        patternColor: '#059669',
        propertyId: prop3.id,
      },
    });
  }

  // ── Bookings (different months for chart data) ──
  const now = new Date();
  const bookingData = [
    { studentIdx: 0, propertyId: prop1.id, roomVariantId: rooms1[0].id, monthsAgo: 0, status: 'PAID' },
    { studentIdx: 1, propertyId: prop3.id, roomVariantId: 'seed-room-3-1', monthsAgo: 0, status: 'APPROVED' },
    { studentIdx: 2, propertyId: prop3.id, roomVariantId: 'seed-room-3-2', monthsAgo: 1, status: 'PAID' },
    { studentIdx: 3, propertyId: prop1.id, roomVariantId: rooms1[1].id, monthsAgo: 1, status: 'COMPLETED' },
    { studentIdx: 4, propertyId: prop1.id, roomVariantId: rooms1[2].id, monthsAgo: 2, status: 'PENDING' },
    { studentIdx: 0, propertyId: prop3.id, roomVariantId: 'seed-room-3-3', monthsAgo: 3, status: 'COMPLETED' },
    { studentIdx: 1, propertyId: prop3.id, roomVariantId: 'seed-room-3-4', monthsAgo: 4, status: 'COMPLETED' },
  ];

  for (let i = 0; i < bookingData.length; i++) {
    const b = bookingData[i];
    const start = new Date(now.getFullYear(), now.getMonth() - b.monthsAgo, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - b.monthsAgo + 3, 1);
    const booking = await prisma.booking.upsert({
      where: { id: `seed-booking-${i}` },
      update: {},
      create: {
        id: `seed-booking-${i}`,
        startDate: start,
        endDate: end,
        status: b.status,
        propertyId: b.propertyId,
        roomVariantId: b.roomVariantId,
        studentId: students[b.studentIdx].id,
      },
    });

    // Create payments for PAID/COMPLETED bookings
    if (b.status === 'PAID' || b.status === 'COMPLETED') {
      await prisma.payment.upsert({
        where: { bookingId: booking.id },
        update: {},
        create: {
          amount: 500 + i * 100,
          status: 'COMPLETED',
          bookingId: booking.id,
          studentId: students[b.studentIdx].id,
        },
      });
    }
  }

  // ── Reviews ──
  const reviewData = [
    { studentIdx: 3, propertyId: prop1.id, rating: 5, comment: 'سكن ممتاز والخدمات رائعة' },
    { studentIdx: 0, propertyId: prop3.id, rating: 4, comment: 'موقع مميز وقريب من الجامعة' },
    { studentIdx: 1, propertyId: prop3.id, rating: 3, comment: 'جيد بشكل عام لكن يحتاج تحسين النظافة' },
  ];

  for (const r of reviewData) {
    await prisma.review.upsert({
      where: { propertyId_studentId: { propertyId: r.propertyId, studentId: students[r.studentIdx].id } },
      update: {},
      create: {
        rating: r.rating,
        comment: r.comment,
        propertyId: r.propertyId,
        studentId: students[r.studentIdx].id,
      },
    });
  }

  // ── Wallet + Withdrawal for owner1 ──
  await prisma.wallet.upsert({
    where: { ownerId: owner1.id },
    update: { balance: 2500 },
    create: { ownerId: owner1.id, balance: 2500 },
  });

  await prisma.withdrawRequest.create({
    data: {
      amount: 1000,
      status: 'PENDING',
      ownerId: owner1.id,
      bankName: 'بنك فلسطين',
      bankAccountHolder: 'أحمد نصار',
      bankAccountNumber: 'PS12345678901234',
    },
  }).catch(() => {}); // ignore if exists

  // ── Refund request ──
  await prisma.refundRequest.create({
    data: {
      bookingId: 'seed-booking-4',
      studentId: students[4].id,
      originalAmount: 900,
      refundAmount: 450,
      refundPercentage: 50,
      reason: 'إلغاء الحجز',
      status: 'PENDING',
    },
  }).catch(() => {});

  console.log('✅ Seeding complete!');
  console.log('');
  console.log('📋 Accounts:');
  console.log('  Admin:   admin@sknat.com / Test1234!');
  console.log('  Owner1:  ahmad@owner.com / Test1234!');
  console.log('  Owner2:  sara@owner.com / Test1234!');
  console.log('  Student: s11111111@stu.najah.edu / Test1234!');
  console.log('  Student: s22222222@stu.najah.edu / Test1234!');
  console.log('');
  console.log('🏠 Properties: 3 (2 apartments, 1 studio)');
  console.log('🛏️ Rooms: 8 variants total');
  console.log('📅 Bookings: 7 (across 5 months)');
  console.log('💳 Payments: 4');
  console.log('⭐ Reviews: 3');
  console.log('💰 Withdrawal request: 1 (pending)');
  console.log('🔄 Refund request: 1 (pending)');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
