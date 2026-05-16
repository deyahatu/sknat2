import prisma from './prisma.js';
import { notify } from './notify.js';
import { sendRenewalReminder } from './email.js';

const RENEWAL_WINDOW_DAYS = 5;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Find active bookings that end within RENEWAL_WINDOW_DAYS,
 * haven't been reminded yet, and have no existing renewal request.
 * Send in-app notification + email and stamp renewalReminderSentAt.
 */
async function checkAndNotify() {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 24 * HOUR_MS);

    const candidates = await prisma.booking.findMany({
      where: {
        status: { in: ['APPROVED', 'PAID'] },
        endDate: { gte: now, lte: windowEnd },
        renewalReminderSentAt: null,
        renewals: { none: {} }, // no existing renewal request on this booking
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        property: { select: { title: true } },
      },
    });

    if (candidates.length === 0) return;
    console.log(`[renewal-scheduler] Sending renewal reminder to ${candidates.length} student(s)`);

    for (const b of candidates) {
      try {
        await notify(
          b.student.id,
          'تذكير بانتهاء حجزك',
          `حجزك على ${b.property.title} ينتهي قريباً. اضغط هنا لطلب تجديد.`,
          '/bookings',
        );
        sendRenewalReminder(
          b.student.email,
          b.student.name,
          b.property.title,
          b.endDate,
        ).catch((err) => console.error('[renewal-scheduler] email error:', err.message));
        await prisma.booking.update({
          where: { id: b.id },
          data: { renewalReminderSentAt: new Date() },
        });
      } catch (err) {
        console.error('[renewal-scheduler] booking', b.id, 'error:', err.message);
      }
    }
  } catch (err) {
    console.error('[renewal-scheduler] sweep failed:', err.message);
  }
}

/**
 * Start the scheduler. Runs once on startup, then every hour.
 * Returns the interval handle in case the caller wants to clear it (tests).
 */
export function startRenewalScheduler() {
  // first sweep on startup
  checkAndNotify();
  return setInterval(checkAndNotify, HOUR_MS);
}
