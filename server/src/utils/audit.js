import prisma from './prisma.js';

export async function logAudit({ action, entity, entityId, user, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId || 'N/A',
        userId: user.id,
        userName: user.name,
        details: details || null,
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}
