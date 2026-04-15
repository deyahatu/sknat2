import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

function validateRating(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be a number from 1 to 5.');
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
      const error = new Error('You cannot rate a student for another owner accommodation.');
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
      return res.status(400).json({ error: 'Booking and rating are required.' });
    }

    const booking = await findOwnerBooking(bookingId, req.user.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Only approved bookings can be rated.' });
    }

    if (booking.student.role !== 'STUDENT') {
      return res.status(400).json({ error: 'Only students can be rated.' });
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
      message: 'Student rating saved successfully.',
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
