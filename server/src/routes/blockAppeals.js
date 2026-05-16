import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { notify, notifyAllAdmins } from '../utils/notify.js';

const router = Router();

// Blocked user submits a single appeal for their current block. We don't allow
// a second appeal while the previous one is still pending or while the user
// remains blocked from the same incident — they get one shot per block cycle.
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.isActive !== false) {
      return res.status(400).json({
        error: 'حسابك غير محظور — لا حاجة لتقديم اعتراض.',
      });
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 10 || message.length > 500) {
      return res.status(400).json({
        error: 'يجب إدخال نص الاعتراض (10 إلى 500 حرف).',
      });
    }

    // One appeal per current block. We tie "current" to the user's blockedAt
    // timestamp — appeals from before this block stay as history.
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { blockedAt: true, name: true },
    });

    const existing = me?.blockedAt
      ? await prisma.blockAppeal.findFirst({
          where: { userId: req.user.id, createdAt: { gte: me.blockedAt } },
        })
      : null;

    if (existing) {
      return res.status(400).json({
        error: 'لقد قمت بتقديم اعتراض مسبقاً على هذا الحظر.',
      });
    }

    const appeal = await prisma.blockAppeal.create({
      data: {
        userId: req.user.id,
        message,
        status: 'PENDING',
      },
    });

    logAudit({
      action: 'APPEAL_SUBMIT',
      entity: 'BLOCK_APPEAL',
      entityId: appeal.id,
      user: req.user,
      details: null,
    });

    notifyAllAdmins(
      'اعتراض حظر جديد',
      `${req.user.name} قدّم اعتراضاً على حظر حسابه`,
      '/admin?tab=appeals',
    ).catch(() => {});

    res.status(201).json({
      message: 'تم تقديم اعتراضك بنجاح. سيتم مراجعته من قبل الإدارة.',
      appeal,
    });
  } catch (err) {
    next(err);
  }
});

// Logged-in user fetches their own most-recent appeal (used to show status
// banner: pending / accepted / rejected).
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const appeal = await prisma.blockAppeal.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ appeal });
  } catch (err) {
    next(err);
  }
});

// Admin: list all pending appeals (with the user info).
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && ['PENDING', 'ACCEPTED', 'REJECTED'].includes(status)) {
      where.status = status;
    }

    const appeals = await prisma.blockAppeal.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            blockReason: true,
            blockedAt: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ appeals });
  } catch (err) {
    next(err);
  }
});

// Admin: accept or reject an appeal. Accepting also unblocks the user.
router.patch('/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const decision = String(req.body?.decision || '').toUpperCase();
    if (!['ACCEPTED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'القرار يجب أن يكون ACCEPTED أو REJECTED.' });
    }

    const adminNote = typeof req.body?.adminNote === 'string'
      ? req.body.adminNote.trim().slice(0, 500)
      : null;

    const appeal = await prisma.blockAppeal.findUnique({
      where: { id: req.params.id },
    });
    if (!appeal) {
      return res.status(404).json({ error: 'الاعتراض غير موجود.' });
    }
    if (appeal.status !== 'PENDING') {
      return res.status(400).json({ error: 'هذا الاعتراض تمت معالجته مسبقاً.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resolved = await tx.blockAppeal.update({
        where: { id: appeal.id },
        data: {
          status: decision,
          adminNote: adminNote || null,
          resolvedAt: new Date(),
        },
      });

      // Accepting an appeal lifts the block on the user.
      if (decision === 'ACCEPTED') {
        await tx.user.update({
          where: { id: appeal.userId },
          data: { isActive: true, blockReason: null, blockedAt: null },
        });
      }

      return resolved;
    });

    logAudit({
      action: decision === 'ACCEPTED' ? 'APPEAL_ACCEPT' : 'APPEAL_REJECT',
      entity: 'BLOCK_APPEAL',
      entityId: appeal.id,
      user: req.user,
      details: adminNote || null,
    });

    notify(
      appeal.userId,
      decision === 'ACCEPTED' ? 'تم قبول اعتراضك' : 'تم رفض اعتراضك',
      decision === 'ACCEPTED'
        ? 'تم رفع الحظر عن حسابك بنجاح.'
        : `لم يتم قبول اعتراضك. ${adminNote ? `الملاحظة: ${adminNote}` : ''}`,
      '/profile',
    ).catch(() => {});

    res.json({
      message: decision === 'ACCEPTED' ? 'تم قبول الاعتراض ورفع الحظر.' : 'تم رفض الاعتراض.',
      appeal: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
