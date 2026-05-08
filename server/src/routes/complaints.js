import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notify } from '../utils/notify.js';

const router = Router();

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { type, subject, description, image } = req.body;
    if (!type || !subject?.trim() || !description?.trim()) {
      return res.status(400).json({ error: 'يرجى تعبئة جميع الحقول المطلوبة.' });
    }
    const complaint = await prisma.complaint.create({
      data: {
        userId: req.user.id,
        userName: req.user.name,
        type,
        subject: subject.trim(),
        description: description.trim(),
        image: image || null,
      },
    });
    res.status(201).json({ message: 'تم تقديم الشكوى بنجاح.', complaint });
  } catch (err) { next(err); }
});

router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) { next(err); }
});

router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    const complaints = await prisma.complaint.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, adminResponse } = req.body;
    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة.' });
    const updated = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status, adminResponse: adminResponse || null },
    });
    if (adminResponse) {
      notify(complaint.userId, 'رد على شكواك', adminResponse, '/complaints');
    }
    res.json({ message: 'تم تحديث الشكوى.', complaint: updated });
  } catch (err) { next(err); }
});

export default router;
