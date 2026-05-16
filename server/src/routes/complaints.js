import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../utils/prisma.js';
import { authenticate, authorize, requireActive } from '../middleware/auth.js';
import { notifyAllAdmins } from '../utils/notify.js';
import { complaintUpload, enforceComplaintFileLimits, filesToUrls, fileToUrl } from '../utils/upload.js';

const router = Router();


const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const UPLOAD_URL_REGEX = /^\/uploads\/[\w-]+\.(jpg|jpeg|png|webp|mp4|webm|mov)$/i;

// Statuses on a Booking that prove the parties had an actual stay (or
// approved one). Used to gate who can complain about whom — without one of
// these between complainant and target, the complaint is rejected.
const RELATIONSHIP_STATUSES = ['APPROVED', 'PAID', 'COMPLETED'];

function cleanupUploadedFiles(files) {
  if (!files) return;
  const arr = Array.isArray(files) ? files : Object.values(files).flat();
  for (const f of arr) {
    fs.unlink(path.join(UPLOAD_DIR, f.filename), () => {});
  }
}

// Upload images + optional video for a complaint. Separate from /api/upload
// so the size/type rules can differ (video allowed, larger size for video).
router.post(
  '/upload',
  authenticate,
  requireActive,
  complaintUpload.fields([
    { name: 'images', maxCount: 8 },
    { name: 'video', maxCount: 1 },
  ]),
  (req, res, next) => {
    try {
      const flat = [
        ...(req.files?.images || []),
        ...(req.files?.video || []),
      ];
      enforceComplaintFileLimits(flat);
      const imageUrls = filesToUrls(req.files?.images || []);
      const videoUrl = req.files?.video?.[0] ? fileToUrl(req.files.video[0]) : null;
      res.json({ imageUrls, videoUrl });
    } catch (err) {
      cleanupUploadedFiles(req.files);
      next(err);
    }
  },
);

// File a complaint. Whoever is filing must have a booking-based relationship
// with the target — student↔owner of a property they booked, or owner↔student
// who booked one of their properties. Status must be in RELATIONSHIP_STATUSES;
// PENDING/REJECTED/CANCELLED bookings don't establish a real relationship.
router.post('/', authenticate, requireActive, async (req, res, next) => {
  try {
    const { targetUserId, subject, description, images, videoUrl, bookingId } = req.body;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ error: 'يرجى تحديد المستخدم المُشتكى عليه.' });
    }
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك تقديم شكوى ضد نفسك.' });
    }

    const subjectStr = String(subject || '').trim();
    const descriptionStr = String(description || '').trim();
    if (!subjectStr || subjectStr.length > 200) {
      return res.status(400).json({ error: 'يرجى إدخال عنوان للشكوى (بحد أقصى 200 حرف).' });
    }
    if (!descriptionStr || descriptionStr.length > 2000) {
      return res.status(400).json({ error: 'يرجى إدخال وصف للشكوى (بحد أقصى 2000 حرف).' });
    }

    // Verify media URLs came from our uploads (no arbitrary URLs)
    const imageArr = Array.isArray(images) ? images.filter((u) => typeof u === 'string') : [];
    if (imageArr.length > 8) {
      return res.status(400).json({ error: 'الحد الأقصى 8 صور.' });
    }
    if (imageArr.some((u) => !UPLOAD_URL_REGEX.test(u))) {
      return res.status(400).json({ error: 'رابط الصورة غير صالح.' });
    }
    if (videoUrl != null && (typeof videoUrl !== 'string' || !UPLOAD_URL_REGEX.test(videoUrl))) {
      return res.status(400).json({ error: 'رابط الفيديو غير صالح.' });
    }

    // Determine direction based on roles
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) return res.status(404).json({ error: 'المستخدم غير موجود.' });

    let complaintType;
    if (req.user.role === 'STUDENT' && target.role === 'OWNER') {
      complaintType = 'STUDENT_VS_OWNER';
    } else if (req.user.role === 'OWNER' && target.role === 'STUDENT') {
      complaintType = 'OWNER_VS_STUDENT';
    } else {
      return res.status(400).json({
        error: 'الشكاوى مسموحة فقط بين الطالب ومالك العقار.',
      });
    }

    // Verify booking relationship. Either side of the booking pair is fine.
    const studentId = complaintType === 'STUDENT_VS_OWNER' ? req.user.id : target.id;
    const ownerId = complaintType === 'STUDENT_VS_OWNER' ? target.id : req.user.id;

    const relationshipBooking = await prisma.booking.findFirst({
      where: {
        studentId,
        status: { in: RELATIONSHIP_STATUSES },
        property: { ownerId },
        ...(bookingId ? { id: String(bookingId) } : {}),
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!relationshipBooking) {
      return res.status(403).json({
        error:
          complaintType === 'STUDENT_VS_OWNER'
            ? 'يمكنك تقديم شكوى فقط ضد مالك سكنت عنده.'
            : 'يمكنك تقديم شكوى فقط ضد طالب سكن لديك.',
      });
    }

    const complaint = await prisma.complaint.create({
      data: {
        type: complaintType,
        complainantId: req.user.id,
        targetUserId: target.id,
        bookingId: relationshipBooking.id,
        subject: subjectStr,
        description: descriptionStr,
        images: imageArr,
        videoUrl: videoUrl || null,
      },
    });

    notifyAllAdmins(
      'شكوى جديدة',
      `${req.user.name} قدّم شكوى — تحتاج مراجعة`,
      '/admin?tab=complaints',
    ).catch(() => {});

    res.status(201).json({ message: 'تم إرسال الشكوى بنجاح.', complaint });
  } catch (err) {
    next(err);
  }
});

// List complaints filed by the current user
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { complainantId: req.user.id },
      include: {
        target: { select: { id: true, name: true, role: true } },
        booking: {
          select: {
            id: true,
            property: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) {
    next(err);
  }
});

// Admin: list all complaints with full context
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        complainant: { select: { id: true, name: true, email: true, role: true } },
        target: { select: { id: true, name: true, email: true, role: true } },
        booking: {
          select: {
            id: true,
            property: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ complaints });
  } catch (err) {
    next(err);
  }
});

// Admin: act on a complaint
router.patch('/:id/review', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { action, adminNote } = req.body;
    const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
    if (!complaint) return res.status(404).json({ error: 'الشكوى غير موجودة.' });
    if (complaint.status !== 'PENDING') {
      return res.status(400).json({ error: 'تمت مراجعة هذه الشكوى مسبقاً.' });
    }

    const noteStr = adminNote ? String(adminNote).slice(0, 1000) : null;

    if (action === 'review' || action === 'reviewed') {
      await prisma.complaint.update({
        where: { id: req.params.id },
        data: { status: 'REVIEWED', adminNote: noteStr },
      });
      return res.json({ message: 'تمت مراجعة الشكوى.' });
    }

    // Default: dismiss
    await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status: 'DISMISSED', adminNote: noteStr },
    });
    res.json({ message: 'تم رفض الشكوى.' });
  } catch (err) {
    next(err);
  }
});

export default router;
