'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/users', label: '유저 관리', icon: '👥', adminOnly: true },
  { href: '/accounts', label: '아이디 리스트', icon: '🔑' },
  { href: '/companies', label: '업체 리스트', icon: '🏢' },
  { href: '/schedule', label: '발행 일정표', icon: '📅' },
  { href: '/work', label: '작업', icon: '⚙️' },
  { href: '/sync-history', label: '주문 수집 이력', icon: '📋' },
  { href: '/settings', label: '시스템 설정', icon: '🔧', adminOnly: true },
];

interface SidebarProps {
  user: { name: string; username: string; role: string };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    toast.success('로그아웃되었습니다.');
    router.push('/login');
    router.refresh();
  };

  return (
    <aside
      className={clsx(
        'flex flex-col bg-gray-900 text-white transition-all duration-300 min-h-screen',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <div>
            <p className="font-bold text-sm leading-tight">블로그 스케줄</p>
            <p className="text-xs text-gray-400">배정 어드민</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white p-1 rounded"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && user.role !== 'admin') return null;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-gray-700 p-4">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-gray-400">
              {user.role === 'admin' ? '관리자' : '중간관리자'} · @{user.username}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm w-full"
        >
          <span>🚪</span>
          {!collapsed && '로그아웃'}
        </button>
      </div>
    </aside>
  );
}
