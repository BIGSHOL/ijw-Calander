import React from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { SessionPeriod } from '../types';
import { formatSessionRanges, getCategoryLabel } from '../utils';

interface SessionSelectorProps {
  sessions: SessionPeriod[];
  selectedSession: SessionPeriod | null;
  onSelectSession: (session: SessionPeriod | null) => void;
  category: 'math' | 'english' | 'eie';
  isLoading?: boolean;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  selectedSession,
  onSelectSession,
  category,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 카테고리에 맞는 세션만 필터
  const filteredSessions = sessions.filter(s => s.category === category);

  // 표시 텍스트
  const displayText = selectedSession
    ? `${selectedSession.month}월 세션 (${formatSessionRanges(selectedSession)})`
    : '세션 선택...';

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded text-xs text-gray-400">
        <Calendar size={14} />
        로딩 중...
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors min-w-[180px]"
      >
        <Calendar size={14} className="text-blue-500" />
        <span className="flex-1 text-left truncate">{displayText}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-400 text-center">
              {getCategoryLabel(category)} 세션이 설정되지 않았습니다.
              <br />
              <span className="text-gray-300">설정에서 세션을 추가하세요.</span>
            </div>
          ) : (
            <div className="max-h-[240px] overflow-y-auto">
              {filteredSessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors ${
                    selectedSession?.id === session.id ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <div className="font-bold">{session.month}월 세션</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {formatSessionRanges(session)} · {session.sessions}회
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionSelector;
