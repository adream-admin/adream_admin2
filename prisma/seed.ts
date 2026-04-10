import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default admin user — ADMIN_INITIAL_PASSWORD 환경변수 우선 사용
  const initialPw = process.env.ADMIN_INITIAL_PASSWORD || 'admin1234';
  const hashedPassword = await bcrypt.hash(initialPw, 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: '관리자',
      role: 'admin',
    },
  });

  // Create default system settings
  const defaultSettings = [
    { key: 'no_duplicate_days', value: '7' },         // 업체 중복 배정 불가 일수
    { key: 'daily_assign_per_id', value: '5' },        // ID 1개당 일 배정 최대
    { key: 'rest_after_assign', value: '3' },          // 배정 휴식 주기
    { key: 'server_daily_limit', value: '100' },       // 서버별 일 배정량
    { key: 'one_server_per_company', value: 'false' }, // 업체별로 한서버에 배정
  ];

  for (const setting of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('Seed completed: admin user and default settings created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
