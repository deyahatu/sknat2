import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

const IMAGE_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const VALID_GENDERS = ['MALE', 'FEMALE'];

const propertySelect = {
  id: true,
  title: true,
  description: true,
  address: true,
  city: true,
  price: true,
  rooms: true,
  capacityPerRoom: true,
  studentsCount: true,
  targetGender: true,
  services: true,
  otherServices: true,
  policy: true,
  bathrooms: true,
  area: true,
  images: true,
  available: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
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
    throw new Error(`${fieldName} must be a positive number.`);
  }

  return number;
}

function asNonNegativeInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} must be zero or more.`);
  }

  return number;
}

function asPositivePrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error('Price must be a positive number.');
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

  throw new Error('Availability status must be true or false.');
}

function validateImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('At least one accommodation photo is required.');
  }

  const invalidImage = images.some((image) => (
    typeof image !== 'string' || !IMAGE_REGEX.test(image)
  ));

  if (invalidImage) {
    throw new Error('Please upload valid accommodation photos.');
  }

  return images;
}

function validateServices(services, otherServices) {
  if (!Array.isArray(services)) {
    throw new Error('Services must be a list.');
  }

  const cleanServices = services
    .filter((service) => typeof service === 'string')
    .map((service) => service.trim())
    .filter(Boolean);

  if (cleanServices.length !== services.length) {
    throw new Error('Services must contain text values only.');
  }

  if (cleanServices.length === 0 && !otherServices) {
    throw new Error('Please select at least one service or add other services.');
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
    throw new Error('Please fill all required accommodation fields.');
  }

  if (!VALID_GENDERS.includes(targetGender)) {
    throw new Error('Target gender must be MALE or FEMALE.');
  }

  const price = asPositivePrice(body.price);
  const rooms = asPositiveInteger(body.rooms, 'Number of rooms');
  const capacityPerRoom = asPositiveInteger(body.capacityPerRoom, 'Capacity per room');
  const studentsCount = asNonNegativeInteger(body.studentsCount, 'Number of students');

  if (studentsCount > rooms * capacityPerRoom) {
    throw new Error('Number of students cannot exceed total accommodation capacity.');
  }

  const services = validateServices(body.services, otherServices);
  const images = validateImages(body.images);
  const available = asBoolean(body.available);

  return {
    title,
    city,
    address,
    description,
    policy,
    otherServices,
    price,
    rooms,
    capacityPerRoom,
    studentsCount,
    targetGender,
    services,
    images,
    available,
    ownerId,
    ...(body.bathrooms !== undefined && { bathrooms: asPositiveInteger(body.bathrooms, 'Number of bathrooms') }),
    ...(body.area !== undefined && body.area !== null && body.area !== '' && {
      area: asPositiveInteger(body.area, 'Area'),
    }),
  };
}

function buildUpdateData(body) {
  const data = {};

  if (body.title !== undefined || body.name !== undefined) {
    const title = asRequiredString(body.title || body.name);
    if (!title) throw new Error('Accommodation name cannot be empty.');
    data.title = title;
  }

  if (body.city !== undefined) {
    const city = asRequiredString(body.city);
    if (!city) throw new Error('City cannot be empty.');
    data.city = city;
  }

  if (body.address !== undefined) {
    const address = asRequiredString(body.address);
    if (!address) throw new Error('Address cannot be empty.');
    data.address = address;
  }

  if (body.description !== undefined) {
    const description = asRequiredString(body.description);
    if (!description) throw new Error('Description cannot be empty.');
    data.description = description;
  }

  if (body.policy !== undefined) {
    const policy = asRequiredString(body.policy);
    if (!policy) throw new Error('Accommodation policy cannot be empty.');
    data.policy = policy;
  }

  if (body.price !== undefined) data.price = asPositivePrice(body.price);
  if (body.rooms !== undefined) data.rooms = asPositiveInteger(body.rooms, 'Number of rooms');
  if (body.capacityPerRoom !== undefined) data.capacityPerRoom = asPositiveInteger(body.capacityPerRoom, 'Capacity per room');
  if (body.studentsCount !== undefined) data.studentsCount = asNonNegativeInteger(body.studentsCount, 'Number of students');
  if (body.bathrooms !== undefined) data.bathrooms = asPositiveInteger(body.bathrooms, 'Number of bathrooms');
  if (body.area !== undefined) data.area = body.area === null || body.area === '' ? null : asPositiveInteger(body.area, 'Area');

  if (body.targetGender !== undefined) {
    const targetGender = asRequiredString(body.targetGender).toUpperCase();
    if (!VALID_GENDERS.includes(targetGender)) {
      throw new Error('Target gender must be MALE or FEMALE.');
    }
    data.targetGender = targetGender;
  }

  if (body.otherServices !== undefined) {
    data.otherServices = asOptionalString(body.otherServices);
  }

  if (body.services !== undefined) {
    const otherServicesForValidation =
      body.otherServices !== undefined
        ? data.otherServices
        : asOptionalString(body.currentOtherServices);
    data.services = validateServices(body.services, otherServicesForValidation);
  }

  if (body.images !== undefined) {
    data.images = validateImages(body.images);
  }

  if (body.available !== undefined) {
    data.available = asBoolean(body.available);
  }

  const rooms = data.rooms ?? Number(body.currentRooms);
  const capacityPerRoom = data.capacityPerRoom ?? Number(body.currentCapacityPerRoom);
  const studentsCount = data.studentsCount ?? Number(body.currentStudentsCount);

  if (
    Number.isInteger(rooms) &&
    Number.isInteger(capacityPerRoom) &&
    Number.isInteger(studentsCount) &&
    studentsCount > rooms * capacityPerRoom
  ) {
    throw new Error('Number of students cannot exceed total accommodation capacity.');
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

router.post('/', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await prisma.property.create({
      data: buildCreateData(req.body, req.user.id),
      select: propertySelect,
    });

    res.status(201).json({
      message: 'Accommodation created successfully.',
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
      return res.status(404).json({ error: 'Accommodation not found.' });
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

router.get('/:id', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const property = await findOwnerProperty(req.params.id, req.user.id);

    if (!property) {
      return res.status(404).json({ error: 'Accommodation not found.' });
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
      return res.status(404).json({ error: 'Accommodation not found.' });
    }

    const updateData = buildUpdateData({
      ...req.body,
      currentRooms: existing.rooms,
      currentCapacityPerRoom: existing.capacityPerRoom,
      currentStudentsCount: existing.studentsCount,
      currentOtherServices: existing.otherServices,
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No accommodation data provided for update.' });
    }

    const property = await prisma.property.update({
      where: { id: existing.id },
      data: updateData,
      select: propertySelect,
    });

    res.json({
      message: 'Accommodation updated successfully.',
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
      return res.status(404).json({ error: 'Accommodation not found.' });
    }

    const property = await prisma.property.update({
      where: { id: existing.id },
      data: { available: asBoolean(req.body.available) },
      select: propertySelect,
    });

    res.json({
      message: 'Availability status updated successfully.',
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
      return res.status(404).json({ error: 'Accommodation not found.' });
    }

    const activeBookings = await prisma.booking.count({
      where: {
        propertyId: existing.id,
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
      },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ error: 'This accommodation has active bookings. Cannot delete.' });
    }

    await prisma.property.delete({ where: { id: existing.id } });
    res.json({ message: 'Accommodation deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
