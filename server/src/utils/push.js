import webPush from 'web-push';
import prisma from './prisma.js';

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webPush.setVapidDetails('mailto:admin@sknat.com', vapidPublic, vapidPrivate);
}

export async function sendPushToUser(userId, title, body, url) {
  if (!vapidPublic || !vapidPrivate) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url }),
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}

export function getVapidPublicKey() {
  return vapidPublic || null;
}
