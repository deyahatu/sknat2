import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

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

router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, phone, email, avatar } = req.body;

    const data = {};

    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim();
    }

    if (typeof email === 'string' && email.trim() !== req.user.email) {
      if (req.user.role === 'STUDENT') {
        return res.status(403).json({
          error: 'لا يمكن تغيير البريد الجامعي بعد التسجيل.',
        });
      }
      const nextEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
      }
      const existing = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجّل لحساب آخر.' });
      }
      data.email = nextEmail;
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
      if (!AVATAR_REGEX.test(avatar)) {
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

// UC-28: Activate/Deactivate User
router.patch('/:id/toggle-active', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك الخاص.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, isActive: true },
    });

    logAudit({ action: 'TOGGLE_ACTIVE', entity: 'USER', entityId: id, user: req.user, details: updated.isActive ? 'تفعيل' : 'تعطيل' });

    res.json({
      message: updated.isActive ? 'تم تفعيل الحساب بنجاح.' : 'تم تعطيل الحساب بنجاح.',
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

    await prisma.user.delete({ where: { id } });
    logAudit({ action: 'DELETE', entity: 'USER', entityId: id, user: req.user, details: null });
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    next(err);
  }
});

export default router;
