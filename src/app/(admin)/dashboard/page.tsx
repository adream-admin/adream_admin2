import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [totalAccounts, totalCompanies, todaySchedules, recentLogs] = await Promise.all([
    prisma.account.count({ where: { isActive: true } }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.schedule.count({
      where: {
        scheduledDate: {
          gte: new Date(new Date().toDateString()),
          lt: new Date(new Date(new Date().toDateString()).getTime() + 86400000),
        },
      },
    }),
    prisma.auditLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const actionLabel: Record<string, string> = {
    CREATE_USER: '유저 생성',
    UPDATE_USER: '유저 수정',
    DELETE_USER: '유저 삭제',
    CREATE_ACCOUNT: '아이디 생성',
    UPDATE_ACCOUNT: '아이디 수정',
    DELETE_ACCOUNT: '아이디 삭제',
    BULK_UPLOAD_ACCOUNTS: '아이디 일괄업로드',
    CREATE_COMPANY: '업체 생성',
    UPDATE_COMPANY: '업체 수정',
    DELETE_COMPANY: '업체 삭제',
    RUN_ASSIGNMENT: '배정 실행',
    UPDATE_SETTINGS: '설정 변경',
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">안녕하세요, {user?.name}님!</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="활성 아이디" value={totalAccounts} unit="개" color="blue" icon="🔑" />
        <StatCard title="등록 업체" value={totalCompanies} unit="개" color="green" icon="🏢" />
        <StatCard title="오늘 스케줄" value={todaySchedules} unit="건" color="purple" icon="📅" />
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">최근 활동 이력</h2>
        {recentLogs.length === 0 ? (
          <p className="text-gray-400 text-sm">활동 이력이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium text-blue-600">{log.user.name}</span>
                    {' '}님이{' '}
                    <span className="font-medium">{actionLabel[log.action] || log.action}</span>
                    {log.details && <span className="text-gray-500"> ({log.details})</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(log.createdAt).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title, value, unit, color, icon
}: {
  title: string; value: number; unit: string; color: string; icon: string;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
  } as Record<string, string>;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {value.toLocaleString()}
            <span className="text-lg font-normal text-gray-400 ml-1">{unit}</span>
          </p>
        </div>
        <div className={`text-3xl w-14 h-14 rounded-full flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
