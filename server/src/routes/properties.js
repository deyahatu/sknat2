import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, requireActive } from '../middleware/auth.js';
import { notify, notifyAllAdmins } from '../utils/notify.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

const IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const UPLOAD_URL_REGEX = /^\/uploads\/[\w-]+\.(jpg|jpeg|png|webp)$/i;
const VALID_GENDERS = ['MALE', 'FEMALE'];
const VALID_PROPERTY_KINDS = ['APARTMENT', 'STUDIO'];
const VALID_ROOM_KINDS = ['SINGLE', 'DOUBLE'];
const ROOM_KIND_CAPACITY = { SINGLE: 1, DOUBLE: 2 };

const roomVariantSelect = {
  id: true,
  name: true,
  roomNumber: true,
  kind: true,
  capacity: true,
  area: true,
  isOccupied: true,
  partiallyOccupied: true,
  fullPrice: true,
  halfPrice: true,
  images: true,
  services: true,
  patternName: true,
  patternColor: true,
  propertyId: true,
  createdAt: true,
  updatedAt: true,
};

const propertySelect = {
  id: true,
  title: true,
  kind: true,
  description: true,
  address: true,
  city: true,
  campus: true,
  distance: true,
  sharedServices: true,
  targetGender: true,
  otherServices: true,
  policy: true,
  bathrooms: true,
  area: true,
  images: true,
  available: true,
  disabledByAdmin: true,
  studioPrice: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  roomVariants: { select: roomVariantSelect },
};

function asRequiredString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalString(value) {
  const trimmed = asRequiredString(value);
  return trimmed || null;
}

// Reject text that opens with characters Excel/Sheets treat as formula triggers
// (=, +, -, @, tab, CR). This keeps CSV exports of these fields safe even if a
// future viewer forgets to escape on the way out.
function assertNoFormula(value, fieldName) {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    throw new Error(`لا يمكن أن يبدأ ${fieldName} بالرموز = أو + أو - أو @`);
  }
}

function asPositiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} يجب أن يكون رقماً موجباً.`);
  }

  return number;
}

function asNonNegativeInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} يجب أن يكون صفراً أو أكثر.`);
  }

  return number;
}

