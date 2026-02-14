import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useParentLinks } from '../../hooks/useParentLinks';
import { useParentMessages } from '../../hooks/useParentMessages';
import { Search, Send, Users, MessageSquare, History } from 'lucide-react';

interface ParentPortalTabProps {
  currentUser?: UserProfile | null;
}

type ViewMode = 'parents' | 'compose' | 'history';

export default function ParentPortalTab({ currentUser }: ParentPortalTabProps) {
  const { parentLinks, isLoading: linksLoading } = useParentLinks();
  const { messages, isLoading: messagesLoading, sendMessage } = useParentMessages();

  const [viewMode, setViewMode] = useState<ViewMode>('parents');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLinks = useMemo(() => {
    if (!parentLinks) return [];
    if (!searchQuery) return parentLinks;
    const q = searchQuery.toLowerCase();
    return parentLinks.filter(
      p => p.parentName.toLowerCase().includes(q) || p.parentPhone.includes(q)
    );
  }, [parentLinks, searchQuery]);

  const tabs: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'parents', label: '학부모 목록', icon: <Users size={14} /> },
    { id: 'compose', label: '메시지 작성', icon: <MessageSquare size={14} /> },
    { id: 'history', label: '발송 이력', icon: <History size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900 mb-3">학부모 소통</h1>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'parents' && (
          <div>
            <div className="relative mb-3 max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="학부모명, 전화번호 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {linksLoading ? (
              <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
            ) : filteredLinks.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Users size={32} className="mx-auto mb-2" />
                <p className="text-sm">등록된 학부모가 없습니다</p>
                <p className="text-xs mt-1">학생 정보의 학부모 연락처에서 자동으로 연동됩니다</p>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredLinks.map(link => (
                  <div key={link.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">{link.parentName}</span>
                      <span className="text-xxs text-gray-400">{link.relationship}</span>
                    </div>
                    <div className="text-xs text-gray-500">{link.parentPhone}</div>
                    <div className="text-xxs text-gray-400 mt-1">
                      학생: {link.studentIds.length}명
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'compose' && (
          <div className="max-w-2xl mx-auto bg-white rounded-lg border p-6">
            <h2 className="text-sm font-bold mb-4">메시지 작성</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">수신 대상</label>
                <select className="w-full text-xs border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="all">전체 학부모</option>
                  <option value="grade">학년별</option>
                  <option value="class">반별</option>
                  <option value="individual">개별 선택</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">발송 채널</label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="radio" name="channel" value="sms" defaultChecked className="text-blue-600" />
                    SMS
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="radio" name="channel" value="kakao" className="text-blue-600" />
                    카카오 알림톡
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">메시지 내용</label>
                <textarea
                  rows={5}
                  placeholder="메시지를 입력하세요..."
                  className="w-full text-xs border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors">
                <Send size={14} />
                발송하기
              </button>
            </div>
          </div>
        )}

        {viewMode === 'history' && (
          <div>
            {messagesLoading ? (
              <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
            ) : !messages || messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <History size={32} className="mx-auto mb-2" />
                <p className="text-sm">발송 이력이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map(msg => (
                  <div key={msg.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xxs px-1.5 py-0.5 rounded ${
                        msg.status === 'sent' ? 'bg-green-100 text-green-700' :
                        msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {msg.status === 'sent' ? '발송 완료' : msg.status === 'failed' ? '실패' : '발송 중'}
                      </span>
                      <span className="text-xxs text-gray-400">{msg.sentAt ? new Date(msg.sentAt).toLocaleString('ko-KR') : '-'}</span>
                    </div>
                    <p className="text-xs text-gray-700 truncate">{msg.content}</p>
                    <div className="text-xxs text-gray-400 mt-1">수신: {msg.recipientCount}명 | {msg.channel}</div>
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
