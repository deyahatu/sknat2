import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, requireActive } from '../middleware/auth.js';
import { notify, notifyAllAdmins } from '../utils/notify.js';

const router = Router();

const RATING_DIMENSIONS = [
  'behaviorRating',
  'cleanlinessRating',
  'communicationRating',
  'overallRating',
];

const DIMENSION_LABELS = {
  behaviorRating: 'سلوك الطالب',
  cleanlinessRating: 'النظافة',
  communicationRating: 'التواصل',
  overallRating: 'التجربة الإجمالية',
};

function validateDimension(value, label) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(`تقييم "${label}" يجب أن يكون رقماً من 1 إلى 5.`);
  }

  return rating;
}

function buildRatingData(body) {
  const data = {};
  for (const dim of RATING_DIMENSIONS) {
    if (body[dim] === undefined || body[dim] === null || body[dim] === '') {
      throw new Error(`يرجى اختيار تقييم "${DIMENSION_LABELS[dim]}".`);
    }
    data[dim] = validateDimension(body[dim], DIMENSION_LABELS[dim]);
  }
  return data;
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

router.post('/', authenticate, requireActive, authorize('OWNER'), async (req, res, next) => {
  try {
    const { bookingId, comment } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: 'الحجز مطلوب.' });
    }
    if (comment && String(comment).length > 500) {
      return res.status(400).json({ error: 'التعليق طويل جداً (الحد الأقصى 500 حرف).' });
    }

    const ratingData = buildRatingData(req.body);

    const booking = await findOwnerBooking(bookingId, req.user.id);

    if (!booking) {
      return res.status(404).json({ error: 'الحجز غير موجود.' });
    }

    if (booking.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'يمكن تقييم الحجوزات المكتملة فقط.' });
    }

    // Defense in depth: even if a booking somehow reached COMPLETED before its
    // endDate (legacy data, manual DB edit), refuse the rating until the stay
    // window has actually ended.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (booking.endDate > startOfToday) {
      return res.status(400).json({ error: 'لا يمكن تقييم الحجز قبل انتهاء فترة الإقامة.' });
    }

    if (booking.student.role !== 'STUDENT') {
      return res.status(400).json({ error: 'يمكن تقييم الطلاب فقط.' });
    }

    const savedRating = await prisma.studentRating.upsert({
      where: { bookingId },
      update: {
        ...ratingData,
        comment: cleanComment(comment),
      },
      create: {
        bookingId,
        ownerId: req.user.id,
        studentId: booking.studentId,
        ...ratingData,
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

    notify(
      booking.studentId,
      'تقييم جديد عليك',
      `قام ${req.user.name} بتقييمك بعد إقامتك في ${booking.property.title}.`,
      '/my-ratings',
    ).catch(() => {});

    notifyAllAdmins(
      'تقييم طالب جديد',
      `${req.user.name} قيّم الطالب على ${booking.property.title}`,
      '/admin?tab=ratings',
    ).catch(() => {});

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

// UC-41 support: student views ratings owners gave them so they can report unfair ones
router.get('/received', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const ratings = await prisma.studentRating.findMany({
      where: { studentId: req.user.id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            property: {
              select: {
                id: true,
                title: true,
                city: true,
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
