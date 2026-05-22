import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from './prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAQ_PATH = resolve(__dirname, '../data/faq.json');

let _faqCache = null;
async function loadFaq() {
  if (!_faqCache) {
    const raw = await readFile(FAQ_PATH, 'utf8');
    _faqCache = JSON.parse(raw);
  }
  return _faqCache;
}

export const TOOL_DEFS = [
  {
    name: 'search_properties',
    description:
      "Search Sakanat (Nablus / An-Najah University) student housing listings. All listings are in Nablus by definition — DO NOT pass 'نابلس' or 'Nablus' as the neighborhood filter. The neighborhood field holds Nablus sub-areas like رفيديا (Rafidia), المساكن, خلة العامود, etc. Use 'campus' to filter by university campus (OLD = الحرم القديم, NEW = الحرم الجديد). Use propertyKind for apartment vs studio. Returns up to 10 listings.",
    access: 'public',
    input_schema: {
      type: 'object',
      properties: {
        neighborhood: { type: 'string', description: 'Nablus neighborhood name (e.g., رفيديا, المساكن). Omit unless the user names a specific area.' },
        maxPrice: { type: 'number', description: 'Maximum monthly price per person in ₪ (ILS shekels)' },
        propertyKind: { type: 'string', enum: ['APARTMENT', 'STUDIO'] },
        targetGender: { type: 'string', enum: ['MALE', 'FEMALE'], description: 'Target audience: MALE = ذكور, FEMALE = إناث' },
        campus: { type: 'string', enum: ['OLD', 'NEW'], description: 'An-Najah campus: OLD = الحرم القديم, NEW = الحرم الجديد' },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      },
    },
  },
  {
    name: 'get_my_bookings',
    description: "Get the current user's bookings. Available to all authenticated users.",
    access: 'authed',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'COMPLETED', 'REJECTED'],
          default: 'all',
        },
      },
    },
  },
  {
    name: 'get_my_properties',
    description: "Get properties owned by the current user. Only available to OWNER role.",
    access: 'owner',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_wallet',
    description: "Get the current user's wallet balance and recent transactions.",
    access: 'authed',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
      },
    },
  },
  {
    name: 'get_faq',
    description:
      "Look up Sakanat FAQ or policy text by topic key. Topics: refund, payment, withdrawal, booking_process, property_listing, account, support, fees, about.",
    access: 'public',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: [
            'refund',
            'payment',
            'withdrawal',
            'booking_process',
            'property_listing',
            'account',
            'support',
            'fees',
            'about',
          ],
        },
      },
      required: ['topic'],
    },
  },
];

export function filterToolsByAccess({ userId, userRole }) {
  return TOOL_DEFS.filter((tool) => {
    if (tool.access === 'public') return true;
    if (!userId) return false;
    if (tool.access === 'authed') return true;
    if (tool.access === 'owner') return userRole === 'OWNER';
    return false;
  }).map(({ access: _, ...rest }) => rest);
}

