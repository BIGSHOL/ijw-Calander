import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { Search, Send, FileText, History, Bell } from 'lucide-react';

interface NotificationsTabProps {
  currentUser?: UserProfile | null;
}

type ViewMode = 'templates' | 'compose' | 'history';

export default function NotificationsTab({ currentUser }: NotificationsTabProps) {
  const { templates, logs, isLoading, createTemplate, sendNotification } = useNotifications();
  const [viewMode, setViewMode] = useState<ViewMode>('compose');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'compose', label: '발송', icon: <Send size={14} /> },
    { id: 'templates', label: '템플릿', icon: <FileText size={14} /> },
    { id: 'history', label: '발송 이력', icon: <History size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900 mb-3">알림 발송</h1>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'compose' && (
          <div className="max-w-2xl mx-auto bg-white rounded-lg border p-6">
            <h2 className="text-sm font-bold mb-4">알림 발송</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">카테고리</label>
                <select className="w-full text-xs border rounded px-3 py-2">
                  <option value="attendance">출결 알림</option>
                  <option value="billing">수납 알림</option>
                  <option value="notice">공지 알림</option>
                  <option value="schedule">일정 알림</option>
                  <option value="custom">직접 작성</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">발송 채널</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" defaultChecked /> SMS</label>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" /> 카카오 알림톡</label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">수신 대상</label>
                <select className="w-full text-xs border rounded px-3 py-2">
                  <option>전체 학부모</option>
                  <option>학년별 선택</option>
                  <option>반별 선택</option>
                  <option>개별 선택</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  rows={5}
                  placeholder="알림 내용을 입력하세요. {{학생명}}, {{학원명}} 등 변수를 사용할 수 있습니다."
                  className="w-full text-xs border rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xxs text-gray-400">예상 발송: 0명 | 예상 비용: 0원</span>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">
                  <Send size={14} /> 발송하기
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'templates' && (
          <div>
            {!templates || templates.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <FileText size={32} className="mx-auto mb-2" />
                <p className="text-sm">등록된 템플릿이 없습니다</p>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {templates.map(t => (
                  <div key={t.id} className="bg-white rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{t.name}</span>
                      <span className="text-xxs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{t.category}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'history' && (
          <div>
            {!logs || logs.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Bell size={32} className="mx-auto mb-2" />
                <p className="text-sm">발송 이력이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="bg-white rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xxs px-1.5 py-0.5 rounded ${
                          log.status === 'sent' ? 'bg-green-100 text-green-700' :
                          log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {log.status === 'sent' ? '완료' : log.status === 'failed' ? '실패' : '발송 중'}
                        </span>
                        <span className="text-xxs text-gray-400">{log.channel}</span>
                      </div>
                      <span className="text-xxs text-gray-400">{log.sentAt ? new Date(log.sentAt).toLocaleString('ko-KR') : '-'}</span>
                    </div>
                    <p className="text-xs text-gray-700 truncate">{log.content}</p>
                    <div className="text-xxs text-gray-400 mt-1">
                      수신: {log.recipientCount}명 | 성공: {log.sentCount} | 실패: {log.failedCount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
