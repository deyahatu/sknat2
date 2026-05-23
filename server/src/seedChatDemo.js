// Extra Nablus properties to give the chatbot more search results
// to surface. Run with: node --experimental-strip-types src/seedChatDemo.js
import 'dotenv/config';
import prisma from './utils/prisma.js';

const OWNER_EMAIL = 'ahmad@owner.com';

const PROPERTIES = [
  {
    id: 'demo-prop-101',
    title: 'سكن المنارة',
    kind: 'APARTMENT',
    city: 'رفيديا',
    address: 'شارع رفيديا الرئيسي',
    campus: 'OLD',
    distance: 4,
    description: 'شقة قريبة من الحرم القديم، مفروشة بالكامل، مع تكييف ومدفأة.',
    targetGender: 'MALE',
    sharedServices: ['واي فاي', 'مكيف', 'مدفأة', 'حراسة'],
    bathrooms: 2,
    area: 110,
    rooms: [
      { id: 'demo-room-101-1', name: 'غرفة 1', kind: 'SINGLE', fullPrice: 550 },
      { id: 'demo-room-101-2', name: 'غرفة 2', kind: 'SINGLE', fullPrice: 550 },
      { id: 'demo-room-101-3', name: 'غرفة 3', kind: 'DOUBLE', fullPrice: 900, halfPrice: 450 },
    ],
  },
  {
    id: 'demo-prop-102',
    title: 'استوديو السلام للبنات',
    kind: 'STUDIO',
    city: 'المساكن',
    address: 'شارع المساكن',
    campus: 'NEW',
    distance: 6,
    description: 'استوديو نظيف وحديث للطالبات قريب من الحرم الجديد، مع مطبخ وحمام خاص.',
    targetGender: 'FEMALE',
    sharedServices: ['واي فاي', 'مكيف', 'موقف سيارات'],
    bathrooms: 1,
    area: 35,
    studioPrice: 700,
    rooms: [
      { id: 'demo-room-102-1', name: 'الاستوديو', kind: 'SINGLE', fullPrice: 700 },
    ],
  },
  {
    id: 'demo-prop-103',
    title: 'شقة الأمل الذهبية',
    kind: 'APARTMENT',
    city: 'خلة العامود',
    address: 'شارع فلسطين',
    campus: 'NEW',
    distance: 7,
    description: 'شقة فسيحة بإطلالة جبلية، 4 غرف نوم، صالة كبيرة، مناسبة لمجموعة طلاب.',
    targetGender: 'MALE',
    sharedServices: ['واي فاي', 'مصعد', 'حراسة', 'موقف سيارات'],
    bathrooms: 3,
    area: 160,
    rooms: [
      { id: 'demo-room-103-1', name: 'غرفة 1', kind: 'SINGLE', fullPrice: 600 },
      { id: 'demo-room-103-2', name: 'غرفة 2', kind: 'DOUBLE', fullPrice: 1000, halfPrice: 500 },
      { id: 'demo-room-103-3', name: 'غرفة 3', kind: 'DOUBLE', fullPrice: 1000, halfPrice: 500 },
      { id: 'demo-room-103-4', name: 'غرفة 4', kind: 'SINGLE', fullPrice: 650 },
    ],
  },
  {
    id: 'demo-prop-104',
    title: 'سكن الفرسان للبنات',
    kind: 'APARTMENT',
    city: 'رفيديا',
    address: 'بجانب مستشفى رفيديا',
    campus: 'OLD',
    distance: 2,
    description: 'شقة مخصصة للبنات بأمان عالٍ، حارس على المدخل، قريبة جداً من الحرم القديم.',
    targetGender: 'FEMALE',
    sharedServices: ['واي فاي', 'حراسة', 'مكيف', 'كاميرات مراقبة'],
    bathrooms: 2,
    area: 130,
    rooms: [
      { id: 'demo-room-104-1', name: 'غرفة 1', kind: 'SINGLE', fullPrice: 600 },
      { id: 'demo-room-104-2', name: 'غرفة 2', kind: 'SINGLE', fullPrice: 600 },
      { id: 'demo-room-104-3', name: 'غرفة 3', kind: 'DOUBLE', fullPrice: 950, halfPrice: 475 },
    ],
  },
  {
    id: 'demo-prop-105',
    title: 'استوديو النجاح الذكي',
    kind: 'STUDIO',
    city: 'الجامعة',
    address: 'شارع الحرم الجديد',
    campus: 'NEW',
    distance: 1,
    description: 'استوديو على بعد دقيقتين من الحرم الجديد. مكتب دراسة، إنترنت سريع، تكييف.',
    targetGender: 'MALE',
    sharedServices: ['واي فاي', 'مكيف', 'مكتب دراسة'],
    bathrooms: 1,
    area: 32,
    studioPrice: 750,
    rooms: [
      { id: 'demo-room-105-1', name: 'الاستوديو', kind: 'SINGLE', fullPrice: 750 },
    ],
  },
  {
    id: 'demo-prop-106',
    title: 'شقة الزيتون',
    kind: 'APARTMENT',
    city: 'عسكر',
    address: 'مدخل عسكر',
    campus: 'OLD',
    distance: 12,
    description: 'شقة بسعر اقتصادي، مناسبة للميزانية المحدودة، تتسع لـ 6 طلاب.',
    targetGender: 'MALE',
    sharedServices: ['واي فاي'],
    bathrooms: 2,
    area: 140,
    rooms: [
      { id: 'demo-room-106-1', name: 'غرفة 1', kind: 'DOUBLE', fullPrice: 700, halfPrice: 350 },
      { id: 'demo-room-106-2', name: 'غرفة 2', kind: 'DOUBLE', fullPrice: 700, halfPrice: 350 },
      { id: 'demo-room-106-3', name: 'غرفة 3', kind: 'DOUBLE', fullPrice: 700, halfPrice: 350 },
    ],
  },
  {
    id: 'demo-prop-107',
    title: 'سكن الأطباء للبنات',
    kind: 'APARTMENT',
    city: 'رفيديا',
    address: 'شارع كلية الطب',
    campus: 'OLD',
    distance: 3,
    description: 'شقة فاخرة قريبة من كلية الطب، مناسبة لطالبات الكليات الصحية. مفروشة بالكامل بأثاث حديث.',
    targetGender: 'FEMALE',
    sharedServices: ['واي فاي', 'حراسة', 'مكيف', 'مصعد', 'غسالة'],
    bathrooms: 2,
    area: 120,
    rooms: [
      { id: 'demo-room-107-1', name: 'غرفة 1', kind: 'SINGLE', fullPrice: 800 },
      { id: 'demo-room-107-2', name: 'غرفة 2', kind: 'SINGLE', fullPrice: 800 },
    ],
  },
  {
    id: 'demo-prop-108',
    title: 'بيت الطلاب الاقتصادي',
    kind: 'APARTMENT',
    city: 'المساكن',
    address: 'شارع المساكن الثاني',
    campus: 'NEW',
    distance: 9,
    description: 'سكن بسيط نظيف بسعر مغري للطلاب. مشاركة في كل الخدمات.',
    targetGender: 'MALE',
    sharedServices: ['واي فاي', 'مطبخ مشترك'],
    bathrooms: 2,
    area: 95,
    rooms: [
      { id: 'demo-room-108-1', name: 'غرفة 1', kind: 'DOUBLE', fullPrice: 600, halfPrice: 300 },
      { id: 'demo-room-108-2', name: 'غرفة 2', kind: 'DOUBLE', fullPrice: 600, halfPrice: 300 },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding chat-demo Nablus properties...');
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    console.error(`Owner ${OWNER_EMAIL} not found. Run npm run db:seed first.`);
    process.exit(1);
  }

  for (const p of PROPERTIES) {
    const { rooms, ...propData } = p;
    await prisma.property.upsert({
      where: { id: p.id },
      update: {},
      create: {
        ...propData,
        images: ['/uploads/placeholder-property.jpg'],
        available: true,
        ownerId: owner.id,
      },
    });
    for (const r of rooms) {
      await prisma.roomVariant.upsert({
        where: { id: r.id },
        update: {},
        create: {
          ...r,
          capacity: r.kind === 'DOUBLE' ? 2 : 1,
          area: r.kind === 'DOUBLE' ? 18 : 12,
          services: ['حمام خاص'],
          isOccupied: false,
          propertyId: p.id,
        },
      });
    }
    console.log(`  ✓ ${p.title}`);
  }
  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
