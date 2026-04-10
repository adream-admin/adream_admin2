'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Settings {
  no_duplicate_days: string;
  daily_assign_per_id: string;
  rest_after_assign: string;
  server_daily_limit: string;
  one_server_per_company: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    no_duplicate_days: '7',
    daily_assign_per_id: '5',
    rest_after_assign: '3',
    server_daily_limit: '100',
    one_server_per_company: 'false',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => { setSettings((prev) => ({ ...prev, ...data })); setLoading(false); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast.success('설정이 저장되었습니다.');
      else {
        const d = await res.json();
        toast.error(d.error || '저장에 실패했습니다.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">시스템 설정</h1>
        <p className="text-sm text-gray-500 mt-1">아이디 배정 규칙 및 서버 배정 설정</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* ID Assignment Settings */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            🔑 아이디 배정 설정
          </h2>
          <div className="space-y-5">
            <SettingRow
              label="업체 중복 배정 불가 (일수)"
              desc="입력한 일수 이내에 동일 아이디로 동일 업체에 배정 불가"
              example="예) 7 입력 시 → 오늘 A아이디로 A업체 배정 시, 7일 이내 A아이디로 A업체 배정 불가"
            >
              <NumberInput
                value={settings.no_duplicate_days}
                onChange={(v) => setSettings({ ...settings, no_duplicate_days: v })}
                unit="일"
              />
            </SettingRow>

            <SettingRow
              label="ID 1개당 일 배정 최대 (건수)"
              desc="1개 아이디에 하루 최대 배정 건수 (0 ~ 입력값 사이 랜덤 배정)"
              example="예) 5 입력 시 → 하루에 0~5건 랜덤 배정, 같은 숫자 연속 배정 불가"
            >
              <NumberInput
                value={settings.daily_assign_per_id}
                onChange={(v) => setSettings({ ...settings, daily_assign_per_id: v })}
                unit="건"
              />
            </SettingRow>

            <SettingRow
              label="배정 휴식 주기 (일수)"
              desc="배정 후 입력한 일수 동안 쉬고, 그 다음 날부터 다시 배정"
              example="예) 3 입력 시 → 배정 다음 3일 쉬고 4일째부터 다시 배정"
            >
              <NumberInput
                value={settings.rest_after_assign}
                onChange={(v) => setSettings({ ...settings, rest_after_assign: v })}
                unit="일"
              />
            </SettingRow>
          </div>
        </div>

        {/* Server Assignment Settings */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">
            🖥️ 서버 배정 설정
          </h2>
          <div className="space-y-5">
            <SettingRow
              label="서버별 일 배정량 (건수)"
              desc="서버 1개에 하루 최대 배정 건수"
              example="예) 100 입력 시 → 서버 1개에 하루 최대 100건 배정"
            >
              <NumberInput
                value={settings.server_daily_limit}
                onChange={(v) => setSettings({ ...settings, server_daily_limit: v })}
                unit="건"
              />
            </SettingRow>

            <SettingRow
              label="업체별 한 서버에 배정"
              desc="체크 시, 동일 업체는 동일 서버에 배정 (단, 다음 배정 시 같은 서버 중복 배정 불가)"
              example="예) 체크 시 → 이번에 A업체를 S1서버에 배정했으면, 다음에는 다른 서버에 배정"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  checked={settings.one_server_per_company === 'true'}
                  onChange={(e) => setSettings({ ...settings, one_server_per_company: e.target.checked ? 'true' : 'false' })}
                />
                <span className="text-sm text-gray-700">활성화</span>
              </label>
            </SettingRow>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn-primary px-8 py-3 text-base">
          {saving ? '저장 중...' : '💾 설정 저장'}
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  label, desc, example, children
}: {
  label: string; desc: string; example: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        <p className="text-xs text-blue-500 mt-0.5">{example}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, unit }: { value: string; onChange: (v: string) => void; unit: string }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        className="input-field w-24 text-center"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-sm text-gray-500">{unit}</span>
    </div>
  );
}
