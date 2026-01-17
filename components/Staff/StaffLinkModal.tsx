import React, { useState, useMemo } from 'react';
import { X, Link2, Search, User, Mail, AlertCircle } from 'lucide-react';
import { StaffMember, UserProfile } from '../../types';

interface StaffLinkModalProps {
  staff: StaffMember;
  users: UserProfile[];
  linkedEmails: Set<string>;
  onClose: () => void;
  onLink: (staffId: string, userEmail: string) => Promise<void>;
}

const StaffLinkModal: React.FC<StaffLinkModalProps> = ({
  staff,
  users,
  linkedEmails,
  onClose,
  onLink,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // 연결 가능한 사용자 목록 (이미 다른 직원에게 연결된 사용자 제외)
  const availableUsers = useMemo(() => {
    return users.filter(u => {
      // 이미 연결된 이메일 제외
      if (linkedEmails.has(u.email.toLowerCase())) return false;
      // 검색 필터
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return u.email.toLowerCase().includes(q) ||
               (u.jobTitle && u.jobTitle.toLowerCase().includes(q));
      }
      return true;
    });
  }, [users, linkedEmails, searchQuery]);

  const handleLink = async () => {
    if (!selectedUser) return;

    setIsLinking(true);
    try {
      await onLink(staff.id, selectedUser.email);
      onClose();
    } catch (error) {
      console.error('연결 실패:', error);
      alert('연결에 실패했습니다.');
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Link2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#081429]">시스템 계정 연결</h2>
              <p className="text-xs text-gray-500">{staff.name} 직원</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이메일 또는 호칭으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2">
          {availableUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <AlertCircle className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm font-medium">연결 가능한 사용자가 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchQuery ? '다른 검색어를 시도해보세요' : '모든 사용자가 이미 연결되어 있습니다'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {availableUsers.map((user) => (
                <button
                  key={user.uid}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    selectedUser?.uid === user.uid
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[#081429] truncate">
                        {user.jobTitle || '(호칭 없음)'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        user.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {user.status === 'approved' ? '승인됨' : user.status === 'pending' ? '대기중' : '차단됨'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                  {selectedUser?.uid === user.uid && (
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLinking}
          >
            취소
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedUser || isLinking}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLinking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>연결 중...</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                <span>연결하기</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffLinkModal;
