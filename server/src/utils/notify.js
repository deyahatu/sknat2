import prisma from './prisma.js';
import { sendPushToUser } from './push.js';
import { emitToUser } from './socket.js';

export async function notify(userId, title, body, url) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, title, body, url },
    });
    sendPushToUser(userId, title, body, url).catch(() => {});
    emitToUser(userId, 'notification', notification);
    return notification;
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
}
