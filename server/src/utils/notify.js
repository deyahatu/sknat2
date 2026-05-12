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

// Fan out a notification to every active admin. Used for platform-wide events
// (new property, new registration, new report, ...) — admins want full
// visibility on activity without manually polling each tab.
export async function notifyAllAdmins(title, body, url) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });
    await Promise.all(
      admins.map((a) => notify(a.id, title, body, url)),
    );
  } catch (err) {
    console.error('Notify-all-admins failed:', err.message);
  }
}
