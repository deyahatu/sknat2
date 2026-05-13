import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, requireActive } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { notify } from '../utils/notify.js';
import { sendAccountBlockedEmail } from '../utils/email.js';

const router = Router();

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        idNumber: true,
        gender: true,
        major: true,
        bankName: true,
        bankAccountHolder: true,
        bankAccountNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود.' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

const AVATAR_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,/i;
const UPLOAD_URL_REGEX = /^\/uploads\/[\w-]+\.(jpg|jpeg|png|webp)$/i;

router.put('/profile', authenticate, requireActive, async (req, res, next) => {
  try {
    const { name, phone, email, avatar } = req.body;

    const data = {};

    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim();
    }

    // Email changes are blocked from this endpoint regardless of role.
    // A silent email swap is an account-takeover primitive: an attacker who
    // briefly accesses the session can repoint password-reset emails to
    // themselves. If we ever support email change for owners it must require
    // re-verification of the new address.
    if (typeof email === 'string' && email.trim() && email.trim() !== req.user.email) {
      return res.status(403).json({
        error: 'لا يمكن تغيير البريد الإلكتروني من هذه الصفحة. يرجى التواصل مع الدعم.',
      });
    }

    if (typeof phone === 'string' && phone.trim() && phone.trim() !== req.user.phone) {
      const nextPhone = phone.trim();
      if (!/^\d{10}$/.test(nextPhone)) {
        return res.status(400).json({ error: 'رقم الجوال يجب أن يتكوّن من 10 أرقام بالضبط.' });
      }
      const existing = await prisma.user.findUnique({ where: { phone: nextPhone } });
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'رقم الجوال هذا مرتبط بحساب آخر.' });
      }
      data.phone = nextPhone;
    }

    if (avatar === null) {
      data.avatar = null;
    } else if (typeof avatar === 'string' && avatar) {
      if (!AVATAR_REGEX.test(avatar) && !UPLOAD_URL_REGEX.test(avatar)) {
        return res.status(400).json({ error: 'يرجى رفع صورة صحيحة (JPG, PNG, أو WEBP).' });
      }
      data.avatar = avatar;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'لا توجد تغييرات للحفظ.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, createdAt: true },
    });

    res.json({ user: updated });
  } catch (err) {
    if (err?.code === 'P2002') {
      const target = err.meta?.target || [];
      if (target.includes('email')) {
        return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجّل لحساب آخر.' });
      }
      if (target.includes('phone')) {
        return res.status(409).json({ error: 'رقم الجوال هذا مرتبط بحساب آخر.' });
      }
    }
    next(err);
  }
});

router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { q, role } = req.query;
    const where = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (role && ['STUDENT', 'OWNER', 'ADMIN'].includes(role.toUpperCase())) {
      where.role = role.toUpperCase();
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, avatar: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// Admin: get user detail
router.get('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isActive: true, avatar: true, idNumber: true, idPhoto: true,
        gender: true, major: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });
    res.json({ user });
  } catch (err) { next(err); }
});

