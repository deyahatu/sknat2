import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// UC-36: Reports & Statistics
router.get('/stats', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalOwners,
      totalProperties,
      totalBookings,
      pendingBookings,
      totalPayments,
      totalReviews,
      pendingRefunds,
      pendingWithdrawals,
      revenueResult,
      totalRooms,
      occupiedRooms,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'OWNER' } }),
      prisma.property.count(),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'COMPLETED' } }),
      prisma.review.count(),
      prisma.refundRequest.count({ where: { status: 'PENDING' } }),
      prisma.withdrawRequest.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.roomVariant.count(),
      prisma.roomVariant.count({ where: { isOccupied: true } }),
    ]);

    res.json({
      totalUsers,
      totalStudents,
      totalOwners,
      totalProperties,
      totalBookings,
      pendingBookings,
      totalPayments,
      totalRevenue: Number(revenueResult._sum.amount || 0),
      totalReviews,
      pendingRefunds,
      pendingWithdrawals,
      totalRooms,
      occupiedRooms,
    });
  } catch (err) {
    next(err);
  }
});

// Monthly stats for charts (last 6 months)
router.get('/stats/monthly', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });

      const [users, bookings, revenue] = await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.booking.count({ where: { createdAt: { gte: start, lt: end } } }),
        prisma.payment.aggregate({
          where: { status: 'COMPLETED', createdAt: { gte: start, lt: end } },
          _sum: { amount: true },
        }),
      ]);

      months.push({
        month: label,
        users,
        bookings,
        revenue: Number(revenue._sum.amount || 0),
      });
    }

    res.json({ months });
  } catch (err) {
    next(err);
  }
});

// Export data as JSON (frontend converts to CSV)
router.get('/export/:type', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { type } = req.params;
    let data;

    if (type === 'users') {
      data = await prisma.user.findMany({
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    } else if (type === 'bookings') {
      data = await prisma.booking.findMany({
        include: {
          student: { select: { name: true, email: true } },
          property: { select: { title: true, city: true } },
          roomVariant: { select: { name: true, fullPrice: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (type === 'payments') {
      data = await prisma.payment.findMany({
        include: {
          student: { select: { name: true, email: true } },
          booking: { select: { property: { select: { title: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return res.status(400).json({ error: 'نوع غير صالح.' });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
