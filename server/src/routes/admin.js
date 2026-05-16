import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notify } from '../utils/notify.js';
import { logAudit } from '../utils/audit.js';

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

// Recent activity (last 10 events)
router.get('/stats/activity', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const [recentBookings, recentPayments] = await Promise.all([
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, createdAt: true,
          student: { select: { name: true } },
          property: { select: { title: true } },
          roomVariant: { select: { name: true } },
        },
      }),
      prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, amount: true, status: true, createdAt: true,
          student: { select: { name: true } },
          booking: { select: { property: { select: { title: true } } } },
        },
      }),
    ]);

    const activities = [
      ...recentBookings.map(b => ({
        type: 'booking',
        text: `${b.student.name} — حجز ${b.roomVariant?.name || ''} في ${b.property.title}`,
        status: b.status,
        time: b.createdAt,
      })),
      ...recentPayments.map(p => ({
        type: 'payment',
        text: `${p.student.name} — دفع ${Number(p.amount)} ₪ لـ ${p.booking?.property?.title || ''}`,
        status: p.status,
        time: p.createdAt,
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

    res.json({ activities });
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

// Send a one-way admin notification to any user. Lets the admin reach out about
// a complaint, report, or any sensitive matter without going through the
// normal student↔owner Messages flow (which needs an active booking and is
// peer-to-peer). Stored as a regular Notification row so the user sees it in
// their existing NotificationBell with no extra UI.
router.post('/send-notification', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { userId, title, body, url } = req.body || {};

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'يرجى تحديد المستخدم.' });
    }
    const bodyStr = String(body || '').trim();
    if (!bodyStr) {
      return res.status(400).json({ error: 'يرجى كتابة نص الرسالة.' });
    }
    if (bodyStr.length > 1000) {
      return res.status(400).json({ error: 'الرسالة طويلة جداً (الحد الأقصى 1000 حرف).' });
    }
    const titleStr = (title && String(title).trim()) || 'رسالة من الإدارة';
    if (titleStr.length > 120) {
      return res.status(400).json({ error: 'العنوان طويل جداً.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    // Don't let admins notify other admins via this endpoint — keep it focused
    // on user-facing communication.
    if (user.role === 'ADMIN') {
      return res.status(400).json({ error: 'لا يمكن إرسال إشعار إلى مدير.' });
    }

    const safeUrl = typeof url === 'string' && url.startsWith('/') ? url : null;
    await notify(user.id, titleStr, bodyStr, safeUrl);

    logAudit({
      action: 'ADMIN_NOTIFY',
      entity: 'USER',
      entityId: user.id,
      user: req.user,
      details: bodyStr.slice(0, 200),
    });

    res.json({ message: 'تم إرسال الرسالة.' });
  } catch (err) {
    next(err);
  }
});

export default router;
