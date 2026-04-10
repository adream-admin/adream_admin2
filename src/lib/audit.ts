import { prisma } from './prisma';

export async function createAuditLog(
  userId: number,
  action: string,
  target?: string,
  details?: string
) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, target, details },
    });
  } catch (e) {
    console.error('AuditLog error:', e);
  }
}
