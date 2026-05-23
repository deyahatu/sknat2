import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notify } from '../utils/notify.js';
import { stripe, toMinorUnits } from '../utils/stripe.js';

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
      // Pre-flight: validate the refund + Stripe payment_intent BEFORE touching
      // the DB. We call Stripe first so that if Stripe rejects (e.g., charge
      // already fully refunded, intent missing), the wallet stays untouched.
      const refundRow = await prisma.refundRequest.findUnique({
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

      if (!refundRow) return res.status(404).json({ error: 'طلب الاسترداد غير موجود.' });
      if (refundRow.status !== 'PENDING')
        return res.status(400).json({ error: 'يمكن الموافقة على الطلبات المعلقة فقط.' });

      const refundAmountVal = Math.max(0, Number(refundRow.refundAmount));
      const payment = refundRow.booking.payment;
      if (!payment) return res.status(400).json({ error: 'لا توجد عملية دفع مرتبطة بهذا الحجز.' });
      if (payment.status === 'REFUNDED')
        return res.status(409).json({ error: 'تم استرداد هذه الدفعة مسبقاً.' });
      if (!payment.stripePaymentIntentId)
        return res.status(400).json({
          error: 'لا يوجد معرّف Stripe PaymentIntent — لا يمكن الاسترداد الآلي.',
        });

      // Call Stripe with an idempotency key tied to the refund request id, so
      // retries from the admin UI never double-refund.
      let stripeRefund;
      try {
        stripeRefund = await stripe.refunds.create(
          {
            payment_intent: payment.stripePaymentIntentId,
            amount: toMinorUnits(refundAmountVal),
            reason: 'requested_by_customer',
            metadata: {
              refundRequestId: refundRow.id,
              bookingId: refundRow.booking.id,
              studentId: refundRow.studentId,
            },
          },
          { idempotencyKey: `refund-${refundRow.id}` },
        );
      } catch (stripeErr) {
        console.error('[refunds] Stripe refund failed:', stripeErr.message);
        return res.status(502).json({
          error: 'تعذّر تنفيذ الاسترداد عبر Stripe. لم يتم خصم الرصيد.',
          stripeError: stripeErr.message,
        });
      }

      let refundId;

      try {
        await prisma.$transaction(async (tx) => {
          // Re-fetch inside the transaction so wallet/state checks see the
          // latest values, not the snapshot from the pre-flight read.
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

          if (!refund || refund.status !== 'PENDING') {
            // Another approver beat us to it — Stripe call was idempotent so
            // the money still moved at most once. Treat as success/no-op.
            return;
          }

          refundId = refund.id;
          const ownerId = refund.booking.property.ownerId;
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

          await tx.payment.update({
            where: { id: refund.booking.payment.id },
            data: { status: 'REFUNDED' },
          });

          await tx.refundRequest.update({
            where: { id: refund.id },
            data: { status: 'COMPLETED' },
          });
        }, { isolationLevel: "Serializable" });
      } catch (txErr) {
        if (txErr.statusCode) {
          // Stripe already refunded the student. Owner wallet still has the
          // funds — surface it loudly so an operator can manually reconcile.
          console.error(
            `[refunds] CRITICAL: Stripe refunded ${stripeRefund.id} but DB tx failed: ${txErr.message}`,
          );
          return res.status(500).json({
            error:
              'تم الاسترداد عبر Stripe لكن فشل تحديث الرصيد. تواصل مع التقنية فوراً.',
            stripeRefundId: stripeRefund.id,
          });
        }
        if (txErr.code === "P2034" || txErr.message?.includes("40001")) {
          return res.status(409).json({ error: "حدث تعارض. يرجى المحاولة مرة أخرى." });
        }
        throw txErr;
      }

      if (!refundId) refundId = refundRow.id;

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