const EXECUTORS = {
  async search_properties(_ctx, args = {}) {
    const where = {
      available: true,
      disabledByAdmin: false,
      deletedAt: null,
    };
    // Guard against the model passing "Nablus" / "نابلس" as a neighborhood — that's the
    // city, not a sub-area, and would always return zero hits.
    const nablusAliases = ['nablus', 'النابلس', 'نابلس'];
    const neighborhood = args.neighborhood?.trim();
    if (neighborhood && !nablusAliases.includes(neighborhood.toLowerCase())) {
      where.city = { contains: neighborhood, mode: 'insensitive' };
    }
    if (args.propertyKind) where.kind = args.propertyKind;
    if (args.targetGender) where.targetGender = args.targetGender;
    if (args.campus === 'OLD' || args.campus === 'NEW') where.campus = args.campus;

    const limit = Math.min(Math.max(args.limit || 5, 1), 10);
    const properties = await prisma.property.findMany({
      where,
      take: limit * 2,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        city: true,
        campus: true,
        distance: true,
        kind: true,
        targetGender: true,
        studioPrice: true,
        images: true,
        roomVariants: {
          select: { kind: true, fullPrice: true, halfPrice: true, isOccupied: true },
        },
      },
    });

    const filtered = properties
      .map((p) => {
        const prices = [];
        if (p.studioPrice) prices.push(Number(p.studioPrice));
        for (const v of p.roomVariants || []) {
          if (v.isOccupied) continue;
          const perPerson = v.kind === 'DOUBLE' && v.halfPrice != null ? v.halfPrice : v.fullPrice;
          if (perPerson != null) prices.push(Number(perPerson));
        }
        const minPrice = prices.length ? Math.min(...prices) : null;
        return { ...p, minPrice };
      })
      .filter((p) => {
        if (args.maxPrice == null) return true;
        return p.minPrice != null && p.minPrice <= args.maxPrice;
      })
      .slice(0, limit);

    return {
      count: filtered.length,
      properties: filtered.map((p) => ({
        id: p.id,
        title: p.title,
        city: p.city,
        campus: p.campus,
        distance: p.distance,
        kind: p.kind,
        targetGender: p.targetGender,
        minPrice: p.minPrice,
        image: p.images?.[0] || null,
        url: `/properties/${p.id}`,
      })),
    };
  },

  async get_my_bookings(ctx, args = {}) {
    if (!ctx.userId) throw new Error('Authentication required');
    const where = { studentId: ctx.userId };
    if (args.status && args.status !== 'all') where.status = args.status;

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        monthlyPrice: true,
        createdAt: true,
        property: { select: { id: true, title: true, city: true } },
      },
    });

    return {
      count: bookings.length,
      bookings: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        startDate: b.startDate,
        endDate: b.endDate,
        monthlyPrice: b.monthlyPrice != null ? Number(b.monthlyPrice) : null,
        property: b.property,
        url: `/bookings/${b.id}`,
      })),
    };
  },

  async get_my_properties(ctx) {
    if (!ctx.userId) throw new Error('Authentication required');
    if (ctx.userRole !== 'OWNER') throw new Error('Owner role required');

    const properties = await prisma.property.findMany({
      where: { ownerId: ctx.userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        city: true,
        available: true,
        disabledByAdmin: true,
        _count: { select: { bookings: true, reviews: true } },
      },
    });

    return {
      count: properties.length,
      properties: properties.map((p) => ({
        id: p.id,
        title: p.title,
        city: p.city,
        status: p.disabledByAdmin
          ? 'disabled_by_admin'
          : p.available
            ? 'active'
            : 'unavailable',
        bookingsCount: p._count.bookings,
        reviewsCount: p._count.reviews,
        url: `/properties/${p.id}`,
      })),
    };
  },

  async get_my_wallet(ctx, args = {}) {
    if (!ctx.userId) throw new Error('Authentication required');
    const wallet = await prisma.wallet.findUnique({
      where: { ownerId: ctx.userId },
      select: { balance: true, updatedAt: true },
    });

    const limit = Math.min(Math.max(args.limit || 5, 1), 20);
    const payments = await prisma.payment.findMany({
      where: { studentId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, amount: true, status: true, createdAt: true },
    });

    return {
      balance: wallet ? Number(wallet.balance) : 0,
      currency: 'SAR',
      walletApplies: ctx.userRole === 'OWNER',
      recentPayments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        date: p.createdAt,
      })),
    };
  },

  async get_faq(_ctx, args = {}) {
    const faq = await loadFaq();
    const entry = faq[args.topic];
    if (!entry) return { error: 'Topic not found', topic: args.topic };
    return { topic: args.topic, ...entry };
  },
};

export async function executeTool(name, ctx, args) {
  const fn = EXECUTORS[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return await fn(ctx, args);
}
