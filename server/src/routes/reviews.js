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

// POST /api/reviews — student rates an accommodation (UC-9)
router.post('/', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || rating === undefined) {
      return res.status(400).json({ error: 'الحجز والتقييم مطلوبان.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        studentId: true,
        propertyId: true,
        endDate: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'الحجز غير موجود.' });
    }

    if (booking.studentId !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'لا يمكنك تقييم حجز ليس لك.' });
    }

    if (!['PAID', 'COMPLETED'].includes(booking.status)) {
      return res
        .status(400)
        .json({ error: 'يمكن تقييم السكن بعد الدفع فقط.' });
    }

    // UC-9: spec requires "PAID and stay has ended". COMPLETED is set by the
    // owner when the stay finishes, so it implicitly satisfies this; for PAID
    // we must check the end date has passed.
    if (booking.status === 'PAID' && booking.endDate >= new Date()) {
      return res
        .status(400)
        .json({ error: 'يمكن تقييم السكن بعد انتهاء فترة الإقامة فقط.' });
    }

    const existing = await prisma.review.findUnique({
      where: {
        propertyId_studentId: {
          propertyId: booking.propertyId,
          studentId: req.user.id,
        },
      },
    });

    if (existing) {
      return res
        .status(409)
        .json({ error: 'لقد قمت بتقييم هذا السكن مسبقاً.' });
    }

    const review = await prisma.review.create({
      data: {
        propertyId: booking.propertyId,
        studentId: req.user.id,
        rating: validateRating(rating),
        comment: comment ? String(comment).trim() || null : null,
      },
      include: {
        property: { select: { id: true, title: true } },
      },
    });

    res.status(201).json({
      message: 'شكراً لتقييمك.',
      review,
    });
  } catch (err) {
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/reviews/student — student's own reviews
router.get(
  '/student',
  authenticate,
  authorize('STUDENT'),
  async (req, res, next) => {
    try {
      const reviews = await prisma.review.findMany({
        where: { studentId: req.user.id },
        include: {
          property: {
            select: { id: true, title: true, city: true, images: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ reviews });
    } catch (err) {
      next(err);
    }
  },
);

// Admin: list all reviews
router.get('/admin/all', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        student: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, title: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

// Admin: delete a review
router.delete('/admin/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم حذف التقييم بنجاح.' });
  } catch (err) {
    next(err);
  }
});

export default router;
