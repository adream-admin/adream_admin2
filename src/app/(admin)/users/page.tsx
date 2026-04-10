'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { username: '', password: '', name: '', role: 'manager' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm({ username: u.username, password: '', name: u.name, role: u.role });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.username) return toast.error('이름과 아이디를 입력하세요.');
    if (!editTarget && !form.password) return toast.error('비밀번호를 입력하세요.');
    setSaving(true);
    try {
      const url = editTarget ? `/api/users/${editTarget.id}` : '/api/users';
      const method = editTarget ? 'PUT' : 'POST';
      const body = editTarget
        ? { name: form.name, role: form.role, ...(form.password ? { password: form.password } : {}) }
        : form;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      toast.success(editTarget ? '수정되었습니다.' : '생성되었습니다.');
      setShowModal(false);
      fetchUsers();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`${u.name} 계정을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다.'); fetchUsers(); }
    else { const d = await res.json(); toast.error(d.error); }
  };

  const handleToggleActive = async (u: User) => {
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) { fetchUsers(); toast.success('상태를 변경했습니다.'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">유저 관리</h1>
          <p className="text-sm text-gray-500 mt-1">관리자 계정 생성 및 관리</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ 유저 추가</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">NO</th>
              <th className="table-header">아이디</th>
              <th className="table-header">이름</th>
              <th className="table-header">권한</th>
              <th className="table-header">상태</th>
              <th className="table-header">생성일</th>
              <th className="table-header">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-cell text-center text-gray-400">불러오는 중...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="table-cell text-center text-gray-400">등록된 유저가 없습니다.</td></tr>
            ) : users.map((u, i) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="table-cell text-center">{i + 1}</td>
                <td className="table-cell font-mono">{u.username}</td>
                <td className="table-cell font-medium">{u.name}</td>
                <td className="table-cell">
                  <span className={`badge ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'admin' ? '관리자' : '중간관리자'}
                  </span>
                </td>
                <td className="table-cell">
                  <button onClick={() => handleToggleActive(u)} className={`badge cursor-pointer ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.isActive ? '활성' : '비활성'}
                  </button>
                </td>
                <td className="table-cell text-gray-400">{new Date(u.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">수정</button>
                    <button onClick={() => handleDelete(u)} className="text-red-600 hover:text-red-800 text-sm font-medium">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editTarget ? '유저 수정' : '유저 추가'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="아이디" required>
              <input className="input-field" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editTarget} placeholder="영문, 숫자" />
            </Field>
            <Field label="이름" required>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="실명" />
            </Field>
            <Field label="비밀번호" required={!editTarget}>
              <input type="password" className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editTarget ? '변경 시에만 입력' : '비밀번호'} />
            </Field>
            <Field label="권한">
              <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="manager">중간관리자</option>
                <option value="admin">관리자</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? '저장 중...' : '저장'}</button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">취소</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
