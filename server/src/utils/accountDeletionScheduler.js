import prisma from './prisma.js';

// Voluntary account deletions go through a 30-day grace period. Once the
// request is older than this many days, the row is permanently removed
// (cascade-deletes all related data per the Prisma schema).
const GRACE_DAYS = 30;
const HOUR_MS = 60 * 60 * 1000;

async function sweep() {
  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * HOUR_MS);

    const expired = await prisma.user.findMany({
      where: {
        deletionRequestedAt: { lte: cutoff },
        isActive: false,
      },
      select: { id: true, name: true, email: true },
    });

    if (expired.length === 0) return;
    console.log(`[deletion-scheduler] Hard-deleting ${expired.length} account(s) past 30-day grace`);

    for (const u of expired) {
      try {
        await prisma.user.delete({ where: { id: u.id } });
      } catch (err) {
        console.error(`[deletion-scheduler] failed to delete ${u.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[deletion-scheduler] sweep failed:', err.message);
  }
}

// Runs once at startup then every hour. Cron-like precision isn't needed —
// the grace period is in days, and users only need their account gone within
// a day or so of the deadline.
export function startAccountDeletionScheduler() {
  sweep();
  return setInterval(sweep, HOUR_MS);
}
