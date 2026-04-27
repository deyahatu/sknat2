import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

function validateRating(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('التقييم يجب أن يكون رقماً من 1 إلى 5.');
  }

  return rating;
}

function cleanComment(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const comment = String(value).trim();
  return comment || null;
}

async function findOwnerBooking(bookingId, ownerId) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          ownerId: true,
        },
      },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  }).then((booking) => {
    if (!booking) {
      return null;
    }

    if (booking.property.ownerId !== ownerId) {
      const error = new Error('لا يمكنك تقييم طالب على سكن مالك آخر.');
      error.status = 403;
      throw error;
    }

    return booking;
  });
}

router.post('/', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || rating === undefined) {
      return res.status(400).json({ error: 'الحجز والتقييم مطلوبان.' });
    }

    const booking = await findOwnerBooking(bookingId, req.user.id);

    if (!booking) {
      return res.status(404).json({ error: 'الحجز غير موجود.' });
    }

    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'يمكن تقييم الحجوزات المكتملة فقط.' });
    }

    if (booking.student.role !== 'STUDENT') {
      return res.status(400).json({ error: 'يمكن تقييم الطلاب فقط.' });
    }

    const savedRating = await prisma.studentRating.upsert({
      where: { bookingId },
      update: {
        rating: validateRating(rating),
        comment: cleanComment(comment),
      },
      create: {
        bookingId,
        ownerId: req.user.id,
        studentId: booking.studentId,
        rating: validateRating(rating),
        comment: cleanComment(comment),
      },
      include: {
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
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
    });

    res.status(201).json({
      message: 'تم حفظ تقييم الطالب بنجاح.',
      rating: savedRating,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/given', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const ratings = await prisma.studentRating.findMany({
      where: { ownerId: req.user.id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            property: {
              select: {
                id: true,
                title: true,
                city: true,
                address: true,
              },
            },
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

export default router;
