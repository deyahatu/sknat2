import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/:paymentId', authenticate, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: {
        student: { select: { name: true, email: true, phone: true } },
        booking: {
          include: {
            property: { select: { title: true, city: true, address: true, owner: { select: { name: true } } } },
            roomVariant: { select: { name: true, fullPrice: true } },
          },
        },
      },
    });

    if (!payment) return res.status(404).json({ error: 'الدفعة غير موجودة.' });
    if (payment.studentId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'غير مصرح.' });
    }

    const invoice = {
      id: payment.id.slice(0, 8).toUpperCase(),
      date: new Date(payment.createdAt).toLocaleDateString('ar-EG'),
      student: payment.student,
      property: payment.booking.property,
      room: payment.booking.roomVariant,
      amount: Number(payment.amount),
      startDate: new Date(payment.booking.startDate).toLocaleDateString('ar-EG'),
      endDate: new Date(payment.booking.endDate).toLocaleDateString('ar-EG'),
    };

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

export default router;
