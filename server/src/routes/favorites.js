import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, requireActive } from '../middleware/auth.js';

const router = Router();

// GET /api/favorites — list student's favorites
router.get('/', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        property: {
          include: {
            owner: { select: { id: true, name: true } },
            reviews: { select: { rating: true } },
            _count: { select: { reviews: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const decorated = favorites.map((f) => {
      const ratings = f.property?.reviews || [];
      const avgRating = ratings.length
        ? Number((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1))
        : 0;
      const { reviews: _ignored, ...propRest } = f.property || {};
      return { ...f, property: { ...propRest, avgRating } };
    });

    res.json({ favorites: decorated });
  } catch (err) {
    next(err);
  }
});

// POST /api/favorites — add a property to favorites
router.post('/', authenticate, requireActive, authorize('STUDENT'), async (req, res, next) => {
  try {
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: 'معرّف السكن مطلوب.' });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });

    if (!property) {
      return res.status(404).json({ error: 'السكن غير موجود.' });
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: { userId: req.user.id, propertyId },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'هذا السكن موجود في المفضلة بالفعل.',
      });
    }

    const favorite = await prisma.favorite.create({
      data: { userId: req.user.id, propertyId },
    });

    res.status(201).json({
      message: 'تمت إضافة السكن إلى المفضلة.',
      favorite,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/favorites/:propertyId — remove from favorites
router.delete(
  '/:propertyId',
  authenticate,
  requireActive,
  authorize('STUDENT'),
  async (req, res, next) => {
    try {
      const existing = await prisma.favorite.findUnique({
        where: {
          userId_propertyId: {
            userId: req.user.id,
            propertyId: req.params.propertyId,
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'هذا السكن ليس في المفضلة.' });
      }

      await prisma.favorite.delete({ where: { id: existing.id } });

      res.json({ message: 'تمت إزالة السكن من المفضلة.' });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/favorites/check/:propertyId — quick check if a property is favorited
router.get(
  '/check/:propertyId',
  authenticate,
  authorize('STUDENT'),
  async (req, res, next) => {
    try {
      const fav = await prisma.favorite.findUnique({
        where: {
          userId_propertyId: {
            userId: req.user.id,
            propertyId: req.params.propertyId,
          },
        },
      });

      res.json({ isFavorited: !!fav });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
