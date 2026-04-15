import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaReady: Promise<void> | undefined;
};

function createPrisma() {
  const client = new PrismaClient({ log: ['error'] });

  // SQLite 동시 쓰기 안전 설정 + 관리자 비밀번호 초기화
  const init = async () => {
    await client.$queryRawUnsafe('PRAGMA journal_mode=WAL');
    await client.$executeRawUnsafe('PRAGMA synchronous=NORMAL');
    await client.$executeRawUnsafe('PRAGMA busy_timeout=5000'); // 쓰기 충돌 시 5초 대기
    await client.$executeRawUnsafe('PRAGMA cache_size=-32000');

    // 관리자 기본 비밀번호(admin1234) → ADMIN_INITIAL_PASSWORD로 자동 교체
    const initialPw = process.env.ADMIN_INITIAL_PASSWORD;
    if (initialPw) {
      const admin = await client.user.findUnique({ where: { username: 'admin' }, select: { id: true, password: true } });
      if (admin && bcrypt.compareSync('admin1234', admin.password)) {
        await client.user.update({
          where: { username: 'admin' },
          data: { password: bcrypt.hashSync(initialPw, 10) },
        });
        console.log('[보안] 스케줄 어드민 관리자 비밀번호가 ADMIN_INITIAL_PASSWORD로 변경되었습니다.');
      }
    }
  };

  globalForPrisma.prismaReady = init().catch(console.error);
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();
export const prismaReady = () => globalForPrisma.prismaReady ?? Promise.resolve();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
