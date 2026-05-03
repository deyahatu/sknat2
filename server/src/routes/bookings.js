import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";
import { sendBookingAccepted, sendBookingRejected, sendBookingCompleted } from "../utils/email.js";

const router = Router();

router.post("/", authenticate, authorize("STUDENT"), async (req, res, next) => {
  try {
    const { propertyId, roomVariantId, startDate, endDate } = req.body;

    if (!propertyId || !roomVariantId || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "يرجى تعبئة جميع الحقول المطلوبة." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "يرجى إدخال تواريخ صحيحة." });
    }

    if (start >= end) {
      return res
        .status(400)
        .json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية." });
    }

    if (start < new Date()) {
      return res
        .status(400)
        .json({ error: "تاريخ البداية لا يمكن أن يكون في الماضي." });
    }

    // Check property exists and is available
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        available: true,
        ownerId: true,
        policy: true,
      },
    });

    if (!property) {
      return res.status(404).json({ error: "السكن غير موجود." });
    }

    if (!property.available) {
      return res.status(400).json({ error: "هذا السكن غير متاح." });
    }

    // Check room variant exists and has available beds
    const roomVariant = await prisma.roomVariant.findFirst({
      where: { id: roomVariantId, propertyId },
    });

    if (!roomVariant) {
      return res.status(404).json({ error: "الغرفة غير موجودة." });
    }

    if (roomVariant.isOccupied) {
      return res.status(400).json({ error: "هذه الغرفة محجوزة بالكامل." });
    }

    // For SINGLE rooms, partial doesn't apply. For DOUBLE, allow booking even if partial.
    const isDouble = roomVariant.kind === "DOUBLE";

    // Student can't book own property
    if (property.ownerId === req.user.id) {
      return res.status(400).json({ error: "لا يمكنك حجز سكنك الخاص." });
    }

    // UC-4 A1: prevent duplicate booking requests on the same property
    // while a previous one is still active (PENDING/APPROVED/PAID).
    const existingForProperty = await prisma.booking.findFirst({
      where: {
        studentId: req.user.id,
        propertyId,
        status: { in: ["PENDING", "APPROVED", "PAID"] },
      },
    });

    if (existingForProperty) {
      return res
        .status(400)
        .json({ error: "لديك طلب حجز سابق على هذا السكن. يرجى إلغاؤه أو متابعته قبل إرسال طلب جديد." });
    }

    // Check student doesn't have overlapping APPROVED/PAID booking
    const studentConflict = await prisma.booking.findFirst({
      where: {
        studentId: req.user.id,
        status: { in: ["APPROVED", "PAID"] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    if (studentConflict) {
      return res
        .status(400)
        .json({ error: "لديك حجز مؤكد بالفعل في هذا التاريخ." });
    }

    // Calculate total price:
    //  - DOUBLE → student takes one bed → use halfPrice (fallback to fullPrice / 2)
    //  - SINGLE → fullPrice
    // Months are pro-rated (30-day month) with a 1-month minimum.
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.max(1, diffDays / 30);
    const monthlyPrice = isDouble
      ? (roomVariant.halfPrice
          ? Number(roomVariant.halfPrice)
          : Number(roomVariant.fullPrice) / 2)
      : Number(roomVariant.fullPrice);
    const totalPrice = Math.round(monthlyPrice * months * 100) / 100;

    const booking = await prisma.booking.create({
      data: {
        startDate: start,
        endDate: end,
        status: "PENDING",
        propertyId,
        roomVariantId,
        studentId: req.user.id,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            images: true,
          },
        },
        roomVariant: {
          select: {
            id: true,
            name: true,
            fullPrice: true,
            halfPrice: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "تم إرسال طلب الحجز بنجاح.",
      booking: { ...booking, totalPrice },
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
              images: true,
              policy: true,
              owner: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          roomVariant: {
            select: { id: true, name: true, fullPrice: true, halfPrice: true },
          },
          payment: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ bookings });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/owner",
  authenticate,
  authorize("OWNER"),
  async (req, res, next) => {
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
            select: {
              id: true,
              title: true,
              city: true,
              images: true,
            },
          },
          roomVariant: {
            select: { id: true, name: true, fullPrice: true, halfPrice: true },
          },
          student: {
            select: { id: true, name: true, email: true, phone: true },
          },
          payment: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ bookings });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/:id", authenticate, async (req, res, next) => {
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
            images: true,
            policy: true,
            ownerId: true,
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        roomVariant: {
          select: { id: true, name: true, fullPrice: true, halfPrice: true },
        },
        student: {
          select: { id: true, name: true, email: true, phone: true },
        },
        payment: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "الحجز غير موجود." });
    }

    // Only the student or the property owner can view the booking
    const isStudent = booking.studentId === req.user.id;
    const isOwner = booking.property.ownerId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isStudent && !isOwner && !isAdmin) {
      return res.status(403).json({ error: "ليس لديك صلاحية لعرض هذا الحجز." });
    }

    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/:id/accept",
  authenticate,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          property: { select: { ownerId: true, title: true } },
          roomVariant: {
            select: { id: true, kind: true, isOccupied: true, partiallyOccupied: true },
          },
        },
      });

      if (!booking) {
        return res.status(404).json({ error: "الحجز غير موجود." });
      }

      if (booking.property.ownerId !== req.user.id) {
        return res
          .status(403)
          .json({ error: "ليس لديك صلاحية لإدارة هذا الحجز." });
      }

      if (booking.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "يمكن قبول الحجوزات قيد الانتظار فقط." });
      }

      if (booking.roomVariant.isOccupied) {
        return res
          .status(400)
          .json({ error: "هذه الغرفة محجوزة بالكامل. لا يمكن قبول هذا الطلب." });
      }

      // Determine the new room state on approval:
      // - SINGLE → fully occupied
      // - DOUBLE empty → partially occupied
      // - DOUBLE partially occupied → fully occupied
      const isDouble = booking.roomVariant.kind === "DOUBLE";
      const newRoomData = isDouble
        ? booking.roomVariant.partiallyOccupied
          ? { isOccupied: true, partiallyOccupied: false }
          : { partiallyOccupied: true }
        : { isOccupied: true };

      const updated = await prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: "APPROVED" },
          include: {
            property: {
              select: { id: true, title: true, city: true },
            },
            roomVariant: {
              select: { id: true, name: true, kind: true, fullPrice: true, halfPrice: true },
            },
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        await tx.roomVariant.update({
          where: { id: booking.roomVariantId },
          data: newRoomData,
        });

        return updatedBooking;
      });

      logAudit({ action: 'ACCEPT', entity: 'BOOKING', entityId: updated.id, user: req.user, details: `قبول حجز` });

      sendBookingAccepted(
        updated.student.email,
        updated.student.name,
        updated.property.title,
        updated.roomVariant.name,
        `${booking.startDate.toLocaleDateString('ar-EG')} - ${booking.endDate.toLocaleDateString('ar-EG')}`
      ).catch(() => {});

      res.json({
        message: "تم قبول طلب الحجز بنجاح.",
        booking: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/reject",
  authenticate,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          property: { select: { ownerId: true } },
        },
      });

      if (!booking) {
        return res.status(404).json({ error: "الحجز غير موجود." });
      }

      if (booking.property.ownerId !== req.user.id) {
        return res
          .status(403)
          .json({ error: "ليس لديك صلاحية لإدارة هذا الحجز." });
      }

      if (booking.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "يمكن رفض الحجوزات قيد الانتظار فقط." });
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "REJECTED" },
        include: {
          property: {
            select: { id: true, title: true, city: true },
          },
          roomVariant: {
            select: { id: true, name: true },
          },
          student: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logAudit({ action: 'REJECT', entity: 'BOOKING', entityId: updated.id, user: req.user, details: `رفض حجز` });

      sendBookingRejected(
        updated.student.email,
        updated.student.name,
        updated.property.title,
        updated.roomVariant.name
      ).catch(() => {});

      res.json({
        message: "تم رفض طلب الحجز.",
        booking: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/cancel",
  authenticate,
  authorize("STUDENT"),
  async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          property: {
            select: { id: true, title: true, ownerId: true },
          },
          roomVariant: {
            select: { id: true, fullPrice: true },
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
          .json({ error: "ليس لديك صلاحية لإلغاء هذا الحجز." });
      }

      if (booking.status === "CANCELLED") {
        return res.status(400).json({ error: "هذا الحجز ملغى مسبقاً." });
      }

      if (booking.status === "REJECTED") {
        return res.status(400).json({ error: "لا يمكن إلغاء حجز مرفوض." });
      }

      if (booking.status === "COMPLETED") {
        return res.status(400).json({ error: "لا يمكن إلغاء حجز مكتمل." });
      }

      // Calculate refund based on cancellation policy (UC-12)
      let refundPercentage = 0;
      let refundAmount = 0;
      let originalAmount = 0;

      if (booking.status === "APPROVED") {
        // Not paid yet — nothing to refund, just cancel
        refundPercentage = 100;
      } else if (booking.status === "PAID" && booking.payment) {
        originalAmount = Number(booking.payment.amount);
        const paymentDate = booking.payment.createdAt;
        const now = new Date();
        const daysSincePayment = Math.floor(
          (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSincePayment <= 3) {
          refundPercentage = 100;
        } else if (daysSincePayment <= 7) {
          refundPercentage = 50;
        } else {
          refundPercentage = 0;
        }

        refundAmount = originalAmount * (refundPercentage / 100);
      }
      // PENDING — just cancel, no payment to refund

      // Update booking status + create refund request (UC-13) if applicable
      const wasBedOccupied = ["APPROVED", "PAID"].includes(booking.status);

      const updated = await prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
          include: {
            property: {
              select: { id: true, title: true, city: true },
            },
            roomVariant: {
              select: { id: true, name: true, kind: true, fullPrice: true },
            },
          },
        });

        if (wasBedOccupied) {
          // Recompute room state from remaining active bookings
          const otherActive = await tx.booking.count({
            where: {
              roomVariantId: booking.roomVariantId,
              id: { not: booking.id },
              status: { in: ["APPROVED", "PAID"] },
            },
          });
          const isDouble = updatedBooking.roomVariant.kind === "DOUBLE";
          const newState = isDouble
            ? { isOccupied: false, partiallyOccupied: otherActive >= 1 }
            : { isOccupied: false, partiallyOccupied: false };
          await tx.roomVariant.update({
            where: { id: booking.roomVariantId },
            data: newState,
          });
        }

        if (booking.status === "PAID" && refundAmount > 0) {
          await tx.refundRequest.create({
            data: {
              bookingId: booking.id,
              studentId: req.user.id,
              originalAmount,
              refundAmount,
              refundPercentage,
              reason: "إلغاء الحجز من قبل الطالب",
              status: "PENDING",
            },
          });
        }

        return updatedBooking;
      });

      logAudit({ action: 'CANCEL', entity: 'BOOKING', entityId: updated.id, user: req.user, details: `إلغاء حجز` });

      res.json({
        message: "تم إلغاء الحجز بنجاح.",
        booking: updated,
        refund: {
          percentage: refundPercentage,
          amount: refundAmount,
          requestCreated: booking.status === "PAID" && refundAmount > 0,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/complete",
  authenticate,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: {
          property: { select: { ownerId: true } },
        },
      });

      if (!booking) {
        return res.status(404).json({ error: "الحجز غير موجود." });
      }

      if (booking.property.ownerId !== req.user.id) {
        return res
          .status(403)
          .json({ error: "ليس لديك صلاحية لإدارة هذا الحجز." });
      }

      if (booking.status !== "PAID") {
        return res
          .status(400)
          .json({ error: "يمكن إكمال الحجوزات المدفوعة فقط." });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED" },
          include: {
            property: {
              select: { id: true, title: true, city: true },
            },
            roomVariant: {
              select: { id: true, name: true, kind: true },
            },
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        const otherActive = await tx.booking.count({
          where: {
            roomVariantId: booking.roomVariantId,
            id: { not: booking.id },
            status: { in: ["APPROVED", "PAID"] },
          },
        });
        const isDouble = updatedBooking.roomVariant.kind === "DOUBLE";
        const newState = isDouble
          ? { isOccupied: false, partiallyOccupied: otherActive >= 1 }
          : { isOccupied: false, partiallyOccupied: false };
        await tx.roomVariant.update({
          where: { id: booking.roomVariantId },
          data: newState,
        });

        return updatedBooking;
      });

      logAudit({ action: 'COMPLETE', entity: 'BOOKING', entityId: updated.id, user: req.user, details: `إكمال حجز` });

      sendBookingCompleted(
        updated.student.email,
        updated.student.name,
        updated.property.title
      ).catch(() => {});

      res.json({
        message: "تم إكمال الحجز بنجاح وتحرير الغرفة.",
        booking: updated,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/:id/cancellation-policy", authenticate, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { policy: true, title: true } },
        payment: { select: { createdAt: true, amount: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "الحجز غير موجود." });
    }

    let refundPercentage = 0;
    let refundAmount = 0;

    if (booking.status === "APPROVED") {
      refundPercentage = 100;
    } else if (booking.status === "PAID" && booking.payment) {
      const daysSincePayment = Math.floor(
        (Date.now() - booking.payment.createdAt.getTime()) /
          (1000 * 60 * 60 * 24),
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
          { condition: "تم القبول دون دفع", refund: "100%" },
          { condition: "تم الدفع خلال 3 أيام", refund: "100%" },
          { condition: "تم الدفع خلال 4-7 أيام", refund: "50%" },
          { condition: "تم الدفع بعد 7 أيام", refund: "0%" },
          { condition: "تم تسجيل الدخول للسكن مسبقاً", refund: "0%" },
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
