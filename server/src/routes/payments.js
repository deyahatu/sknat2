import { Router } from "express";
import express from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize, requireActive } from "../middleware/auth.js";
import { sendPaymentReceipt } from "../utils/email.js";
import { notify, notifyAllAdmins } from '../utils/notify.js';
import { stripe, CURRENCY, toMinorUnits } from "../utils/stripe.js";

const router = Router();

// Refund window per UC-12 — must match the value used in withdrawals.js.
const EARNINGS_REFUND_WINDOW_DAYS = 7;

function computeBookingTotal(booking) {
  const diffMs = booking.endDate.getTime() - booking.startDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.max(1, diffDays / 30);
  let monthlyPrice;
  if (booking.monthlyPrice != null) {
    monthlyPrice = Number(booking.monthlyPrice);
  } else {
    const isDouble = booking.roomVariant.kind === "DOUBLE";
    monthlyPrice = isDouble
      ? (booking.roomVariant.halfPrice
          ? Number(booking.roomVariant.halfPrice)
          : Number(booking.roomVariant.fullPrice) / 2)
      : Number(booking.roomVariant.fullPrice);
  }
  return Math.round(monthlyPrice * months * 100) / 100;
}

// Create Stripe Checkout Session. Booking + wallet stay untouched
// until the webhook confirms `checkout.session.completed` — this prevents
// crediting an owner before Stripe actually captured funds.
router.post("/", authenticate, requireActive, authorize("STUDENT"), async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: "معرّف الحجز مطلوب." });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: {
          select: { id: true, title: true, ownerId: true, images: true },
        },
        roomVariant: {
          select: { id: true, kind: true, fullPrice: true, halfPrice: true },
        },
        payment: true,
        parentBooking: { select: { status: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "الحجز غير موجود." });
    }

    if (booking.studentId !== req.user.id) {
      return res.status(403).json({ error: "ليس لديك صلاحية لدفع هذا الحجز." });
    }

    if (booking.status !== "APPROVED") {
      return res.status(400).json({ error: "يمكن دفع الحجوزات المقبولة فقط." });
    }

    if (booking.payment && booking.payment.status === "COMPLETED") {
      return res.status(400).json({ error: "تم دفع هذا الحجز مسبقاً." });
    }

    if (booking.parentBookingId && booking.parentBooking) {
      const validParentStates = ["APPROVED", "PAID", "COMPLETED"];
      if (!validParentStates.includes(booking.parentBooking.status)) {
        return res.status(400).json({
          error: "لا يمكن دفع هذا التجديد: الحجز الأصلي لم يعد نشطاً.",
        });
      }
    }

    const isRenewal = !!booking.parentBookingId;
    const excludeIds = isRenewal
      ? [booking.id, booking.parentBookingId]
      : [booking.id];
    const studentConflict = await prisma.booking.findFirst({
      where: {
        studentId: req.user.id,
        id: { notIn: excludeIds },
        status: { in: ["APPROVED", "PAID"] },
        startDate: { lt: booking.endDate },
        endDate: { gt: booking.startDate },
      },
    });

    if (studentConflict) {
      return res.status(400).json({
        error: "لا يمكن الدفع: لديك حجز مؤكد آخر يتداخل مع هذه الفترة. يرجى إلغاء أحدهما أولاً.",
      });
    }

    const totalAmount = computeBookingTotal(booking);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: req.user.email,
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: booking.property.title,
              description: `حجز سكن (${new Date(booking.startDate).toLocaleDateString("ar-EG")} - ${new Date(booking.endDate).toLocaleDateString("ar-EG")})`,
            },
            unit_amount: toMinorUnits(totalAmount),
          },
          quantity: 1,
        },
      ],
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel?booking_id=${booking.id}`,
      metadata: {
        bookingId: booking.id,
        studentId: req.user.id,
      },
    });

    // Upsert so retrying a cancelled checkout doesn't accumulate orphan rows.
    await prisma.payment.upsert({
      where: { bookingId: booking.id },
      create: {
        amount: totalAmount,
        status: "PENDING",
        bookingId: booking.id,
        studentId: req.user.id,
        stripeSessionId: session.id,
      },
      update: {
        amount: totalAmount,
        status: "PENDING",
        stripeSessionId: session.id,
        stripePaymentIntentId: null,
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

// Stripe webhook. Mounted with raw body in index.js BEFORE express.json().
// Idempotent: the same session.completed event firing twice must not credit
// the owner wallet twice.
export const webhookHandler = [
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("Stripe webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          await handleCheckoutCompleted(event.data.object);
          break;
        }
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed": {
          await markPaymentFailed(event.data.object.id);
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Stripe webhook handler failed:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
];

async function handleCheckoutCompleted(session) {
  const sessionId = session.id;
  const paymentIntentId = session.payment_intent;

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { stripeSessionId: sessionId },
      include: {
        booking: {
          include: {
            property: { select: { id: true, title: true, city: true, ownerId: true } },
          },
        },
        student: { select: { id: true, name: true, email: true } },
      },
    });

    if (!payment) return null;
    if (payment.status === "COMPLETED") return { payment, alreadyProcessed: true };

    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        stripePaymentIntentId: paymentIntentId,
      },
    });

    const updatedBooking = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: "PAID" },
    });

    await tx.wallet.upsert({
      where: { ownerId: payment.booking.property.ownerId },
      create: {
        ownerId: payment.booking.property.ownerId,
        balance: payment.amount,
      },
      update: {
        balance: { increment: payment.amount },
      },
    });

    return {
      payment: updatedPayment,
      booking: updatedBooking,
      property: payment.booking.property,
      student: payment.student,
      alreadyProcessed: false,
    };
  });

  if (!result || result.alreadyProcessed) return;

  const { payment, property, student } = result;
  sendPaymentReceipt(
    student.email,
    student.name,
    property.title,
    Number(payment.amount),
    new Date().toLocaleDateString("ar-EG"),
  ).catch(() => {});
  notify(
    property.ownerId,
    "دفعة جديدة",
    `تم استلام دفعة بقيمة ${Number(payment.amount)} ₪`,
    "/owner/bookings",
  ).catch(() => {});
  notifyAllAdmins(
    "دفعة جديدة",
    `${student.name} دفع ${Number(payment.amount)} ₪ مقابل ${property.title}`,
    "/admin?tab=stats",
  ).catch(() => {});
}

async function markPaymentFailed(sessionId) {
  await prisma.payment.updateMany({
    where: { stripeSessionId: sessionId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}

// Lets the success page confirm payment without trusting the URL alone —
// the webhook may not have fired yet, so the client should poll briefly.
router.get(
  "/verify/:sessionId",
  authenticate,
  async (req, res, next) => {
    try {
      const payment = await prisma.payment.findUnique({
        where: { stripeSessionId: req.params.sessionId },
        include: {
          booking: {
            include: {
              property: { select: { id: true, title: true, city: true } },
            },
          },
        },
      });

      if (!payment) {
        return res.status(404).json({ error: "الدفعة غير موجودة." });
      }

      if (payment.studentId !== req.user.id) {
        return res.status(403).json({ error: "ليس لديك صلاحية." });
      }

      res.json({ payment });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/student",
  authenticate,
  authorize("STUDENT"),
  async (req, res, next) => {
    try {
      const payments = await prisma.payment.findMany({
        where: { studentId: req.user.id, status: "COMPLETED" },
        include: {
          booking: {
            include: {
              property: {
                select: { id: true, title: true, city: true, images: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ payments });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/owner/earnings",
  authenticate,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { ownerId: req.user.id },
      });
      const balance = wallet ? Number(wallet.balance) : 0;

      const cutoff = new Date(
        Date.now() - EARNINGS_REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );
      const recent = await prisma.payment.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: cutoff },
          booking: { property: { ownerId: req.user.id } },
        },
        select: { amount: true },
      });
      const lockedBalance = recent.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const availableBalance = Math.max(0, balance - lockedBalance);

      const payments = await prisma.payment.findMany({
        where: {
          status: "COMPLETED",
          booking: {
            property: { ownerId: req.user.id },
          },
        },
        include: {
          booking: {
            include: {
              property: {
                select: { id: true, title: true },
              },
              student: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({
        wallet: { balance, lockedBalance, availableBalance },
        payments,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
