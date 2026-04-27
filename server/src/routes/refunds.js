import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// GET /api/refunds/student — student lists their refund requests
router.get(
  '/student',
  authenticate,
  authorize('STUDENT'),
  async (req, res, next) => {
    try {
      const refunds = await prisma.refundRequest.findMany({
        where: { studentId: req.user.id },
        include: {
          booking: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              status: true,
              property: {
                select: { id: true, title: true, city: true, images: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ refunds });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/refunds — admin lists all refund requests (with optional status filter)
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status.toUpperCase();

    const refunds = await prisma.refundRequest.findMany({
      where,
      include: {
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
                ownerId: true,
                owner: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ refunds });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/refunds/:id/approve — admin approves and processes refund
router.patch(
  '/:id/approve',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const refund = await prisma.refundRequest.findUnique({
        where: { id: req.params.id },
        include: {
          booking: {
            include: {
              property: { select: { ownerId: true } },
              payment: true,
            },
          },
        },
      });

      if (!refund) {
        return res.status(404).json({ error: 'طلب الاسترداد غير موجود.' });
      }

      if (refund.status !== 'PENDING') {
        return res
          .status(400)
          .json({ error: 'يمكن الموافقة على الطلبات المعلقة فقط.' });
      }

      const ownerId = refund.booking.property.ownerId;
      const refundAmount = Number(refund.refundAmount);

      const wallet = await prisma.wallet.findUnique({ where: { ownerId } });

      if (!wallet || Number(wallet.balance) < refundAmount) {
        return res.status(400).json({
          error: 'رصيد المالك غير كافٍ لإتمام الاسترداد.',
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: refundAmount } },
        });

        if (refund.booking.payment) {
          await tx.payment.update({
            where: { id: refund.booking.payment.id },
            data: { status: 'REFUNDED' },
          });
        }

        await tx.refundRequest.update({
          where: { id: refund.id },
          data: { status: 'COMPLETED' },
        });
      });

      const updated = await prisma.refundRequest.findUnique({
        where: { id: refund.id },
        include: {
          booking: {
            select: {
              id: true,
              property: { select: { id: true, title: true } },
            },
          },
          student: { select: { id: true, name: true } },
        },
      });

      res.json({
        message: 'تمت الموافقة على الاسترداد ومعالجته بنجاح.',
        refund: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/refunds/:id/reject — admin rejects refund
router.patch(
  '/:id/reject',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      const { reason } = req.body;

      const refund = await prisma.refundRequest.findUnique({
        where: { id: req.params.id },
      });

      if (!refund) {
        return res.status(404).json({ error: 'طلب الاسترداد غير موجود.' });
      }

      if (refund.status !== 'PENDING') {
        return res
          .status(400)
          .json({ error: 'يمكن رفض الطلبات المعلقة فقط.' });
      }

      const updated = await prisma.refundRequest.update({
        where: { id: refund.id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason || null,
        },
      });

      res.json({
        message: 'تم رفض طلب الاسترداد.',
        refund: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
