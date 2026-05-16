import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize, requireActive } from "../middleware/auth.js";
import { sendPaymentReceipt } from "../utils/email.js";
import { notify, notifyAllAdmins } from '../utils/notify.js';

const router = Router();

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
          select: { id: true, title: true, ownerId: true },
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
      return res
        .status(403)
        .json({ error: "ليس لديك صلاحية لدفع هذا الحجز." });
    }

    if (booking.status !== "APPROVED") {
      return res
        .status(400)
        .json({ error: "يمكن دفع الحجوزات المقبولة فقط." });
    }

    if (booking.payment) {
      return res
        .status(400)
        .json({ error: "تم دفع هذا الحجز مسبقاً." });
    }

    // For renewals, the parent booking must still be active. Without this check
    // a student could pay a renewal after the original booking was cancelled,
    // leaving the renewal "PAID" but orphaned from any valid stay history.
    if (booking.parentBookingId && booking.parentBooking) {
      const validParentStates = ["APPROVED", "PAID", "COMPLETED"];
      if (!validParentStates.includes(booking.parentBooking.status)) {
        return res.status(400).json({
          error: "لا يمكن دفع هذا التجديد: الحجز الأصلي لم يعد نشطاً.",
        });
      }
    }

    // Prevent paying when student already has another PAID booking overlapping these dates.
    // (Defense-in-depth — the same check runs at approval, but state can drift.)
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

    // Use the price snapshot taken at booking creation so the owner can't
    // edit the room price between approval and payment and trick the student.
    // Fall back to the live room price only for legacy rows where the
    // snapshot column is null (bookings created before price-locking).
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
    const totalAmount = Math.round(monthlyPrice * months * 100) / 100;

    // Process payment + update booking status + add to owner wallet in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          amount: totalAmount,
          status: "COMPLETED",
          bookingId: booking.id,
          studentId: req.user.id,
        },
      });

      // Update booking status to PAID
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "PAID" },
        include: {
          property: {
            select: { id: true, title: true, city: true },
          },
        },
      });

      // Add amount to owner wallet (create wallet if doesn't exist)
      await tx.wallet.upsert({
        where: { ownerId: booking.property.ownerId },
        create: {
          ownerId: booking.property.ownerId,
          balance: totalAmount,
        },
        update: {
          balance: { increment: totalAmount },
        },
      });

      return { payment, booking: updatedBooking };
    });

    sendPaymentReceipt(
      req.user.email,
      req.user.name,
      booking.property.title,
      totalAmount,
      new Date().toLocaleDateString('ar-EG')
    ).catch(() => {});

    notify(booking.property.ownerId, 'دفعة جديدة', `تم استلام دفعة بقيمة ${Number(result.payment.amount)} ₪`, '/owner/bookings').catch(() => {});

    notifyAllAdmins(
      'دفعة جديدة',
      `${req.user.name} دفع ${Number(result.payment.amount)} ₪ مقابل ${booking.property.title}`,
      '/admin?tab=stats',
    ).catch(() => {});

    res.status(201).json({
      message: "تم الدفع بنجاح. تم قبول حجزك.",
      payment: result.payment,
      booking: result.booking,
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/student",
  authenticate,
  authorize("STUDENT"),
  async (req, res, next) => {
    try {
      const payments = await prisma.payment.findMany({
        where: { studentId: req.user.id },
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

// Refund window per UC-12 — must match the value used in withdrawals.js.
const EARNINGS_REFUND_WINDOW_DAYS = 7;

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

      // Compute locked amount (recent payments still inside refund window).
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

      // Get all payments for owner's properties
      const payments = await prisma.payment.findMany({
        where: {
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
