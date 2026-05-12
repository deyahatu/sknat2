import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, requireActive } from '../middleware/auth.js';
import { emitToUser } from '../utils/socket.js';
import { notify } from '../utils/notify.js';

const router = Router();

// List conversations
router.get('/', authenticate, async (req, res, next) => {
  try {
    const myId = req.user.id;

    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: myId }, { receiverId: myId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true, role: true } },
        receiver: { select: { id: true, name: true, avatar: true, role: true } },
      },
    });

    const convMap = new Map();
    for (const msg of messages) {
      const otherId = msg.senderId === myId ? msg.receiverId : msg.senderId;
      if (!convMap.has(otherId)) {
        const other = msg.senderId === myId ? msg.receiver : msg.sender;
        const unread = messages.filter(m => m.senderId === otherId && m.receiverId === myId && !m.isRead).length;
        convMap.set(otherId, {
          userId: otherId,
          userName: other.name,
          userAvatar: other.avatar,
          userRole: other.role,
          lastMessage: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: unread,
        });
      }
    }

    res.json({ conversations: Array.from(convMap.values()) });
  } catch (err) {
    next(err);
  }
});

// Get messages with specific user
router.get('/:userId', authenticate, async (req, res, next) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.userId;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: myId, receiverId: otherId },
          { senderId: otherId, receiverId: myId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Mark received messages as read
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: myId, isRead: false },
      data: { isRead: true },
    });

    const otherUser = await prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, name: true, avatar: true, role: true, email: true, phone: true },
    });

    res.json({ messages, otherUser });
  } catch (err) {
    next(err);
  }
});

// Detect phone numbers (incl. Arabic-Indic digits) and URLs in chat content.
// Counts a "phone" as any run of 7+ digits — covers local & international forms,
// dotted/spaced/dashed variants, and the Arabic-Indic digit range.
const PHONE_RE = /(?:[\d٠-٩۰-۹][\s\-.()]?){7,}/;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|[A-Za-z0-9-]+\.(?:com|net|org|io|me|co|info|app|dev|tk|sa|jo|ps|eg|ae|qa)(?:\/\S*)?/i;

function chatContentViolation(text) {
  if (PHONE_RE.test(text)) return 'لا يُسمح بإرسال أرقام الهواتف في المحادثة.';
  if (URL_RE.test(text)) return 'لا يُسمح بإرسال الروابط في المحادثة.';
  return null;
}

// Send message
router.post('/', authenticate, requireActive, async (req, res, next) => {
  try {
    const { receiverId, content, bookingId } = req.body;
    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ error: 'يرجى كتابة الرسالة.' });
    }
    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك مراسلة نفسك.' });
    }

    // Block phone numbers and URLs (only between student↔owner, not admin support)
    if (req.user.role !== 'ADMIN') {
      const violation = chatContentViolation(content);
      if (violation) {
        return res.status(400).json({ error: violation });
      }
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) return res.status(404).json({ error: 'المستلم غير موجود.' });

    // UC-42: only allow chat between student and owner who share an active booking
    // (APPROVED or PAID). Admins can message anyone for support purposes.
    if (req.user.role !== 'ADMIN' && receiver.role !== 'ADMIN') {
      const senderId = req.user.id;
      const booking = await prisma.booking.findFirst({
        where: {
          status: { in: ['APPROVED', 'PAID'] },
          OR: [
            { studentId: senderId, property: { ownerId: receiverId } },
            { studentId: receiverId, property: { ownerId: senderId } },
          ],
        },
        select: { id: true },
      });
      if (!booking) {
        return res.status(403).json({
          error: 'لا يمكنك إرسال رسالة بدون حجز نشط مع هذا المستخدم.',
        });
      }
    }

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        senderId: req.user.id,
        receiverId,
        bookingId: bookingId || null,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });

    emitToUser(receiverId, 'new_message', message);
    notify(receiverId, 'رسالة جديدة', `رسالة من ${req.user.name}`, '/messages').catch(() => {});
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

export default router;
