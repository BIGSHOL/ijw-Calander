import React, { useState, useEffect } from 'react';
import { RefreshCw, Copy, CheckCircle, XCircle, Loader2, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useGoogleCalendarSync } from '../../hooks/useGoogleCalendarSync';
import { useDepartments } from '../../hooks/useFirebaseQueries';
import { GCalSyncMapping } from '../../types/system';

/**
 * 구글 캘린더 다중 매핑 동기화 설정 탭
 */
const GoogleCalendarSyncTab: React.FC = () => {
  const { syncSettings, mappings: savedMappings, saveSettings, triggerSync } = useGoogleCalendarSync();
  const { data: departments = [] } = useDepartments(true);

  const [enabled, setEnabled] = useState(false);
  const [mappings, setMappings] = useState<GCalSyncMapping[]>([]);
  const [copied, setCopied] = useState(false);

  // 설정 로드
  useEffect(() => {
    if (syncSettings) {
      setEnabled(syncSettings.enabled || false);
    }
    if (savedMappings.length > 0) {
      setMappings(savedMappings);
    }
  }, [syncSettings, savedMappings]);

  const handleToggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    saveSettings.mutate({ enabled: next, mappings });
  };

  const handleAddMapping = () => {
    setMappings(prev => [...prev, { calendarId: '', departmentId: '', label: '' }]);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(prev => prev.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, field: keyof GCalSyncMapping, value: string) => {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleSave = () => {
    // 빈 매핑 제거
    const validMappings = mappings.filter(m => m.calendarId && m.departmentId);
    setMappings(validMappings);
    saveSettings.mutate({ enabled, mappings: validMappings });
  };

  const handleTriggerSync = () => {
    if (!enabled) return alert('먼저 동기화를 활성화해주세요.');
    if (mappings.filter(m => m.calendarId && m.departmentId).length === 0) {
      return alert('캘린더-부서 매핑을 추가해주세요.');
    }
    triggerSync.mutate();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusIcon = syncSettings?.lastSyncStatus === 'success'
    ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
    : syncSettings?.lastSyncStatus === 'error'
      ? <XCircle className="w-3.5 h-3.5 text-red-500" />
      : syncSettings?.lastSyncStatus === 'running'
        ? <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
        : null;

  const statusText = syncSettings?.lastSyncStatus === 'success'
    ? '성공'
    : syncSettings?.lastSyncStatus === 'error'
      ? `실패: ${syncSettings.lastSyncError || '알 수 없는 오류'}`
      : syncSettings?.lastSyncStatus === 'running'
        ? '동기화 중...'
        : '동기화 기록 없음';

  return (
    <div className="space-y-4">
      {/* 활성화 토글 */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
        <div>
          <p className="text-xs font-bold text-gray-700">Google Calendar 동기화</p>
          <p className="text-[10px] text-gray-500 mt-0.5">구글 캘린더 일정을 부서별로 가져옵니다</p>
        </div>
        <button
          onClick={handleToggleEnabled}
          disabled={saveSettings.isPending}
          className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {/* 서비스 계정 이메일 */}
      {syncSettings?.serviceAccountEmail && (
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">서비스 계정 이메일</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2.5 py-1.5 text-[10px] bg-gray-100 border border-gray-200 rounded font-mono truncate">
              {syncSettings.serviceAccountEmail}
            </code>
            <button
              onClick={() => handleCopy(syncSettings.serviceAccountEmail!)}
              className="p-1.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
              title="복사"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            이 이메일을 각 Google Calendar에 '이벤트 변경 가능' 권한으로 공유하세요
          </p>
        </div>
      )}

      {/* 캘린더 ↔ 부서 매핑 목록 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-700">캘린더 ↔ 부서 매핑</label>
          <button
            onClick={handleAddMapping}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
          >
            <Plus className="w-3 h-3" />
            추가
          </button>
        </div>

        {mappings.length === 0 && (
          <p className="text-[10px] text-gray-400 text-center py-4 border border-dashed border-gray-300 rounded">
            매핑이 없습니다. "추가" 버튼을 눌러 캘린더와 부서를 연결하세요.
          </p>
        )}

        <div className="space-y-2">
          {mappings.map((mapping, index) => (
            <div key={index} className="p-2.5 border border-gray-200 rounded bg-gray-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500">매핑 #{index + 1}</span>
                <button
                  onClick={() => handleRemoveMapping(index)}
                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={mapping.label || ''}
                onChange={e => handleMappingChange(index, 'label', e.target.value)}
                placeholder="라벨 (예: 수학부 캘린더)"
                className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 outline-none"
              />
              <input
                type="text"
                value={mapping.calendarId}
                onChange={e => handleMappingChange(index, 'calendarId', e.target.value)}
                placeholder="Calendar ID (예: abc@group.calendar.google.com)"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 outline-none font-mono"
              />
              <select
                value={mapping.departmentId}
                onChange={e => handleMappingChange(index, 'departmentId', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 outline-none"
              >
                <option value="">부서 선택</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={saveSettings.isPending}
        className="w-full py-1.5 text-xs font-bold bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {saveSettings.isPending ? '저장 중...' : '설정 저장'}
      </button>

      <hr className="border-gray-200" />

      {/* 동기화 상태 */}
      <div className="p-3 bg-gray-50 rounded border border-gray-200">
        <p className="text-xs font-bold text-gray-700 mb-2">동기화 상태</p>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {statusIcon}
          <span>{statusText}</span>
        </div>
        {syncSettings?.lastSyncAt && (
          <p className="text-[10px] text-gray-400 mt-1">
            마지막 동기화: {new Date(syncSettings.lastSyncAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>

      {/* 수동 동기화 버튼 */}
      <button
        onClick={handleTriggerSync}
        disabled={triggerSync.isPending || !enabled}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${triggerSync.isPending ? 'animate-spin' : ''}`} />
        {triggerSync.isPending ? '동기화 중...' : '지금 전체 동기화'}
      </button>

      {triggerSync.isSuccess && triggerSync.data && (
        <div className="text-center space-y-1">
          <p className="text-[10px] text-green-600 font-bold">
            {(triggerSync.data as any).message}
          </p>
          {(triggerSync.data as any).details?.map((d: any, i: number) => (
            <p key={i} className="text-[10px] text-gray-500">
              {d.calendar}: {d.error ? `오류 - ${d.error}` : `${d.total}건 중 생성 ${d.created}, 수정 ${d.updated}, 삭제 ${d.deleted}`}
            </p>
          ))}
        </div>
      )}

      {triggerSync.isError && (
        <p className="text-[10px] text-red-500 text-center">
          동기화 실패: {(triggerSync.error as Error)?.message || '알 수 없는 오류'}
        </p>
      )}

      {/* 안내 */}
      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-[10px] font-bold text-blue-700 mb-1">설정 방법</p>
        <ol className="text-[10px] text-blue-600 space-y-0.5 list-decimal list-inside">
          <li>Google Cloud Console에서 Calendar API 활성화</li>
          <li>서비스 계정 생성 → JSON 키 다운로드</li>
          <li>Firebase에 시크릿 등록 (GOOGLE_SERVICE_ACCOUNT_KEY)</li>
          <li>각 Google Calendar에 서비스 계정 이메일을 공유</li>
          <li>위에서 캘린더 ID ↔ 부서 매핑 추가 → 활성화</li>
        </ol>
        <a
          href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline mt-1.5"
        >
          <ExternalLink className="w-3 h-3" />
          Google Cloud Console 열기
        </a>
      </div>
    </div>
  );
};

export default GoogleCalendarSyncTab;
