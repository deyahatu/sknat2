import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { getVapidPublicKey } from '../utils/push.js';

const router = Router();

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ key: getVapidPublicKey() });
});

// Subscribe
router.post('/subscribe', authenticate, async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'بيانات الاشتراك غير صالحة.' });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    res.json({ message: 'تم الاشتراك في الإشعارات.' });
  } catch (err) {
    next(err);
  }
});

// Unsubscribe
router.post('/unsubscribe', authenticate, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
    }
    res.json({ message: 'تم إلغاء الاشتراك.' });
  } catch (err) {
    next(err);
  }
});

export default router;
