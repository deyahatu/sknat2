import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/", authenticate, authorize("STUDENT"), async (req, res, next) => {
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

    // Calculate total price (DOUBLE → halfPrice per bed; SINGLE → fullPrice)
    const diffMs = booking.endDate.getTime() - booking.startDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.max(1, Math.ceil(diffDays / 30));
    const isDouble = booking.roomVariant.kind === "DOUBLE";
    const monthlyPrice = isDouble
      ? (booking.roomVariant.halfPrice
          ? Number(booking.roomVariant.halfPrice)
          : Number(booking.roomVariant.fullPrice) / 2)
      : Number(booking.roomVariant.fullPrice);
    const totalAmount = monthlyPrice * months;

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

router.get(
  "/owner/earnings",
  authenticate,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      // Get wallet balance
      const wallet = await prisma.wallet.findUnique({
        where: { ownerId: req.user.id },
      });

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
        wallet: wallet || { balance: 0 },
        payments,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
