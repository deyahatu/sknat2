import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

const IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const VALID_GENDERS = ['MALE', 'FEMALE'];

const roomVariantSelect = {
  id: true,
  name: true,
  roomNumber: true,
  capacity: true,
  isOccupied: true,
  fullPrice: true,
  halfPrice: true,
  images: true,
  services: true,
  propertyId: true,
  createdAt: true,
  updatedAt: true,
};

const propertySelect = {
  id: true,
  title: true,
  description: true,
  address: true,
  city: true,
  targetGender: true,
  otherServices: true,
  policy: true,
  bathrooms: true,
  area: true,
  images: true,
  available: true,
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
    typeof image !== 'string' || !IMAGE_REGEX.test(image)
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

function buildCreateData(body, ownerId) {
  const title = asRequiredString(body.title || body.name);
  const city = asRequiredString(body.city);
  const address = asRequiredString(body.address);
  const description = asRequiredString(body.description);
  const policy = asRequiredString(body.policy);
  const otherServices = asOptionalString(body.otherServices);
  const targetGender = asRequiredString(body.targetGender).toUpperCase();

  if (!title || !city || !address || !description || !policy) {
    throw new Error('يرجى تعبئة جميع حقول السكن المطلوبة.');
  }

  if (!VALID_GENDERS.includes(targetGender)) {
    throw new Error('الجنس المستهدف يجب أن يكون MALE أو FEMALE.');
  }

  const images = validateImages(body.images);
  const available = asBoolean(body.available);

  return {
    title,
    city,
    address,
    description,
    policy,
    otherServices,
    targetGender,
    images,
    available,
    ownerId,
    ...(body.bathrooms !== undefined && { bathrooms: asPositiveInteger(body.bathrooms, 'عدد الحمامات') }),
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
    data.title = title;
  }

  if (body.city !== undefined) {
    const city = asRequiredString(body.city);
    if (!city) throw new Error('المدينة لا يمكن أن تكون فارغة.');
    data.city = city;
  }

  if (body.address !== undefined) {
    const address = asRequiredString(body.address);
    if (!address) throw new Error('العنوان لا يمكن أن يكون فارغاً.');
    data.address = address;
  }

  if (body.description !== undefined) {
    const description = asRequiredString(body.description);
    if (!description) throw new Error('الوصف لا يمكن أن يكون فارغاً.');
    data.description = description;
  }

  if (body.policy !== undefined) {
    const policy = asRequiredString(body.policy);
    if (!policy) throw new Error('سياسة السكن لا يمكن أن تكون فارغة.');
    data.policy = policy;
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
  }

  if (body.images !== undefined) {
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
  try {
    const {
      q,
      city,
      minPrice,
      maxPrice,
      bathrooms,
      targetGender,
      services,
    } = req.query;

    const where = { available: true, roomVariants: { some: {} } };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (city) where.city = { contains: city, mode: 'insensitive' };

    if (minPrice || maxPrice) {
      where.roomVariants = {
        some: {
          fullPrice: {
            ...(minPrice && { gte: Number(minPrice) }),
            ...(maxPrice && { lte: Number(maxPrice) }),
          },
        },
      };
    }

    if (bathrooms) where.bathrooms = Number(bathrooms);
    if (targetGender) where.targetGender = targetGender;

    if (services) {
      const list = Array.isArray(services) ? services : services.split(',');
      const cleaned = list.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length > 0) {
        where.roomVariants = {
          ...where.roomVariants,
          some: {
            ...where.roomVariants?.some,
            services: { hasEvery: cleaned },
          },
        };
      }
    }

    const properties = await prisma.property.findMany({
      where,
      select: {
        ...propertySelect,
        owner: { select: { id: true, name: true, phone: true, email: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ properties });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await prisma.property.create({
      data: buildCreateData(req.body, req.user.id),
      select: propertySelect,
    });

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

router.get('/mine', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id },
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

router.get('/ratings', authenticate, authorize('OWNER'), async (req, res, next) => {
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

router.get('/:id/ratings', authenticate, authorize('OWNER'), async (req, res, next) => {
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

    res.json({ property });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const existing = await findOwnerProperty(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const updateData = buildUpdateData(req.body);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات سكن للتحديث.' });
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

router.patch('/:id/availability', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const existing = await findOwnerProperty(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const property = await prisma.property.update({
      where: { id: existing.id },
      data: { available: asBoolean(req.body.available) },
      select: propertySelect,
    });

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

router.delete('/:id', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const existing = await findOwnerProperty(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
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

    await prisma.property.delete({ where: { id: existing.id } });
    res.json({ message: 'تم حذف السكن بنجاح.' });
  } catch (err) {
    next(err);
  }
});

// ───────────────────────────────────────────────
// RoomVariant CRUD (nested under property)
// ───────────────────────────────────────────────

// Add room variant to property
router.post('/:id/variants', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);
    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const name = asRequiredString(req.body.name);
    if (!name) throw new Error('اسم نوع الغرفة مطلوب.');

    const capacity = asPositiveInteger(req.body.capacity, 'القدرة الاستيعابية');
    const fullPrice = asPositivePrice(req.body.fullPrice, 'سعر الغرفة');
    const halfPrice = req.body.halfPrice != null ? asPositivePrice(req.body.halfPrice, 'سعر نصف الغرفة') : null;
    const images = req.body.images?.length ? validateImages(req.body.images) : [];
    const services = req.body.services?.length ? validateServices(req.body.services) : [];

    const variant = await prisma.roomVariant.create({
      data: {
        name,
        roomNumber: asOptionalString(req.body.roomNumber),
        capacity,
        isOccupied: false,
        fullPrice,
        halfPrice,
        images,
        services,
        propertyId: property.id,
      },
      select: roomVariantSelect,
    });

    res.status(201).json({
      message: 'تم إضافة نوع الغرفة بنجاح.',
      variant,
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
router.put('/:id/variants/:variantId', authenticate, authorize('OWNER'), async (req, res, next) => {
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

    const data = {};

    if (req.body.name !== undefined) {
      const name = asRequiredString(req.body.name);
      if (!name) throw new Error('اسم نوع الغرفة لا يمكن أن يكون فارغاً.');
      data.name = name;
    }

    if (req.body.roomNumber !== undefined) data.roomNumber = asOptionalString(req.body.roomNumber);
    if (req.body.capacity !== undefined) data.capacity = asPositiveInteger(req.body.capacity, 'القدرة الاستيعابية');
    if (req.body.fullPrice !== undefined) data.fullPrice = asPositivePrice(req.body.fullPrice, 'سعر الغرفة');
    if (req.body.halfPrice !== undefined) data.halfPrice = req.body.halfPrice === null ? null : asPositivePrice(req.body.halfPrice, 'سعر نصف الغرفة');
    if (req.body.images !== undefined) data.images = validateImages(req.body.images);
    if (req.body.services !== undefined) data.services = validateServices(req.body.services);

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

// Delete a room variant
router.delete('/:id/variants/:variantId', authenticate, authorize('OWNER'), async (req, res, next) => {
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
