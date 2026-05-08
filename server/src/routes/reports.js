import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { type, targetId, reason, details } = req.body;
    if (!targetId || !reason) {
      return res.status(400).json({ error: 'يرجى تحديد السبب.' });
    }
    const existing = await prisma.report.findFirst({
      where: { targetId, reporterId: req.user.id },
    });
    if (existing) {
      return res.status(400).json({ error: 'لقد أبلغت عن هذا المحتوى مسبقاً.' });
    }
    const report = await prisma.report.create({
      data: {
        type: type || 'REVIEW',
        targetId,
        reporterId: req.user.id,
        reason,
        details: details?.trim() || null,
      },
    });
    res.status(201).json({ message: 'تم إرسال البلاغ بنجاح.', report });
  } catch (err) { next(err); }
});

router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const reports = await prisma.report.findMany({
      where,
      include: { reporter: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let review = null;
        if (r.type === 'REVIEW') {
          review = await prisma.review.findUnique({
            where: { id: r.targetId },
            select: { id: true, rating: true, comment: true, student: { select: { name: true } }, property: { select: { title: true } } },
          }).catch(() => null);
        }
        return { ...r, review };
      }),
    );
    res.json({ reports: enriched });
  } catch (err) { next(err); }
});

router.patch('/:id/review', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { action, adminNote } = req.body;
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'البلاغ غير موجود.' });
    if (action === 'delete_review') {
      await prisma.review.delete({ where: { id: report.targetId } }).catch(() => {});
      await prisma.report.update({
        where: { id: req.params.id },
        data: { status: 'REVIEWED', adminNote: adminNote || 'تم حذف التقييم' },
      });
      res.json({ message: 'تم حذف التقييم وإغلاق البلاغ.' });
    } else {
      await prisma.report.update({
        where: { id: req.params.id },
        data: { status: 'DISMISSED', adminNote: adminNote || null },
      });
      res.json({ message: 'تم رفض البلاغ.' });
    }
  } catch (err) { next(err); }
});

export default router;
