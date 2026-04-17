import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// ──────────────────────────────────────────────
// UC-6: Send Booking Request (Student)
// ──────────────────────────────────────────────
router.post('/', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const { propertyId, startDate, endDate } = req.body;

    if (!propertyId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Please fill all required fields.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Please enter valid dates.' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    if (start < new Date()) {
      return res.status(400).json({ error: 'Start date cannot be in the past.' });
    }

    // Check property exists and is available
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, price: true, available: true, ownerId: true, policy: true },
    });

    if (!property) {
      return res.status(404).json({ error: 'Accommodation not found.' });
    }

    if (!property.available) {
      return res.status(400).json({ error: 'This accommodation is not available.' });
    }

    // Student can't book own property
    if (property.ownerId === req.user.id) {
      return res.status(400).json({ error: 'You cannot book your own accommodation.' });
    }

    // Check no APPROVED/PAID booking on same property for overlapping dates
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        propertyId,
        status: { in: ['APPROVED', 'PAID'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    if (conflictingBooking) {
      return res.status(400).json({ error: 'These dates are not available. Choose different dates.' });
    }

    // Check student doesn't have overlapping APPROVED/PAID booking
    const studentConflict = await prisma.booking.findFirst({
      where: {
        studentId: req.user.id,
        status: { in: ['APPROVED', 'PAID'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    if (studentConflict) {
      return res.status(400).json({ error: 'You already have a confirmed booking for this date.' });
    }

    // Calculate total price (price per month, calculate months)
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.max(1, Math.ceil(diffDays / 30));
    const totalPrice = Number(property.price) * months;

    const booking = await prisma.booking.create({
      data: {
        startDate: start,
        endDate: end,
        status: 'PENDING',
        propertyId,
        studentId: req.user.id,
      },
      include: {
        property: {
          select: { id: true, title: true, city: true, price: true, images: true },
        },
      },
    });

    res.status(201).json({
      message: 'Booking request sent successfully.',
      booking: { ...booking, totalPrice },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// UC-7: Track Booking Status (Student)
// ──────────────────────────────────────────────
router.get('/student', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = { studentId: req.user.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            address: true,
            price: true,
            images: true,
            policy: true,
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// UC-18: View Booking Requests (Owner)
// ──────────────────────────────────────────────
router.get('/owner', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = {
      property: { ownerId: req.user.id },
    };
    if (status) {
      where.status = status.toUpperCase();
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        property: {
          select: { id: true, title: true, city: true, price: true, images: true },
        },
        student: {
          select: { id: true, name: true, email: true, phone: true },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// Get single booking details
// ──────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            address: true,
            price: true,
            images: true,
            policy: true,
            ownerId: true,
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        student: {
          select: { id: true, name: true, email: true, phone: true },
        },
        payment: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Only the student or the property owner can view the booking
    const isStudent = booking.studentId === req.user.id;
    const isOwner = booking.property.ownerId === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isStudent && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to view this booking.' });
    }

    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// UC-19: Accept Booking Request (Owner)
// ──────────────────────────────────────────────
router.patch('/:id/accept', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { ownerId: true, title: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.property.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to manage this booking.' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending bookings can be accepted.' });
    }

    // Check dates are still available (no other APPROVED/PAID booking)
    const conflict = await prisma.booking.findFirst({
      where: {
        propertyId: booking.propertyId,
        id: { not: booking.id },
        status: { in: ['APPROVED', 'PAID'] },
        startDate: { lt: booking.endDate },
        endDate: { gt: booking.startDate },
      },
    });

    if (conflict) {
      return res.status(400).json({ error: 'These dates are no longer available. Cannot accept this request.' });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'APPROVED' },
      include: {
        property: {
          select: { id: true, title: true, city: true, price: true },
        },
        student: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({
      message: 'Booking request accepted successfully.',
      booking: updated,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// UC-20: Reject Booking Request (Owner)
// ──────────────────────────────────────────────
router.patch('/:id/reject', authenticate, authorize('OWNER'), async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { ownerId: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.property.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to manage this booking.' });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending bookings can be rejected.' });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'REJECTED' },
      include: {
        property: {
          select: { id: true, title: true, city: true, price: true },
        },
        student: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({
      message: 'Booking request rejected.',
      booking: updated,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// UC-11: Cancel Booking (Student)
// UC-12: Cancellation policy applied
// ──────────────────────────────────────────────
router.patch('/:id/cancel', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: {
          select: { id: true, title: true, price: true, ownerId: true },
        },
        payment: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.studentId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to cancel this booking.' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'This booking is already cancelled.' });
    }

    if (booking.status === 'REJECTED') {
      return res.status(400).json({ error: 'Cannot cancel a rejected booking.' });
    }

    if (booking.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel a completed booking.' });
    }

    // Calculate refund based on cancellation policy (UC-12)
    let refundPercentage = 0;
    let refundAmount = 0;

    if (booking.status === 'APPROVED') {
      // Not paid yet — 100% (no money to refund, just cancel)
      refundPercentage = 100;
    } else if (booking.status === 'PAID' && booking.payment) {
      const paymentDate = booking.payment.createdAt;
      const now = new Date();
      const daysSincePayment = Math.floor(
        (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSincePayment <= 3) {
        refundPercentage = 100;
      } else if (daysSincePayment <= 7) {
        refundPercentage = 50;
      } else {
        refundPercentage = 0;
      }

      refundAmount = Number(booking.payment.amount) * (refundPercentage / 100);

      // If there's a refund, update payment status and deduct from owner wallet
      if (refundAmount > 0) {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: { status: 'REFUNDED' },
          });

          // Deduct from owner wallet
          const wallet = await tx.wallet.findUnique({
            where: { ownerId: booking.property.ownerId },
          });

          if (wallet && Number(wallet.balance) >= refundAmount) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { decrement: refundAmount } },
            });
          }
        });
      }
    }
    // PENDING — just cancel, no refund needed

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
      include: {
        property: {
          select: { id: true, title: true, city: true, price: true },
        },
      },
    });

    res.json({
      message: 'Booking cancelled successfully.',
      booking: updated,
      refund: {
        percentage: refundPercentage,
        amount: refundAmount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────
// UC-12: View Cancellation Policy
// ──────────────────────────────────────────────
router.get('/:id/cancellation-policy', authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { policy: true, title: true } },
        payment: { select: { createdAt: true, amount: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    let refundPercentage = 0;
    let refundAmount = 0;

    if (booking.status === 'APPROVED') {
      refundPercentage = 100;
    } else if (booking.status === 'PAID' && booking.payment) {
      const daysSincePayment = Math.floor(
        (Date.now() - booking.payment.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSincePayment <= 3) {
        refundPercentage = 100;
      } else if (daysSincePayment <= 7) {
        refundPercentage = 50;
      } else {
        refundPercentage = 0;
      }

      refundAmount = Number(booking.payment.amount) * (refundPercentage / 100);
    }

    res.json({
      policy: {
        propertyPolicy: booking.property.policy,
        rules: [
          { condition: 'Approved but not paid', refund: '100%' },
          { condition: 'Paid, within 3 days', refund: '100%' },
          { condition: 'Paid, 4-7 days', refund: '50%' },
          { condition: 'Paid, after 7 days', refund: '0%' },
          { condition: 'Already checked in', refund: '0%' },
        ],
        currentBooking: {
          status: booking.status,
          refundPercentage,
          refundAmount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
