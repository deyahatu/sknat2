import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

const VALID_REASONS = ['OFFENSIVE', 'FALSE_INFO', 'HARASSMENT', 'POLICY_VIOLATION'];
const VALID_TYPES = ['REVIEW', 'STUDENT_RATING', 'MESSAGE'];

// UC-41: Submit a report on a review, student rating, or chat message
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { type, targetId, reason, details } = req.body;

    if (!targetId) {
      return res.status(400).json({ error: 'يرجى تحديد المحتوى المُبلَّغ عنه.' });
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'يرجى اختيار سبب صحيح للبلاغ.' });
    }
    const reportType = type && VALID_TYPES.includes(type) ? type : 'REVIEW';

    // Verify the target actually exists
    if (reportType === 'REVIEW') {
      const review = await prisma.review.findUnique({ where: { id: targetId } });
      if (!review) return res.status(404).json({ error: 'التقييم غير موجود.' });
      if (review.studentId === req.user.id) {
        return res.status(400).json({ error: 'لا يمكنك الإبلاغ عن تقييمك الخاص.' });
      }
    } else if (reportType === 'STUDENT_RATING') {
      const rating = await prisma.studentRating.findUnique({ where: { id: targetId } });
      if (!rating) return res.status(404).json({ error: 'التقييم غير موجود.' });
      if (rating.ownerId === req.user.id) {
        return res.status(400).json({ error: 'لا يمكنك الإبلاغ عن تقييمك الخاص.' });
      }
    } else {
      // MESSAGE: only the recipient may report a message they received
      const message = await prisma.message.findUnique({ where: { id: targetId } });
      if (!message) return res.status(404).json({ error: 'الرسالة غير موجودة.' });
      if (message.senderId === req.user.id) {
        return res.status(400).json({ error: 'لا يمكنك الإبلاغ عن رسالتك الخاصة.' });
      }
      if (message.receiverId !== req.user.id) {
        return res.status(403).json({ error: 'لا يمكنك الإبلاغ عن رسالة ليست موجهة إليك.' });
      }
    }

    // Prevent duplicate reports from the same user
    const existing = await prisma.report.findFirst({
      where: { targetId, reporterId: req.user.id },
    });
    if (existing) {
      return res.status(400).json({ error: 'لقد أبلغت عن هذا المحتوى مسبقاً.' });
    }

    const report = await prisma.report.create({
      data: {
        type: reportType,
        targetId,
        reporterId: req.user.id,
        reason,
        details: details?.trim() || null,
      },
    });

    res.status(201).json({ message: 'تم إرسال البلاغ بنجاح.', report });
  } catch (err) {
    next(err);
  }
});

// Admin: list all reports with target details enriched
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const reports = await prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      reports.map(async (r) => {
        if (r.type === 'REVIEW') {
          const review = await prisma.review.findUnique({
            where: { id: r.targetId },
            select: {
              id: true,
              rating: true,
              comment: true,
              student: { select: { id: true, name: true } },
              property: { select: { id: true, title: true } },
            },
          }).catch(() => null);
          return { ...r, review, studentRating: null };
        }
        if (r.type === 'STUDENT_RATING') {
          const studentRating = await prisma.studentRating.findUnique({
            where: { id: r.targetId },
            select: {
              id: true,
              behaviorRating: true,
              cleanlinessRating: true,
              communicationRating: true,
              overallRating: true,
              comment: true,
              owner: { select: { id: true, name: true } },
              student: { select: { id: true, name: true } },
            },
          }).catch(() => null);
          return { ...r, studentRating, review: null, message: null };
        }
        if (r.type === 'MESSAGE') {
          const message = await prisma.message.findUnique({
            where: { id: r.targetId },
            select: {
              id: true,
              content: true,
              createdAt: true,
              sender: { select: { id: true, name: true, role: true } },
              receiver: { select: { id: true, name: true, role: true } },
            },
          }).catch(() => null);
          return { ...r, message, review: null, studentRating: null };
        }
        return { ...r, review: null, studentRating: null, message: null };
      }),
    );

    res.json({ reports: enriched });
  } catch (err) {
    next(err);
  }
});

// Admin: act on a report
router.patch('/:id/review', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { action, adminNote } = req.body;
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'البلاغ غير موجود.' });

    if (action === 'delete_target') {
      if (report.type === 'REVIEW') {
        await prisma.review.delete({ where: { id: report.targetId } }).catch(() => {});
      } else if (report.type === 'STUDENT_RATING') {
        await prisma.studentRating.delete({ where: { id: report.targetId } }).catch(() => {});
      } else if (report.type === 'MESSAGE') {
        await prisma.message.delete({ where: { id: report.targetId } }).catch(() => {});
      }
      await prisma.report.update({
        where: { id: req.params.id },
        data: { status: 'REVIEWED', adminNote: adminNote || 'تم حذف المحتوى المُبلَّغ عنه' },
      });
      return res.json({ message: 'تم حذف المحتوى وإغلاق البلاغ.' });
    }

    // Default: dismiss
    await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'DISMISSED', adminNote: adminNote || null },
    });
    res.json({ message: 'تم رفض البلاغ.' });
  } catch (err) {
    next(err);
  }
});

export default router;
