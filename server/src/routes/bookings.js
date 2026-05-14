import { Router } from "express";
import prisma from "../utils/prisma.js";
import { authenticate, authorize, requireActive } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";
import { sendBookingAccepted, sendBookingRejected, sendBookingCompleted } from "../utils/email.js";
import { notify, notifyAllAdmins } from '../utils/notify.js';

const router = Router();

// Shared refund policy constants — single source of truth
const REFUND_FULL_DAYS = 3;
const REFUND_HALF_DAYS = 7;

function calcRefundPercentage(daysSincePayment) {
  if (daysSincePayment <= REFUND_FULL_DAYS) return 100;
  if (daysSincePayment <= REFUND_HALF_DAYS) return 50;
  return 0;
}

router.post("/", authenticate, requireActive, authorize("STUDENT"), async (req, res, next) => {
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

    // Minimum booking duration: 30 days (one month)
    const durationMs = end.getTime() - start.getTime();
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));
    if (durationDays < 30) {
      return res
        .status(400)
        .json({ error: "يجب أن تكون فترة الحجز 30 يوم على الأقل (شهر)." });
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
        owner: { select: { isActive: true } },
      },
    });

    if (!property) {
      return res.status(404).json({ error: "السكن غير موجود." });
    }

    if (!property.available) {
      return res.status(400).json({ error: "هذا السكن غير متاح." });
    }

    // Owner blocked from activities — refuse new bookings on their listings.
    if (property.owner?.isActive === false) {
      return res.status(400).json({
        error: "هذا السكن غير متاح حالياً للحجز. يرجى المحاولة لاحقاً.",
      });
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
        monthlyPrice,
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

    notify(property.ownerId, 'طلب حجز جديد', 'طالب جديد يريد حجز غرفة', '/owner/bookings').catch(() => {});

    notifyAllAdmins(
      'حجز جديد',
      `${req.user.name} طلب حجز ${property.title}`,
      '/admin',
    ).catch(() => {});

    res.status(201).json({
      message: "تم إرسال طلب الحجز بنجاح.",
      booking: { ...booking, totalPrice },
    });
  } catch (err) {
    next(err);
  }
});

