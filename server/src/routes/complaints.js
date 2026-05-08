import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { notify } from '../utils/notify.js';

const router = Router();

// Create complaint
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
      include: { replies: true },
    });
    res.status(201).json({ message: 'تم تقديم الشكوى بنجاح.', complaint });
  } catch (err) { next(err); }
});

// My complaints (with replies)
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { userId: req.user.id },
      include: {
        replies: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) { next(err); }
});

// Get single complaint (with replies)
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        replies: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة.' });
    if (req.user.role !== 'ADMIN' && complaint.userId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح.' });
    }
    res.json({ complaint });
  } catch (err) { next(err); }
});

// Admin: list all (with replies count)
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { replies: true } },
        replies: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) { next(err); }
});

// Update status
router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة.' });
    const updated = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status },
    });
    notify(complaint.userId, 'تحديث حالة شكواك', `تم تغيير حالة شكواك إلى: ${status}`, '/complaints');
    res.json({ message: 'تم تحديث الحالة.', complaint: updated });
  } catch (err) { next(err); }
});

// Add reply (admin or complaint owner)
router.post('/:id/replies', authenticate, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'الرد لا يمكن أن يكون فارغاً.' });

    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة.' });

    if (req.user.role !== 'ADMIN' && complaint.userId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح.' });
    }

    const reply = await prisma.ticketReply.create({
      data: {
        complaintId: req.params.id,
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        message: message.trim(),
      },
    });

    // Update complaint status to IN_REVIEW if admin replies to OPEN ticket
    if (req.user.role === 'ADMIN' && complaint.status === 'OPEN') {
      await prisma.complaint.update({
        where: { id: req.params.id },
        data: { status: 'IN_REVIEW', adminResponse: message.trim() },
      });
    }

    // Notify the other party
    if (req.user.role === 'ADMIN') {
      notify(complaint.userId, 'رد جديد على شكواك', message.trim(), '/complaints');
    }

    res.status(201).json({ reply });
  } catch (err) { next(err); }
});

export default router;
