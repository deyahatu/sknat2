import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

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

router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, phone, email, avatar } = req.body;

    const data = {};

    if (typeof name === 'string' && name.trim()) {
      data.name = name.trim();
    }

    if (typeof email === 'string' && email.trim() !== req.user.email) {
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

    if (typeof avatar === 'string' && avatar) {
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
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
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
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    next(err);
  }
});

export default router;