// UC: Renew a booking (student requests to extend the same room/property after current end)
router.post('/:id/renew', authenticate, requireActive, authorize('STUDENT'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'يرجى تحديد تاريخي بداية ونهاية للتجديد.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'يرجى إدخال تواريخ صحيحة.' });
    }
    if (start >= end) {
      return res.status(400).json({ error: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية.' });
    }

    const renewDurationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (renewDurationDays < 30) {
      return res.status(400).json({ error: 'يجب أن تكون فترة التجديد 30 يوم على الأقل (شهر).' });
    }

    const parent = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            ownerId: true,
            available: true,
            owner: { select: { isActive: true } },
          },
        },
        roomVariant: { select: { id: true, kind: true, fullPrice: true, halfPrice: true } },
        renewals: { select: { id: true, status: true } },
      },
    });

    if (!parent) {
      return res.status(404).json({ error: 'الحجز غير موجود.' });
    }
    if (parent.studentId !== req.user.id) {
      return res.status(403).json({ error: 'لا يمكنك تجديد حجز ليس لك.' });
    }
    if (!['APPROVED', 'PAID'].includes(parent.status)) {
      return res.status(400).json({ error: 'يمكن تجديد الحجوزات النشطة فقط (المقبولة أو المدفوعة).' });
    }
    // Owner blocked from activities — they wouldn't be able to approve the
    // renewal anyway, so block it upfront with a clear message.
    if (parent.property.owner?.isActive === false) {
      return res.status(400).json({
        error: 'لا يمكن تجديد الحجز حالياً لأن المالك غير متاح. يرجى المحاولة لاحقاً.',
      });
    }

    // Only one open renewal at a time
    const openRenewal = parent.renewals.find((r) =>
      ['PENDING', 'APPROVED', 'PAID'].includes(r.status),
    );
    if (openRenewal) {
      return res.status(400).json({ error: 'يوجد طلب تجديد سابق على هذا الحجز.' });
    }

    // Renewal window: parent.endDate must be within the next RENEWAL_WINDOW_DAYS
    const RENEWAL_WINDOW_DAYS = 5;
    const now = new Date();
    const windowEnd = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (parent.endDate < now) {
      return res.status(400).json({ error: 'لا يمكن تجديد حجز انتهت مدته.' });
    }
    if (parent.endDate > windowEnd) {
      return res.status(400).json({
        error: `يمكن طلب التجديد فقط خلال آخر ${RENEWAL_WINDOW_DAYS} أيام قبل انتهاء الحجز.`,
      });
    }

    // Renewal must start on/after parent's end date
    if (start < parent.endDate) {
      return res.status(400).json({
        error: 'تاريخ بداية التجديد يجب أن يكون في أو بعد تاريخ انتهاء الحجز الحالي.',
      });
    }

    // No overlap with another student's active booking on the same room
    const otherConflict = await prisma.booking.findFirst({
      where: {
        roomVariantId: parent.roomVariantId,
        studentId: { not: req.user.id },
        status: { in: ['APPROVED', 'PAID'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });
    if (otherConflict) {
      return res.status(400).json({ error: 'الغرفة محجوزة من قِبل طالب آخر في الفترة المطلوبة.' });
    }

    // Student must not have another active booking elsewhere overlapping the renewal period.
    // Exclude the parent itself — its dates end before the renewal starts, but be explicit.
    const studentConflict = await prisma.booking.findFirst({
      where: {
        studentId: req.user.id,
        id: { not: parent.id },
        status: { in: ['APPROVED', 'PAID'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });
    if (studentConflict) {
      return res.status(400).json({
        error: 'لا يمكن طلب التجديد: لديك حجز مؤكد آخر يتداخل مع فترة التجديد.',
      });
    }

    // Calculate price (same rules as a normal booking)
    const isDouble = parent.roomVariant.kind === 'DOUBLE';
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const months = Math.max(1, diffDays / 30);
    const monthlyPrice = isDouble
      ? (parent.roomVariant.halfPrice
          ? Number(parent.roomVariant.halfPrice)
          : Number(parent.roomVariant.fullPrice) / 2)
      : Number(parent.roomVariant.fullPrice);
    const totalPrice = Math.round(monthlyPrice * months * 100) / 100;

    const renewal = await prisma.booking.create({
      data: {
        startDate: start,
        endDate: end,
        status: 'PENDING',
        propertyId: parent.propertyId,
        roomVariantId: parent.roomVariantId,
        studentId: req.user.id,
        parentBookingId: parent.id,
        monthlyPrice,
      },
      include: {
        property: { select: { id: true, title: true, city: true, images: true } },
        roomVariant: { select: { id: true, name: true, fullPrice: true, halfPrice: true } },
      },
    });

    notify(
      parent.property.ownerId,
      'طلب تجديد حجز',
      `الطالب يرغب بتجديد حجزه على ${parent.property.title}`,
      '/owner/bookings',
    ).catch(() => {});

    notifyAllAdmins(
      'طلب تجديد حجز',
      `${req.user.name} طلب تجديد حجز ${parent.property.title}`,
      '/admin',
    ).catch(() => {});

    logAudit({ action: 'RENEW_REQUEST', entity: 'BOOKING', entityId: renewal.id, user: req.user, details: `طلب تجديد لحجز ${parent.property.title}` });

    res.status(201).json({
      message: 'تم إرسال طلب التجديد بنجاح. بانتظار موافقة المالك.',
      booking: { ...renewal, totalPrice },
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
          renewals: {
            select: { id: true, status: true, startDate: true, endDate: true },
          },
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
            select: {
              id: true, name: true, email: true, phone: true,
              studentRatingsReceived: {
                select: { overallRating: true },
              },
            },
          },
          payment: true,
          parentBooking: {
            select: { id: true, startDate: true, endDate: true, status: true },
          },
          studentRating: {
            select: { overallRating: true, behaviorRating: true, cleanlinessRating: true, communicationRating: true, comment: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const decorated = bookings.map((b) => {
        const ratings = b.student?.studentRatingsReceived || [];
        const avgRating = ratings.length
          ? Number((ratings.reduce((s, r) => s + r.overallRating, 0) / ratings.length).toFixed(1))
          : null;
        const { studentRatingsReceived, ...studentRest } = b.student || {};
        return { ...b, student: { ...studentRest, avgRating, totalRatings: ratings.length } };
      });

      res.json({ bookings: decorated });
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
  requireActive,
  authorize("OWNER"),
  async (req, res, next) => {
    try {
      // Fast authorization check before opening a transaction.
      const initial = await prisma.booking.findUnique({
        where: { id: req.params.id },
        select: { id: true, property: { select: { ownerId: true } } },
      });

      if (!initial) {
        return res.status(404).json({ error: "الحجز غير موجود." });
      }

      if (initial.property.ownerId !== req.user.id) {
        return res
          .status(403)
          .json({ error: "ليس لديك صلاحية لإدارة هذا الحجز." });
      }

      // All state checks + the update run inside one serializable transaction so
      // concurrent approvals (race condition) can't both pass the same overlap guard.
      let updated;
      let isRenewal = false;
      try {
        updated = await prisma.$transaction(
          async (tx) => {
            const booking = await tx.booking.findUnique({
              where: { id: req.params.id },
              include: {
                property: { select: { ownerId: true, title: true } },
                roomVariant: {
                  select: { id: true, kind: true, isOccupied: true, partiallyOccupied: true },
                },
                parentBooking: { select: { id: true, status: true } },
              },
            });

            if (booking.status !== "PENDING") {
              const err = new Error("يمكن قبول الحجوزات قيد الانتظار فقط.");
              err.statusCode = 400;
              throw err;
            }

            // Reject if the booking's entire window has already passed.
            // Without this an owner could approve a months-old PENDING request
            // and trigger payment / room state changes for a stay that never happened.
            if (booking.endDate <= new Date()) {
              const err = new Error("لا يمكن قبول هذا الطلب: تاريخ انتهاء الحجز انقضى.");
              err.statusCode = 400;
              throw err;
            }

            // Reject if the booking's start date has already passed. A months-old
            // PENDING request whose stay was supposed to begin in the past would
            // retroactively occupy the room and skew refund/analytics windows.
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            if (booking.startDate < startOfToday) {
              const err = new Error("لا يمكن قبول هذا الطلب: تاريخ بداية الحجز قد مضى. يرجى من الطالب إنشاء طلب جديد بتواريخ مناسبة.");
              err.statusCode = 400;
              throw err;
            }

            isRenewal = !!booking.parentBookingId;

            // Renewal becomes orphaned if its parent was cancelled/rejected/completed.
            if (
              isRenewal &&
              booking.parentBooking &&
              !["APPROVED", "PAID"].includes(booking.parentBooking.status)
            ) {
              const err = new Error("لا يمكن قبول هذا التجديد: الحجز الأصلي لم يعد نشطاً.");
              err.statusCode = 400;
              throw err;
            }

            if (!isRenewal && booking.roomVariant.isOccupied) {
              const err = new Error("هذه الغرفة محجوزة بالكامل. لا يمكن قبول هذا الطلب.");
              err.statusCode = 400;
              throw err;
            }

            // Student must not have another active booking overlapping these dates.
            const excludeIds = isRenewal
              ? [booking.id, booking.parentBookingId]
              : [booking.id];
            const studentConflict = await tx.booking.findFirst({
              where: {
                studentId: booking.studentId,
                id: { notIn: excludeIds },
                status: { in: ["APPROVED", "PAID"] },
                startDate: { lt: booking.endDate },
                endDate: { gt: booking.startDate },
              },
            });
            if (studentConflict) {
              const err = new Error(
                "لا يمكن قبول هذا الطلب: الطالب لديه حجز مؤكد آخر يتداخل مع هذه الفترة.",
              );
              err.statusCode = 400;
              throw err;
            }

            // For renewals: the room may have been claimed by another student
            // after the renewal was requested. Re-verify here.
            if (isRenewal) {
              const otherConflict = await tx.booking.findFirst({
                where: {
                  roomVariantId: booking.roomVariantId,
                  studentId: { not: booking.studentId },
                  id: { not: booking.id },
                  status: { in: ["APPROVED", "PAID"] },
                  startDate: { lt: booking.endDate },
                  endDate: { gt: booking.startDate },
                },
              });
              if (otherConflict) {
                const err = new Error(
                  "تم حجز هذه الغرفة من قِبل طالب آخر في فترة التجديد. لا يمكن قبول الطلب.",
                );
                err.statusCode = 400;
                throw err;
              }
            }

            // Compute new room state (regular booking only):
            // SINGLE → fully occupied; DOUBLE: empty→partial, partial→full.
            const isDouble = booking.roomVariant.kind === "DOUBLE";
            const newRoomData = isDouble
              ? booking.roomVariant.partiallyOccupied
                ? { isOccupied: true, partiallyOccupied: false }
                : { partiallyOccupied: true }
              : { isOccupied: true };

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

            if (!isRenewal) {
              await tx.roomVariant.update({
                where: { id: booking.roomVariantId },
                data: newRoomData,
              });
            }

            return updatedBooking;
          },
          { isolationLevel: "Serializable" },
        );
      } catch (txErr) {
        if (txErr.statusCode) {
          return res.status(txErr.statusCode).json({ error: txErr.message });
        }
        // PostgreSQL serialization failure — concurrent transaction conflicted.
        if (
          txErr.code === "P2034" ||
          (typeof txErr.message === "string" && txErr.message.includes("40001"))
        ) {
          return res.status(409).json({
            error: "حدث تعارض أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.",
          });
        }
        throw txErr;
      }

      logAudit({ action: 'ACCEPT', entity: 'BOOKING', entityId: updated.id, user: req.user, details: `قبول حجز` });

      sendBookingAccepted(
        updated.student.email,
        updated.student.name,
        updated.property.title,
        updated.roomVariant.name,
        `${updated.startDate.toLocaleDateString('ar-EG')} - ${updated.endDate.toLocaleDateString('ar-EG')}`
      ).catch(() => {});

      notify(
        updated.student.id,
        isRenewal ? 'تم قبول طلب التجديد' : 'تم قبول حجزك',
        isRenewal ? 'وافق المالك على طلب تجديد حجزك ✅' : 'تم قبول طلب حجزك ✅',
        '/bookings',
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
  requireActive,
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

      const isRenewal = !!booking.parentBookingId;

      sendBookingRejected(
        updated.student.email,
        updated.student.name,
        updated.property.title,
        updated.roomVariant.name
      ).catch(() => {});

      notify(
        updated.student.id,
        isRenewal ? 'تم رفض طلب التجديد' : 'تم رفض حجزك',
        isRenewal ? 'رفض المالك طلب تجديد حجزك ❌' : 'تم رفض طلب حجزك ❌',
        '/bookings',
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
  requireActive,
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

        refundPercentage = calcRefundPercentage(daysSincePayment);
        refundAmount = Math.max(0, originalAmount * (refundPercentage / 100));
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

        // Cascade-cancel any PENDING renewals — they can no longer be approved
        // (the parent they depend on is gone) and shouldn't linger in the owner's queue.
        await tx.booking.updateMany({
          where: {
            parentBookingId: booking.id,
            status: "PENDING",
          },
          data: { status: "CANCELLED" },
        });

        if (wasBedOccupied) {
          // Recompute room state from remaining active bookings (incl. renewals)
          const otherActive = await tx.booking.count({
            where: {
              roomVariantId: booking.roomVariantId,
              id: { not: booking.id },
              status: { in: ["APPROVED", "PAID"] },
            },
          });
          const isDouble = updatedBooking.roomVariant.kind === "DOUBLE";
          const newState = isDouble
            ? { isOccupied: otherActive >= 2, partiallyOccupied: otherActive === 1 }
            : { isOccupied: otherActive >= 1, partiallyOccupied: false };
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

      notify(
        booking.property.ownerId,
        'تم إلغاء حجز',
        `قام ${req.user.name} بإلغاء حجز ${booking.property.title}.`,
        '/owner/bookings',
      ).catch(() => {});

      notifyAllAdmins(
        booking.status === 'PAID' && refundAmount > 0
          ? 'طلب استرداد جديد'
          : 'إلغاء حجز',
        booking.status === 'PAID' && refundAmount > 0
          ? `${req.user.name} ألغى حجز ${booking.property.title} — استرداد ${refundAmount} ₪ (${refundPercentage}%)`
          : `${req.user.name} ألغى حجز ${booking.property.title}`,
        '/admin',
      ).catch(() => {});

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
  requireActive,
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

      // The booking can only be marked COMPLETED after its stay window has
      // actually ended. Otherwise an owner could close out a booking on day 1
      // and immediately leave a damaging student rating for a stay that never
      // happened (or downgrade analytics on a still-active room).
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (booking.endDate > startOfToday) {
        return res
          .status(400)
          .json({ error: "لا يمكن إكمال الحجز قبل انتهاء مدته." });
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
        // SINGLE: occupied iff exactly one active (renewal continuing)
        // DOUBLE: full only if both beds active, partial if at least one
        const newState = isDouble
          ? { isOccupied: otherActive >= 2, partiallyOccupied: otherActive === 1 }
          : { isOccupied: otherActive >= 1, partiallyOccupied: false };
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

      notify(updated.student.id, 'اكتمل حجزك', 'تم إكمال حجزك 🏠', '/bookings').catch(() => {});

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
        property: { select: { policy: true, title: true, ownerId: true } },
        payment: { select: { createdAt: true, amount: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "الحجز غير موجود." });
    }

    // Only the booking's student, the property owner, or an admin may read the
    // policy + refund amount. Otherwise anyone could enumerate /:id and harvest
    // payment amounts (and the property's pricing strategy) across the platform.
    const isStudent = booking.studentId === req.user.id;
    const isOwner = booking.property.ownerId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isStudent && !isOwner && !isAdmin) {
      return res.status(403).json({ error: "لا يمكنك الوصول لهذه المعلومات." });
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

      refundPercentage = calcRefundPercentage(daysSincePayment);
      refundAmount = Math.max(0, Number(booking.payment.amount) * (refundPercentage / 100));
    }

    res.json({
      policy: {
        propertyPolicy: booking.property.policy,
        rules: [
          { condition: "تم القبول دون دفع", refund: "100%" },
          { condition: "تم الدفع خلال 3 أيام", refund: "100%" },
          { condition: "تم الدفع خلال 4-7 أيام", refund: "50%" },
          { condition: "تم الدفع بعد 7 أيام", refund: "0%" },
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
