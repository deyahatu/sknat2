import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "./utils/prisma.js";

async function seed() {
  console.log("🌱 Seeding database...");

  const pw = await bcrypt.hash("Test1234!", 12);

  // ── Admin ──
  const admin = await prisma.user.upsert({
    where: { email: "admin@sknat.com" },
    update: {},
    create: {
      name: "مدير النظام",
      email: "admin@sknat.com",
      phone: "0500000000",
      password: pw,
      role: "ADMIN",
      idNumber: "000000000",
    },
  });

  // ── Owners ──
  const owner1 = await prisma.user.upsert({
    where: { email: "ahmad@owner.com" },
    update: {},
    create: {
      name: "أحمد نصار",
      email: "ahmad@owner.com",
      phone: "0591000001",
      password: pw,
      role: "OWNER",
      idNumber: "111111111",
      idPhoto: "/uploads/placeholder-id.jpg",
    },
  });
  const owner2 = await prisma.user.upsert({
    where: { email: "sara@owner.com" },
    update: {},
    create: {
      name: "سارة عبد الله",
      email: "sara@owner.com",
      phone: "0591000002",
      password: pw,
      role: "OWNER",
      idNumber: "222222222",
      idPhoto: "/uploads/placeholder-id.jpg",
    },
  });

  // ── Students ──
  const students = [];
  const studentData = [
    {
      name: "محمد علي",
      email: "s11111111@stu.najah.edu",
      phone: "0592000001",
      idNumber: "311111111",
      gender: "MALE",
      major: "هندسة حاسوب",
    },
    {
      name: "يوسف خالد",
      email: "s22222222@stu.najah.edu",
      phone: "0592000002",
      idNumber: "322222222",
      gender: "MALE",
      major: "هندسة كهربائية",
    },
    {
      name: "ريم حسن",
      email: "s33333333@stu.najah.edu",
      phone: "0592000003",
      idNumber: "333333333",
      gender: "FEMALE",
      major: "طب بشري",
    },
    {
      name: "نور أحمد",
      email: "s44444444@stu.najah.edu",
      phone: "0592000004",
      idNumber: "344444444",
      gender: "FEMALE",
      major: "صيدلة",
    },
    {
      name: "عمر سعيد",
      email: "s55555555@stu.najah.edu",
      phone: "0592000005",
      idNumber: "355555555",
      gender: "MALE",
      major: "حقوق",
    },
  ];
  for (const s of studentData) {
    const st = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        ...s,
        password: pw,
        role: "STUDENT",
        idPhoto: "/uploads/placeholder-id.jpg",
      },
    });
    students.push(st);
  }

  // ── Properties ──
  const prop1 = await prisma.property.upsert({
    where: { id: "seed-prop-1" },
    update: {},
    create: {
      id: "seed-prop-1",
      title: "شقة النخبة الطلابية",
      kind: "APARTMENT",
      city: "رفيديا",
      address: "شارع الجامعة - بجانب مسجد النور",
      campus: "OLD",
      distance: 5,
      description:
        "شقة مميزة قريبة من الحرم القديم، مؤثثة بالكامل مع خدمات ممتازة",
      policy: "ممنوع التدخين، الهدوء بعد 10 مساءً",
      targetGender: "MALE",
      sharedServices: ["واي فاي", "غسالة", "مطبخ مشترك"],
      bathrooms: 2,
      area: 120,
      images: ["/uploads/placeholder-property.jpg"],
      available: true,
      ownerId: owner1.id,
    },
  });

  const prop2 = await prisma.property.upsert({
    where: { id: "seed-prop-2" },
    update: {},
    create: {
      id: "seed-prop-2",
      title: "استوديو الأمل",
      kind: "STUDIO",
      city: "المساكن",
      address: "قرب دوار المساكن",
      campus: "NEW",
      distance: 10,
      description: "استوديو مستقل مع مطبخ وحمام خاص",
      policy: "لا حيوانات أليفة",
      targetGender: "FEMALE",
      sharedServices: ["واي فاي", "موقف سيارات"],
      bathrooms: 1,
      area: 40,
      images: ["/uploads/placeholder-property.jpg"],
      available: true,
      studioPrice: 600,
      ownerId: owner2.id,
    },
  });

  const prop3 = await prisma.property.upsert({
    where: { id: "seed-prop-3" },
    update: {},
    create: {
      id: "seed-prop-3",
      title: "شقة الياسمين",
      kind: "APARTMENT",
      city: "خلة العامود",
      address: "شارع فيصل",
      campus: "NEW",
      distance: 8,
      description: "شقة واسعة مع إطلالة جميلة، قريبة من الحرم الجديد",
      policy: "ممنوع التدخين",
      targetGender: "MALE",
      sharedServices: ["واي فاي", "مصعد", "حراسة"],
      bathrooms: 3,
      area: 150,
      images: ["/uploads/placeholder-property.jpg"],
      available: true,
      ownerId: owner1.id,
    },
  });

  const prop4 = await prisma.property.upsert({
    where: { id: "seed-prop-4" },
    update: {},
    create: {
      id: "seed-prop-4",
      title: "سكن الأندلس",
      kind: "APARTMENT",
      city: "رفيديا",
      address: "شارع الجامعة - مقابل كلية الطب",
      campus: "OLD",
      distance: 3,
      description: "سكن طلابي مميز بجانب الحرم القديم، جميع الغرف محجوزة حالياً",
      policy: "ممنوع التدخين، الهدوء بعد العاشرة مساءً",
      targetGender: "MALE",
      sharedServices: ["واي فاي", "غسالة", "مطبخ مشترك", "حراسة"],
      bathrooms: 2,
      area: 100,
      images: ["/uploads/placeholder-property.jpg"],
      available: false,
      ownerId: owner1.id,
    },
  });

  // ── Room Variants ──
  // Prop1: 3 rooms
  const rooms1 = [];
  for (let i = 1; i <= 3; i++) {
    const area1 = i <= 2 ? 12 : 18;
    const r = await prisma.roomVariant.upsert({
      where: { id: `seed-room-1-${i}` },
      update: { area: area1 },
      create: {
        id: `seed-room-1-${i}`,
        name: `الغرفة ${i}`,
        kind: i <= 2 ? "SINGLE" : "DOUBLE",
        capacity: i <= 2 ? 1 : 2,
        area: area1,
        fullPrice: i <= 2 ? 500 : 800,
        halfPrice: i <= 2 ? null : 400,
        services: ["حمام خاص", "تكييف"],
        isOccupied: i === 1,
        patternName: i <= 2 ? "غرفة مفردة" : "غرفة مزدوجة",
        patternColor: i <= 2 ? "#4f46e5" : "#0891b2",
        propertyId: prop1.id,
      },
    });
    rooms1.push(r);
  }

  // Prop2: studio variant
  await prisma.roomVariant.upsert({
    where: { id: "seed-room-2-1" },
    update: { area: 28 },
    create: {
      id: "seed-room-2-1",
      name: "الاستوديو",
      kind: "SINGLE",
      capacity: 1,
      area: 28,
      fullPrice: 600,
      services: ["واي فاي", "موقف سيارات"],
      isOccupied: false,
      propertyId: prop2.id,
    },
  });

  // Prop3: 4 rooms
  for (let i = 1; i <= 4; i++) {
    await prisma.roomVariant.upsert({
      where: { id: `seed-room-3-${i}` },
      update: { area: 14 },
      create: {
        id: `seed-room-3-${i}`,
        name: `الغرفة ${i}`,
        kind: "SINGLE",
        capacity: 1,
        area: 14,
        fullPrice: 450,
        services: ["تكييف", "مكتب دراسة"],
        isOccupied: i <= 2,
        patternName: "غرفة مفردة",
        patternColor: "#059669",
        propertyId: prop3.id,
      },
    });
  }

  // Prop4: 3 rooms (all occupied)
  for (let i = 1; i <= 3; i++) {
    await prisma.roomVariant.upsert({
      where: { id: `seed-room-4-${i}` },
      update: {},
      create: {
        id: `seed-room-4-${i}`,
        name: `الغرفة ${i}`,
        kind: "SINGLE",
        capacity: 1,
        area: 12,
        fullPrice: 400,
        services: ["تكييف", "حمام خاص"],
        isOccupied: true,
        patternName: "غرفة مفردة",
        patternColor: "#dc2626",
        propertyId: prop4.id,
      },
    });
  }

  // ── Bookings — clean slate, then create per-scenario ──
  // Wipe any prior seed bookings so refund/payment ages are fresh on every run.
  await prisma.refundRequest.deleteMany({
    where: { booking: { id: { startsWith: "seed-booking-" } } },
  });
  await prisma.payment.deleteMany({
    where: { booking: { id: { startsWith: "seed-booking-" } } },
  });
  await prisma.booking.deleteMany({
    where: { id: { startsWith: "seed-booking-" } },
  });

  const MS_DAY = 1000 * 60 * 60 * 24;
  const today = new Date();
  const dayOffset = (n) => new Date(today.getTime() + n * MS_DAY);

  // Per-student test scenarios. Each booking has its own date range and
  // (for paid ones) a paymentDaysAgo controlling the cancel-refund tier:
  //   payment age 0–3 days → 100% refund   (UC-12)
  //   payment age 4–7 days → 50% refund
  //   payment age >7 days  → 0% refund
  const bookingData = [
    // Student 0 (محمد علي): renewal — PAID, ending in 4 days, within 5-day reminder window
    {
      seedId: "seed-booking-renewal",
      studentIdx: 0,
      propertyId: prop1.id,
      roomVariantId: rooms1[0].id,
      startOffset: -56,
      endOffset: 4,
      status: "PAID",
      paymentDaysAgo: 50,
    },
    // Student 0: completed long ago — owner can see history, ratings page populated
    {
      seedId: "seed-booking-completed-old",
      studentIdx: 0,
      propertyId: prop3.id,
      roomVariantId: "seed-room-3-3",
      startOffset: -120,
      endOffset: -30,
      status: "COMPLETED",
      paymentDaysAgo: 100,
    },
    // Student 1 (يوسف خالد): refund 100% — paid today
    {
      seedId: "seed-booking-refund100",
      studentIdx: 1,
      propertyId: prop1.id,
      roomVariantId: rooms1[1].id,
      startOffset: 30,
      endOffset: 90,
      status: "PAID",
      paymentDaysAgo: 0,
    },
    // Student 1: PENDING — owner uses this to test accept/reject
    {
      seedId: "seed-booking-pending",
      studentIdx: 1,
      propertyId: prop3.id,
      roomVariantId: "seed-room-3-4",
      startOffset: 60,
      endOffset: 120,
      status: "PENDING",
      paymentDaysAgo: null,
    },
    // Student 2 (ريم حسن): refund 50% — paid 5 days ago
    {
      seedId: "seed-booking-refund50",
      studentIdx: 2,
      propertyId: prop3.id,
      roomVariantId: "seed-room-3-1",
      startOffset: 25,
      endOffset: 85,
      status: "PAID",
      paymentDaysAgo: 5,
    },
    // Student 3 (نور أحمد): refund 0% — paid 10 days ago
    {
      seedId: "seed-booking-refund0",
      studentIdx: 3,
      propertyId: prop3.id,
      roomVariantId: "seed-room-3-2",
      startOffset: 20,
      endOffset: 80,
      status: "PAID",
      paymentDaysAgo: 10,
    },
    // Student 0 (محمد علي): already-cancelled booking with a pending refund —
    // gives the admin a refund to review without blocking student cancel-flow
    // on any of the active refund-tier bookings above.
    {
      seedId: "seed-booking-cancelled-prior",
      studentIdx: 0,
      propertyId: prop1.id,
      roomVariantId: rooms1[2].id,
      startOffset: -45,
      endOffset: 45,
      status: "CANCELLED",
      paymentDaysAgo: 30,
    },
    // Student 4 (عمر سعيد): NO booking — clean account
  ];

  for (let i = 0; i < bookingData.length; i++) {
    const b = bookingData[i];
    const booking = await prisma.booking.create({
      data: {
        id: b.seedId,
        startDate: dayOffset(b.startOffset),
        endDate: dayOffset(b.endOffset),
        status: b.status,
        propertyId: b.propertyId,
        roomVariantId: b.roomVariantId,
        studentId: students[b.studentIdx].id,
      },
    });

    // Payment with custom createdAt so refund tier (UC-12) is testable
    if (b.paymentDaysAgo !== null && b.paymentDaysAgo !== undefined) {
      await prisma.payment.create({
        data: {
          amount: 500 + i * 100,
          status: "COMPLETED",
          bookingId: booking.id,
          studentId: students[b.studentIdx].id,
          createdAt: dayOffset(-b.paymentDaysAgo),
        },
      });
    }
  }

  // ── Reviews ──
  const reviewData = [
    {
      studentIdx: 3,
      propertyId: prop1.id,
      rating: 5,
      comment: "سكن ممتاز والخدمات رائعة",
    },
    {
      studentIdx: 0,
      propertyId: prop3.id,
      rating: 4,
      comment: "موقع مميز وقريب من الجامعة",
    },
    {
      studentIdx: 1,
      propertyId: prop3.id,
      rating: 3,
      comment: "جيد بشكل عام لكن يحتاج تحسين النظافة",
    },
  ];

  for (const r of reviewData) {
    await prisma.review.upsert({
      where: {
        propertyId_studentId: {
          propertyId: r.propertyId,
          studentId: students[r.studentIdx].id,
        },
      },
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

  await prisma.withdrawRequest
    .create({
      data: {
        amount: 1000,
        status: "PENDING",
        ownerId: owner1.id,
        bankName: "بنك فلسطين",
        bankAccountHolder: "أحمد نصار",
        bankAccountNumber: "PS12345678901234",
      },
    })
    .catch(() => {}); // ignore if exists

  // ── Refund request — attached to the prior cancelled booking so admin has
  // something to review without blocking student cancel-flow tests above.
  await prisma.refundRequest
    .create({
      data: {
        bookingId: "seed-booking-cancelled-prior",
        studentId: students[0].id,
        originalAmount: 900,
        refundAmount: 450,
        refundPercentage: 50,
        reason: "إلغاء الحجز من قبل الطالب",
        status: "PENDING",
      },
    })
    .catch(() => {});

  console.log("✅ Seeding complete!");
  console.log("");
  console.log("📋 Accounts (password for all: Test1234!):");
  console.log("  Admin:   admin@sknat.com");
  console.log("  Owner1:  ahmad@owner.com         — owns 3 properties");
  console.log("  Owner2:  sara@owner.com          — clean, no properties");
  console.log("");
  console.log("🎯 Per-student test scenarios:");
  console.log(
    "  s11111111@stu.najah.edu  محمد علي    → renewal (ends in 4 days) + completed (rate-able)",
  );
  console.log(
    "  s22222222@stu.najah.edu  يوسف خالد   → refund 100% (paid today) + a PENDING booking for owner",
  );
  console.log(
    "  s33333333@stu.najah.edu  ريم حسن     → refund 50%  (paid 5 days ago)",
  );
  console.log(
    "  s44444444@stu.najah.edu  نور أحمد    → refund 0%   (paid 10 days ago)",
  );
  console.log(
    "  s55555555@stu.najah.edu  عمر سعيد    → CLEAN — no bookings, no anything",
  );
  console.log("");
  console.log("🏠 Properties: 3 (2 apartments, 1 studio)");
  console.log("🛏️ Rooms: 8 variants total");
  console.log("📅 Bookings: 7 (across 5 months)");
  console.log("💳 Payments: 4");
  console.log("⭐ Reviews: 3");
  console.log("💰 Withdrawal request: 1 (pending)");
  console.log("🔄 Refund request: 1 (pending)");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