// UC-28: Block / Unblock activities for a user.
// When blocking, the admin must provide a reason (10-200 chars). The user is
// notified by in-app notification + email and gets one shot at appealing.
router.patch('/:id/toggle-active', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حظر حسابك الخاص.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود.' });
    }

    // Defense-in-depth: the UI hides this action for admin targets, but the
    // backend must also refuse it so a compromised admin can't lock out their
    // colleagues via a direct API call.
    if (user.role === 'ADMIN') {
      return res.status(403).json({
        error: 'لا يمكن حظر حساب مدير آخر.',
      });
    }

    const isBlocking = user.isActive === true;

    let blockReason = null;
    if (isBlocking) {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      if (reason.length < 10 || reason.length > 200) {
        return res.status(400).json({
          error: 'يجب إدخال سبب الحظر (10 إلى 200 حرف).',
        });
      }
      blockReason = reason;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: isBlocking
        ? { isActive: false, blockReason, blockedAt: new Date() }
        : { isActive: true, blockReason: null, blockedAt: null },
      select: { id: true, name: true, email: true, isActive: true, blockReason: true, blockedAt: true },
    });

    logAudit({
      action: 'TOGGLE_ACTIVE',
      entity: 'USER',
      entityId: id,
      user: req.user,
      details: isBlocking ? `حظر — السبب: ${blockReason}` : 'رفع الحظر',
    });

    if (isBlocking) {
      // Best-effort side channels — don't fail the request if email/push break.
      notify(
        id,
        'تم تقييد أنشطة حسابك',
        `${blockReason}`,
        '/profile',
      ).catch(() => {});

      sendAccountBlockedEmail(updated.email, updated.name, blockReason).catch(() => {});
    }

    res.json({
      message: isBlocking ? 'تم حظر أنشطة الحساب بنجاح.' : 'تم رفع الحظر عن الحساب بنجاح.',
      user: updated,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, email: true, phone: true, idNumber: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'المستخدم غير موجود.' });
    }

    // Defense-in-depth: refuse to delete another admin even if the UI somehow
    // allows it. Prevents one rogue/compromised admin from removing the rest.
    if (target.role === 'ADMIN') {
      return res.status(403).json({
        error: 'لا يمكن حذف حساب مدير آخر.',
      });
    }

    if (target.role === 'STUDENT') {
      // Hard rule: a student with money locked in the system can't be deleted —
      // that would orphan the payment + lose refund eligibility.
      const paidBookings = await prisma.booking.count({
        where: { studentId: id, status: 'PAID' },
      });
      if (paidBookings > 0) {
        return res.status(400).json({
          error: 'هذا الحساب لديه حجز مدفوع نشط. لا يمكن حذفه. يمكنك حظر الأنشطة بدلاً من ذلك.',
        });
      }

      // For APPROVED bookings (no money yet): cancel them and free their rooms
      // before the cascade nukes the booking row. Notify the owner so the
      // room doesn't silently vanish from their queue.
      const approvedBookings = await prisma.booking.findMany({
        where: { studentId: id, status: 'APPROVED' },
        include: {
          property: { select: { id: true, title: true, ownerId: true } },
          roomVariant: { select: { id: true, kind: true } },
        },
      });

      for (const b of approvedBookings) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: b.id },
            data: { status: 'CANCELLED' },
          });
          // Recompute room occupancy from remaining active bookings on that room.
          const otherActive = await tx.booking.count({
            where: {
              roomVariantId: b.roomVariantId,
              id: { not: b.id },
              status: { in: ['APPROVED', 'PAID'] },
            },
          });
          const isDouble = b.roomVariant.kind === 'DOUBLE';
          const newState = isDouble
            ? { isOccupied: otherActive >= 2, partiallyOccupied: otherActive === 1 }
            : { isOccupied: otherActive >= 1, partiallyOccupied: false };
          await tx.roomVariant.update({
            where: { id: b.roomVariantId },
            data: newState,
          });
        });

        notify(
          b.property.ownerId,
          'تم حذف حساب الطالب',
          `تم حذف حساب الطالب "${target.name}". حجزه على ${b.property.title} لم يعد متاحاً.`,
          '/owner/bookings',
        ).catch(() => {});
      }
    }

    if (target.role === 'OWNER') {
      // Owner deletion takes down all their properties via cascade. Block the
      // delete if any active booking (APPROVED/PAID) is in play — students
      // would lose their stay or their money silently.
      const blockingBookings = await prisma.booking.count({
        where: {
          property: { ownerId: id },
          status: { in: ['APPROVED', 'PAID'] },
        },
      });
      if (blockingBookings > 0) {
        return res.status(400).json({
          error: 'هذا المالك لديه حجوزات نشطة (مقبولة أو مدفوعة). لا يمكن حذف الحساب. يمكنك حظر الأنشطة بدلاً من ذلك.',
        });
      }
    }

    // Record the identity on the blocklist BEFORE deleting so the same person
    // can't immediately re-register with the same email/phone/idNumber.
    await prisma.$transaction([
      prisma.blockedIdentity.create({
        data: {
          email: target.email || null,
          phone: target.phone || null,
          idNumber: target.idNumber || null,
          reason: 'تم حذف الحساب من قبل الإدارة',
          blockedBy: req.user.id,
        },
      }),
      prisma.user.delete({ where: { id } }),
    ]);
    logAudit({ action: 'DELETE', entity: 'USER', entityId: id, user: req.user, details: null });
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    next(err);
  }
});

export default router;
