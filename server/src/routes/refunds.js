import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notify } from '../utils/notify.js';

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
      let refundId;
      let refundAmountVal;

      try {
        await prisma.$transaction(async (tx) => {
          const refund = await tx.refundRequest.findUnique({
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
            const err = new Error('طلب الاسترداد غير موجود.');
            err.statusCode = 404;
            throw err;
          }

          if (refund.status !== 'PENDING') {
            const err = new Error('يمكن الموافقة على الطلبات المعلقة فقط.');
            err.statusCode = 400;
            throw err;
          }

          refundId = refund.id;
          const ownerId = refund.booking.property.ownerId;
          refundAmountVal = Math.max(0, Number(refund.refundAmount));

          const wallet = await tx.wallet.findUnique({ where: { ownerId } });

          if (!wallet || Number(wallet.balance) < refundAmountVal) {
            const err = new Error('رصيد المالك غير كافٍ لإتمام الاسترداد.');
            err.statusCode = 400;
            throw err;
          }

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: refundAmountVal } },
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
        }, { isolationLevel: "Serializable" });
      } catch (txErr) {
        if (txErr.statusCode) {
          return res.status(txErr.statusCode).json({ error: txErr.message });
        }
        if (txErr.code === "P2034" || txErr.message?.includes("40001")) {
          return res.status(409).json({ error: "حدث تعارض. يرجى المحاولة مرة أخرى." });
        }
        throw txErr;
      }

      const updated = await prisma.refundRequest.findUnique({
        where: { id: refundId },
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

      notify(
        updated.studentId,
        'تمت الموافقة على طلب الاسترداد',
        `تم استرداد مبلغ ${refundAmountVal} ₪ بنجاح.`,
        '/bookings',
      ).catch(() => {});

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

      notify(
        updated.studentId,
        'تم رفض طلب الاسترداد',
        reason ? `السبب: ${reason}` : 'تم رفض طلب الاسترداد من قبل الإدارة.',
        '/bookings',
      ).catch(() => {});

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
