import prisma from './prisma.js';
import { sendPushToUser } from './push.js';

export async function notify(userId, title, body, url) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, title, body, url },
    });
    sendPushToUser(userId, title, body, url).catch(() => {});
    return notification;
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
}
