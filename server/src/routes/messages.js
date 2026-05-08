import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { emitToUser } from '../utils/socket.js';

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
      select: { id: true, name: true, avatar: true, role: true },
    });

    res.json({ messages, otherUser });
  } catch (err) {
    next(err);
  }
});

// Send message
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { receiverId, content, bookingId } = req.body;
    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ error: 'يرجى كتابة الرسالة.' });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) return res.status(404).json({ error: 'المستلم غير موجود.' });

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
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

export default router;