function asPositivePrice(value, fieldName = 'السعر') {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} يجب أن يكون رقماً موجباً.`);
  }

  return number;
}

function asBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  throw new Error('حالة التوفر يجب أن تكون true أو false.');
}

function validateImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('يجب رفع صورة واحدة على الأقل.');
  }

  const invalidImage = images.some((image) => (
    typeof image !== 'string' || (!IMAGE_REGEX.test(image) && !UPLOAD_URL_REGEX.test(image))
  ));

  if (invalidImage) {
    throw new Error('يرجى رفع صور صحيحة.');
  }

  return images;
}

function validateServices(services) {
  if (!Array.isArray(services)) {
    throw new Error('الخدمات يجب أن تكون قائمة.');
  }

  const cleanServices = services
    .filter((service) => typeof service === 'string')
    .map((service) => service.trim())
    .filter(Boolean);

  if (cleanServices.length !== services.length) {
    throw new Error('الخدمات يجب أن تحتوي على قيم نصية فقط.');
  }

  return cleanServices;
}

function validateSharedServices(services) {
  if (services === undefined || services === null) return [];
  if (!Array.isArray(services)) {
    throw new Error('الخدمات المشتركة يجب أن تكون قائمة.');
  }
  return services
    .filter((s) => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCreateData(body, ownerId) {
  const title = asRequiredString(body.title || body.name);
  const city = asRequiredString(body.city);
  const description = asOptionalString(body.description);
  const policy = asOptionalString(body.policy);
  const address = asOptionalString(body.address);
  const otherServices = asOptionalString(body.otherServices);
  const campus = asOptionalString(body.campus);
  const targetGender = asRequiredString(body.targetGender || 'MALE').toUpperCase();

  if (!title || !city) {
    throw new Error('يرجى تعبئة اسم السكن والحي.');
  }

  assertNoFormula(title, 'اسم السكن');
  assertNoFormula(city, 'الحي');
  assertNoFormula(description, 'الوصف');
  assertNoFormula(policy, 'السياسة');
  assertNoFormula(address, 'العنوان');
  assertNoFormula(otherServices, 'الخدمات الإضافية');
  assertNoFormula(campus, 'الحرم الجامعي');

  if (!VALID_GENDERS.includes(targetGender)) {
    throw new Error('الجنس المستهدف يجب أن يكون MALE أو FEMALE.');
  }

  const kind = asRequiredString(body.kind || 'APARTMENT').toUpperCase();
  if (!VALID_PROPERTY_KINDS.includes(kind)) {
    throw new Error('نوع العقار يجب أن يكون APARTMENT أو STUDIO.');
  }

  const sharedServices = validateSharedServices(body.sharedServices);
  if (!Array.isArray(body.images) || body.images.length === 0) {
    throw new Error('يرجى رفع صورة واحدة على الأقل للسكن.');
  }
  const images = validateImages(body.images);
  const available = body.available === undefined ? true : asBoolean(body.available);

  return {
    title,
    kind,
    city,
    address,
    description,
    policy,
    campus,
    sharedServices,
    otherServices,
    targetGender,
    images,
    available,
    ownerId,
    ...(body.distance !== undefined && body.distance !== null && body.distance !== '' && {
      distance: asNonNegativeInteger(body.distance, 'المسافة'),
    }),
    ...(body.studioPrice !== undefined && body.studioPrice !== null && body.studioPrice !== '' && {
      studioPrice: asPositivePrice(body.studioPrice, 'سعر الاستوديو'),
    }),
    ...(body.bathrooms !== undefined && body.bathrooms !== null && body.bathrooms !== '' && {
      bathrooms: asPositiveInteger(body.bathrooms, 'عدد الحمامات'),
    }),
    ...(body.area !== undefined && body.area !== null && body.area !== '' && {
      area: asPositiveInteger(body.area, 'المساحة'),
    }),
  };
}

function buildUpdateData(body) {
  const data = {};

  if (body.title !== undefined || body.name !== undefined) {
    const title = asRequiredString(body.title || body.name);
    if (!title) throw new Error('اسم السكن لا يمكن أن يكون فارغاً.');
    assertNoFormula(title, 'اسم السكن');
    data.title = title;
  }

  if (body.kind !== undefined) {
    const kind = asRequiredString(body.kind).toUpperCase();
    if (!VALID_PROPERTY_KINDS.includes(kind)) {
      throw new Error('نوع العقار يجب أن يكون APARTMENT أو STUDIO.');
    }
    data.kind = kind;
  }

  if (body.city !== undefined) {
    const city = asRequiredString(body.city);
    if (!city) throw new Error('الحي لا يمكن أن يكون فارغاً.');
    assertNoFormula(city, 'الحي');
    data.city = city;
  }

  if (body.address !== undefined) {
    data.address = asOptionalString(body.address);
    assertNoFormula(data.address, 'العنوان');
  }
  if (body.description !== undefined) {
    data.description = asOptionalString(body.description);
    assertNoFormula(data.description, 'الوصف');
  }
  if (body.policy !== undefined) {
    data.policy = asOptionalString(body.policy);
    assertNoFormula(data.policy, 'السياسة');
  }
  if (body.campus !== undefined) {
    data.campus = asOptionalString(body.campus);
    assertNoFormula(data.campus, 'الحرم الجامعي');
  }

  if (body.distance !== undefined) {
    data.distance = body.distance === null || body.distance === ''
      ? null
      : asNonNegativeInteger(body.distance, 'المسافة');
  }

  if (body.studioPrice !== undefined) {
    data.studioPrice = body.studioPrice === null || body.studioPrice === ''
      ? null
      : asPositivePrice(body.studioPrice, 'سعر الاستوديو');
  }

  if (body.sharedServices !== undefined) {
    data.sharedServices = validateSharedServices(body.sharedServices);
  }

  if (body.bathrooms !== undefined) data.bathrooms = asPositiveInteger(body.bathrooms, 'عدد الحمامات');
  if (body.area !== undefined) data.area = body.area === null || body.area === '' ? null : asPositiveInteger(body.area, 'المساحة');

  if (body.targetGender !== undefined) {
    const targetGender = asRequiredString(body.targetGender).toUpperCase();
    if (!VALID_GENDERS.includes(targetGender)) {
      throw new Error('الجنس المستهدف يجب أن يكون MALE أو FEMALE.');
    }
    data.targetGender = targetGender;
  }

  if (body.otherServices !== undefined) {
    data.otherServices = asOptionalString(body.otherServices);
    assertNoFormula(data.otherServices, 'الخدمات الإضافية');
  }

  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length === 0) {
      throw new Error('يرجى رفع صورة واحدة على الأقل للسكن.');
    }
    data.images = validateImages(body.images);
  }

  if (body.available !== undefined) {
    data.available = asBoolean(body.available);
  }

  return data;
}

async function findOwnerProperty(propertyId, ownerId) {
  return prisma.property.findFirst({
    where: {
      id: propertyId,
      ownerId,
    },
    select: propertySelect,
  });
}

// ───────────────────────────────────────────────
// Public: list available properties with filters
// ───────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  // Optional auth — try to get user gender for sorting, and role so admins
  // can see properties of blocked owners (which are otherwise filtered out).
  let userGender = null;
  let userRole = null;
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { verifyToken } = await import('../utils/jwt.js');
      const decoded = verifyToken(token);
      const u = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { gender: true, role: true } });
      if (u?.gender) userGender = u.gender;
      if (u?.role) userRole = u.role;
    }
  } catch { /* not logged in — fine */ }
  try {
    const {
      q,
      city,
      minPrice,
      maxPrice,
      targetGender,
      services,
      kind,
      campus,
      roomKind,
      maxDistance,
      sort,
      limit,
    } = req.query;

    // A property is listable if:
    //  - it has at least one room variant (apartment), OR
    //  - it's a STUDIO with a price set
    // AND (for non-admin viewers) its owner is not currently blocked.
    const where = {
      deletedAt: null,
      AND: [
        {
          OR: [
            { roomVariants: { some: {} } },
            { kind: 'STUDIO', studioPrice: { not: null } },
          ],
        },
        ...(userRole === 'ADMIN' ? [] : [{ owner: { isActive: true } }]),
      ],
    };

    if (q) {
      where.AND.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (targetGender && VALID_GENDERS.includes(targetGender.toUpperCase())) {
      where.targetGender = targetGender.toUpperCase();
    }

    // Property kind filter (APARTMENT / STUDIO)
    if (kind && VALID_PROPERTY_KINDS.includes(kind.toUpperCase())) {
      where.kind = kind.toUpperCase();
    }

    // Campus filter (OLD / NEW)
    if (campus) where.campus = campus;

    // Max distance from campus (in minutes)
    if (maxDistance) {
      const dist = Number(maxDistance);
      if (Number.isFinite(dist) && dist >= 0) {
        where.distance = { lte: dist };
      }
    }

    // Price filter — match either a variant in range or a studio price in range
    if (minPrice || maxPrice) {
      const priceFilter = {
        ...(minPrice && { gte: Number(minPrice) }),
        ...(maxPrice && { lte: Number(maxPrice) }),
      };
      where.AND.push({
        OR: [
          { roomVariants: { some: { fullPrice: priceFilter } } },
          { kind: 'STUDIO', studioPrice: priceFilter },
        ],
      });
    }

    // Room kind filter (SINGLE / DOUBLE) — only meaningful for APARTMENT
    if (roomKind && VALID_ROOM_KINDS.includes(roomKind.toUpperCase())) {
      where.AND.push({
        roomVariants: { some: { kind: roomKind.toUpperCase() } },
      });
    }

    if (services) {
      const list = Array.isArray(services) ? services : services.split(',');
      const cleaned = list.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length > 0) {
        where.AND.push({
          sharedServices: { hasEvery: cleaned },
        });
      }
    }

    const properties = await prisma.property.findMany({
      where,
      select: {
        ...propertySelect,
        // The list endpoint is unauthenticated. We expose only the owner's
        // display fields; phone/email are reserved for the detail endpoint so
        // scrapers can't harvest every owner's contact info in a single call.
        owner: { select: { id: true, name: true, isActive: true } },
        reviews: { select: { rating: true } },
        _count: { select: { reviews: true } },
        bookings: userRole === 'ADMIN'
          ? { where: { status: { in: ['APPROVED', 'PAID'] } }, select: { id: true } }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Inject avgRating per property; strip raw reviews from payload.
    // For admins, also surface the active-booking count so the admin table
    // can warn before disabling/deleting a busy property.
    const decorated = properties.map((p) => {
      const ratings = p.reviews || [];
      const avgRating = ratings.length
        ? Number((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1))
        : 0;
      const { reviews: _ignored, bookings, ...rest } = p;
      const result = { ...rest, avgRating };
      if (Array.isArray(bookings)) {
        result.activeBookingsCount = bookings.length;
      }
      return result;
    });

    // Sort
    if (sort === 'rating') {
      decorated.sort((a, b) => b.avgRating - a.avgRating || new Date(b.createdAt) - new Date(a.createdAt));
    } else if (userGender && !targetGender) {
      decorated.sort((a, b) => {
        const aMatch = a.targetGender === userGender ? 0 : 1;
        const bMatch = b.targetGender === userGender ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    const maxResults = limit ? Math.min(Math.max(Number(limit), 1), 50) : undefined;
    res.json({ properties: maxResults ? decorated.slice(0, maxResults) : decorated });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await prisma.property.create({
      data: buildCreateData(req.body, req.user.id),
      select: propertySelect,
    });

    logAudit({ action: 'CREATE', entity: 'PROPERTY', entityId: property.id, user: req.user, details: property.title });

    notifyAllAdmins(
      'عقار جديد',
      `${req.user.name} أضاف عقار: ${property.title}`,
      '/admin',
    ).catch(() => {});

    res.status(201).json({
      message: 'تم إنشاء السكن بنجاح.',
      property,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/mine', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id, deletedAt: null },
      select: {
        ...propertySelect,
        _count: {
          select: {
            bookings: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ properties });
  } catch (err) {
    next(err);
  }
});

router.get('/ratings', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const ratings = await prisma.review.findMany({
      where: {
        property: {
          ownerId: req.user.id,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            address: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ratings });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/ratings', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);

    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const ratings = await prisma.review.findMany({
      where: { propertyId: property.id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ property, ratings });
  } catch (err) {
    next(err);
  }
});

// Public: view single property details
router.get('/:id', async (req, res, next) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      select: {
        ...propertySelect,
        owner: { select: { id: true, name: true, phone: true, email: true } },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            student: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    // Get majors of current tenants (active bookings)
    const activeBookings = await prisma.booking.findMany({
      where: {
        propertyId: req.params.id,
        status: { in: ['APPROVED', 'PAID'] },
      },
      select: {
        student: { select: { major: true } },
      },
    });

    const tenantMajors = [...new Set(
      activeBookings.map(b => b.student?.major).filter(Boolean)
    )];

    // Surface this so the owner edit page can disable sensitive fields up-front
    // instead of letting the owner fill the form and fail at save time.
    const hasActiveBookings = activeBookings.length > 0;

    // Per-room: which variants currently have an in-app booking holding them.
    // The edit UI uses this to lock those rooms so the owner can't edit price/
    // kind / status until the booking ends.
    const lockedRoomBookings = await prisma.booking.findMany({
      where: {
        propertyId: req.params.id,
        status: { in: ['APPROVED', 'PAID'] },
      },
      select: { roomVariantId: true },
    });
    const lockedRoomIds = [
      ...new Set(lockedRoomBookings.map((b) => b.roomVariantId)),
    ];

    res.json({ property, tenantMajors, hasActiveBookings, lockedRoomIds });
  } catch (err) {
    next(err);
  }
});

// Fields that materially change what a student agreed to when they booked.
// Editing any of these is blocked while the property has active bookings —
// services / description / images / policy etc. stay freely editable.
const SENSITIVE_PROPERTY_FIELDS = ['targetGender', 'address', 'city', 'campus', 'kind'];

router.put('/:id', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const existing = await findOwnerProperty(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const updateData = buildUpdateData(req.body);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات سكن للتحديث.' });
    }

    // Determine whether the diff touches any sensitive field (i.e. the value
    // actually changes — sending the same value back is a no-op and allowed).
    const sensitiveTouched = SENSITIVE_PROPERTY_FIELDS.some(
      (f) => f in updateData && updateData[f] !== existing[f],
    );

    if (sensitiveTouched) {
      const activeBookings = await prisma.booking.count({
        where: {
          propertyId: existing.id,
          status: { in: ['APPROVED', 'PAID'] },
        },
      });
      if (activeBookings > 0) {
        return res.status(400).json({
          error: 'لا يمكن تعديل (الجنس المستهدف / العنوان / المدينة / النوع) بينما توجد حجوزات نشطة على السكن. باقي البيانات (الخدمات، الوصف، الصور...) يمكن تعديلها.',
        });
      }
    }

    const property = await prisma.property.update({
      where: { id: existing.id },
      data: updateData,
      select: propertySelect,
    });

    res.json({
      message: 'تم تحديث السكن بنجاح.',
      property,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.patch('/:id/availability', authenticate, requireActive, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const existing = isAdmin
      ? await prisma.property.findUnique({ where: { id: req.params.id }, select: propertySelect })
      : await findOwnerProperty(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const nextAvailable = asBoolean(req.body.available);

    // If an admin previously disabled this listing, the owner can't bring it
    // back online — they must contact support. Prevents the workflow where an
    // owner bypasses moderation by simply toggling the flag back themselves.
    if (!isAdmin && existing.disabledByAdmin && nextAvailable) {
      return res.status(403).json({
        error: 'تم تعطيل هذا السكن من قبل الإدارة. لا يمكنك إعادة تفعيله. تواصل مع الدعم.',
      });
    }

    // Refuse to mark unavailable while students still have confirmed bookings —
    // that would silently strand paying tenants. Admins bypass since they may
    // need to disable a problematic listing despite active bookings.
    if (!nextAvailable && !isAdmin) {
      const activeBookings = await prisma.booking.count({
        where: {
          propertyId: existing.id,
          status: { in: ['APPROVED', 'PAID'] },
        },
      });
      if (activeBookings > 0) {
        return res.status(400).json({
          error: 'لا يمكن تعطيل السكن بينما توجد حجوزات نشطة. يرجى إكمالها أو إلغاؤها أولاً.',
        });
      }
    }

    // Admin actions stamp/clear the moderation flag; owner actions don't touch it.
    const updateData = { available: nextAvailable };
    if (isAdmin) {
      updateData.disabledByAdmin = !nextAvailable;
    }

    const property = await prisma.property.update({
      where: { id: existing.id },
      data: updateData,
      select: propertySelect,
    });

    // If an admin disabled a property that still has active residents, notify
    // them so they're not blindsided. (Owner self-disable already blocks above.)
    if (!nextAvailable && isAdmin) {
      const residents = await prisma.booking.findMany({
        where: {
          propertyId: existing.id,
          status: { in: ['APPROVED', 'PAID'] },
        },
        select: { studentId: true },
      });
      const uniqueStudents = [...new Set(residents.map((r) => r.studentId))];
      for (const sid of uniqueStudents) {
        notify(
          sid,
          'تم تعطيل سكنك من الإدارة',
          `تم تعطيل "${existing.title}" مؤقتاً من قبل الإدارة. حجزك لا يزال نشطاً، لكن لن يتم إرسال طلبات تجديد. للاستفسار، تواصل مع الدعم.`,
          '/bookings',
        ).catch(() => {});
      }
    }

    res.json({
      message: 'تم تحديث حالة التوفر بنجاح.',
      property,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/:id', authenticate, requireActive, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';
    const existing = isAdmin
      ? await prisma.property.findUnique({ where: { id: req.params.id }, select: propertySelect })
      : await findOwnerProperty(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    // Owners can't escape an admin disable by deleting + re-adding the listing.
    if (!isAdmin && existing.disabledByAdmin) {
      return res.status(403).json({
        error: 'تم تعطيل هذا السكن من قبل الإدارة. لا يمكنك حذفه. تواصل مع الدعم.',
      });
    }

    const activeBookings = await prisma.booking.count({
      where: {
        propertyId: existing.id,
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
      },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ error: 'هذا السكن لديه حجوزات نشطة. لا يمكن حذفه.' });
    }

    await prisma.property.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), available: false },
    });
    logAudit({ action: 'DELETE', entity: 'PROPERTY', entityId: existing.id, user: req.user, details: existing.title });
    res.json({ message: 'تم حذف السكن بنجاح.' });
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────────
// RoomVariant CRUD (nested under property)
// ───────────────────────────────────────────────

function buildVariantData(body) {
  const name = asRequiredString(body.name);
  if (!name) throw new Error('اسم الغرفة مطلوب.');

  const kind = asRequiredString(body.kind || 'SINGLE').toUpperCase();
  if (!VALID_ROOM_KINDS.includes(kind)) {
    throw new Error('نوع الغرفة يجب أن يكون SINGLE أو DOUBLE.');
  }

  const capacity = body.capacity !== undefined && body.capacity !== null && body.capacity !== ''
    ? asPositiveInteger(body.capacity, 'القدرة الاستيعابية')
    : ROOM_KIND_CAPACITY[kind];

  const area = body.area === undefined || body.area === null || body.area === ''
    ? null
    : asPositiveInteger(body.area, 'مساحة الغرفة');

  const fullPrice = asPositivePrice(body.fullPrice, 'سعر الغرفة');
  const halfPrice = body.halfPrice !== undefined && body.halfPrice !== null && body.halfPrice !== ''
    ? asPositivePrice(body.halfPrice, 'سعر نصف الغرفة')
    : null;
  const images = body.images?.length ? validateImages(body.images) : [];
  const services = body.services?.length ? validateServices(body.services) : [];

  // Newly-created rooms always start vacant. Occupancy is computed from
  // active bookings — never accepted from the client.
  return {
    name,
    roomNumber: asOptionalString(body.roomNumber),
    kind,
    capacity,
    area,
    isOccupied: false,
    partiallyOccupied: false,
    fullPrice,
    halfPrice,
    images,
    services,
    patternName: asOptionalString(body.patternName),
    patternColor: asOptionalString(body.patternColor),
  };
}

// Maximum rooms per property. Kept here (not exposed to clients) to avoid
// signalling the exact cap; the rejection message stays generic by design.
const MAX_ROOMS_PER_PROPERTY = 5;

// Add room variant to property
router.post('/:id/variants', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);
    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const existingCount = await prisma.roomVariant.count({ where: { propertyId: property.id } });
    if (existingCount >= MAX_ROOMS_PER_PROPERTY) {
      return res.status(400).json({ error: 'لا يمكن إضافة المزيد من الغرف لهذا السكن.' });
    }

    const variant = await prisma.roomVariant.create({
      data: { ...buildVariantData(req.body), propertyId: property.id },
      select: roomVariantSelect,
    });

    res.status(201).json({
      message: 'تم إضافة الغرفة بنجاح.',
      variant,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Bulk-create room variants (used by the wizard)
router.post('/:id/variants/bulk', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);
    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const list = Array.isArray(req.body.variants) ? req.body.variants : [];
    if (list.length === 0) {
      return res.status(400).json({ error: 'لا توجد غرف لإضافتها.' });
    }

    const existingCount = await prisma.roomVariant.count({ where: { propertyId: property.id } });
    if (existingCount + list.length > MAX_ROOMS_PER_PROPERTY) {
      return res.status(400).json({ error: 'لا يمكن إضافة المزيد من الغرف لهذا السكن.' });
    }

    const dataList = list.map((v) => ({ ...buildVariantData(v), propertyId: property.id }));

    await prisma.$transaction(
      dataList.map((d) => prisma.roomVariant.create({ data: d })),
    );

    const variants = await prisma.roomVariant.findMany({
      where: { propertyId: property.id },
      select: roomVariantSelect,
      orderBy: { createdAt: 'asc' },
    });

    res.status(201).json({
      message: `تم إضافة ${dataList.length} غرفة بنجاح.`,
      variants,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Get all variants for a property
router.get('/:id/variants', async (req, res, next) => {
  try {
    const variants = await prisma.roomVariant.findMany({
      where: { propertyId: req.params.id },
      select: roomVariantSelect,
      orderBy: { createdAt: 'asc' },
    });

    res.json({ variants });
  } catch (err) {
    next(err);
  }
});

// Update a room variant
router.put('/:id/variants/:variantId', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);
    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const existing = await prisma.roomVariant.findFirst({
      where: { id: req.params.variantId, propertyId: property.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'نوع الغرفة غير موجود.' });
    }

    // Refuse any modification while the room has active bookings. Changing
    // kind/price/name/area mid-stay breaks the deal a student already paid for.
    const activeOnRoom = await prisma.booking.count({
      where: {
        roomVariantId: existing.id,
        status: { in: ['APPROVED', 'PAID'] },
      },
    });
    if (activeOnRoom > 0) {
      return res.status(400).json({
        error: 'لا يمكن تعديل هذه الغرفة بينما توجد حجوزات نشطة عليها. يمكن التعديل بعد انتهاء أو إلغاء الحجوزات.',
      });
    }

    const data = {};

    if (req.body.name !== undefined) {
      const name = asRequiredString(req.body.name);
      if (!name) throw new Error('اسم الغرفة لا يمكن أن يكون فارغاً.');
      data.name = name;
    }

    if (req.body.kind !== undefined) {
      const kind = asRequiredString(req.body.kind).toUpperCase();
      if (!VALID_ROOM_KINDS.includes(kind)) {
        throw new Error('نوع الغرفة يجب أن يكون SINGLE أو DOUBLE.');
      }
      data.kind = kind;
      // If kind changes to SINGLE and it was partial, clear it
      if (kind === 'SINGLE') data.partiallyOccupied = false;
    }

    if (req.body.roomNumber !== undefined) data.roomNumber = asOptionalString(req.body.roomNumber);
    if (req.body.capacity !== undefined) data.capacity = asPositiveInteger(req.body.capacity, 'القدرة الاستيعابية');
    if (req.body.area !== undefined) {
      data.area = req.body.area === null || req.body.area === ''
        ? null
        : asPositiveInteger(req.body.area, 'مساحة الغرفة');
    }
    if (req.body.fullPrice !== undefined) data.fullPrice = asPositivePrice(req.body.fullPrice, 'سعر الغرفة');
    if (req.body.halfPrice !== undefined) data.halfPrice = req.body.halfPrice === null ? null : asPositivePrice(req.body.halfPrice, 'سعر نصف الغرفة');
    if (req.body.images !== undefined) data.images = req.body.images?.length ? validateImages(req.body.images) : [];
    if (req.body.services !== undefined) data.services = validateServices(req.body.services);
    if (req.body.patternName !== undefined) data.patternName = asOptionalString(req.body.patternName);
    if (req.body.patternColor !== undefined) data.patternColor = asOptionalString(req.body.patternColor);
    // Note: isOccupied / partiallyOccupied are NOT accepted from the client.
    // They're derived from active bookings (see booking accept/cancel/complete
    // flows). Allowing the owner to flip them lets them free a room out from
    // under a paying student and enable double-booking. Any value sent here
    // is silently ignored.

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات للتحديث.' });
    }

    const variant = await prisma.roomVariant.update({
      where: { id: existing.id },
      data,
      select: roomVariantSelect,
    });

    res.json({
      message: 'تم تحديث نوع الغرفة بنجاح.',
      variant,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Manually toggle a room's occupancy state for external (off-app) holds.
// Separate from the regular variant edit so the owner can still mark a room
// as taken / free in cases that don't go through the in-app booking flow,
// without exposing isOccupied to other endpoints. Any in-app APPROVED/PAID
// booking for the room blocks the change — the system is authoritative.
router.patch('/:id/variants/:variantId/manual-status', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);
    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const existing = await prisma.roomVariant.findFirst({
      where: { id: req.params.variantId, propertyId: property.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'الغرفة غير موجودة.' });
    }

    const status = asRequiredString(req.body.status).toUpperCase();
    const VALID_MANUAL_STATUSES = ['AVAILABLE', 'OCCUPIED', 'PARTIAL'];
    if (!VALID_MANUAL_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'الحالة يجب أن تكون AVAILABLE أو OCCUPIED أو PARTIAL.',
      });
    }

    if (status === 'PARTIAL' && existing.kind === 'SINGLE') {
      return res.status(400).json({
        error: 'لا يمكن تعليم غرفة فردية كنصف محجوزة.',
      });
    }

    // Refuse if any in-app booking is holding the room. The booking
    // accept/cancel/complete flows are the only writers of isOccupied in
    // that case — owner intervention would desync the two.
    const inAppBooking = await prisma.booking.findFirst({
      where: {
        roomVariantId: existing.id,
        status: { in: ['APPROVED', 'PAID'] },
      },
      select: { id: true },
    });
    if (inAppBooking) {
      return res.status(400).json({
        error: 'هذه الغرفة محجوزة عبر التطبيق. لا يمكن تغيير حالتها يدوياً.',
      });
    }

    const newState =
      status === 'OCCUPIED'
        ? { isOccupied: true, partiallyOccupied: false }
        : status === 'PARTIAL'
          ? { isOccupied: false, partiallyOccupied: true }
          : { isOccupied: false, partiallyOccupied: false };

    const variant = await prisma.roomVariant.update({
      where: { id: existing.id },
      data: newState,
      select: roomVariantSelect,
    });

    res.json({
      message: 'تم تحديث حالة الغرفة بنجاح.',
      variant,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Delete a room variant
router.delete('/:id/variants/:variantId', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);
    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const existing = await prisma.roomVariant.findFirst({
      where: { id: req.params.variantId, propertyId: property.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'نوع الغرفة غير موجود.' });
    }

    const activeBookings = await prisma.booking.count({
      where: {
        roomVariantId: existing.id,
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
      },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ error: 'نوع الغرفة لديه حجوزات نشطة. لا يمكن حذفه.' });
    }

    await prisma.roomVariant.delete({ where: { id: existing.id } });
    res.json({ message: 'تم حذف نوع الغرفة بنجاح.' });
  } catch (err) {
    next(err);
  }
});

export default router;
