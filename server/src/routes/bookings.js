import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/", authenticate, authorize("STUDENT"), async (req, res, next) => {
  try {
    const { propertyId, startDate, endDate } = req.body;

    if (!propertyId || !startDate || !endDate) {
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
        price: true,
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

    // Student can't book own property
    if (property.ownerId === req.user.id) {
      return res.status(400).json({ error: "لا يمكنك حجز سكنك الخاص." });
    }

    // Check no APPROVED/PAID booking on same property for overlapping dates
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        propertyId,
        status: { in: ["APPROVED", "PAID"] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    if (conflictingBooking) {
      return res
        .status(400)
        .json({ error: "هذه التواريخ غير متاحة. يرجى اختيار تواريخ مختلفة." });
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

    // Calculate total price (price per month, calculate months)
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.max(1, Math.ceil(diffDays / 30));
    const totalPrice = Number(property.price) * months;

    const booking = await prisma.booking.create({
      data: {
        startDate: start,
        endDate: end,
        status: "PENDING",
        propertyId,
        studentId: req.user.id,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            city: true,
            price: true,
            images: true,
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
              price: true,
              images: true,
            },
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

      // Check dates are still available (no other APPROVED/PAID booking)
      const conflict = await prisma.booking.findFirst({
        where: {
          propertyId: booking.propertyId,
          id: { not: booking.id },
          status: { in: ["APPROVED", "PAID"] },
          startDate: { lt: booking.endDate },
          endDate: { gt: booking.startDate },
        },
      });

      if (conflict) {
        return res
          .status(400)
          .json({
            error: "هذه التواريخ لم تعد متاحة. لا يمكن قبول هذا الطلب.",
          });
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "APPROVED" },
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
            select: { id: true, title: true, city: true, price: true },
          },
          student: {
            select: { id: true, name: true, email: true },
          },
        },
      });

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
            select: { id: true, title: true, price: true, ownerId: true },
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
      const updated = await prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
          include: {
            property: {
              select: { id: true, title: true, city: true, price: true },
            },
          },
        });

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
