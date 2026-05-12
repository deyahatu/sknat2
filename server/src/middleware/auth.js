import { verifyToken } from '../utils/jwt.js';
import prisma from '../utils/prisma.js';

export async function authenticate(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
    }

    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        gender: true,
        isActive: true,
        blockReason: true,
        blockedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'المستخدم غير موجود' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة غير صالحة - يرجى تسجيل الدخول مجدداً' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' });
    }
    next();
  };
}

// Block state-changing actions for users who have been "activity-blocked" by
// an admin. They can still log in and read their data, but POST/PATCH/DELETE
// must be refused. Admins are exempt — they manage the blocking themselves
// and the toggle-active endpoint already forbids self-block.
export function requireActive(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح' });
  }
  if (req.user.role === 'ADMIN') return next();
  if (req.user.isActive === false) {
    return res.status(403).json({
      error: 'حسابك محظور من تنفيذ هذه العملية. يرجى التواصل مع الإدارة.',
    });
  }
  next();
}
