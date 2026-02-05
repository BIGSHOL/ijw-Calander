/**
 * MemoSendModal - Modal for sending memos to other staff
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { Send, X, Users, MessageSquare } from 'lucide-react';
import { UserProfile } from '../../types';
import { User } from 'firebase/auth';

interface MemoSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  usersFromStaff: UserProfile[];
  currentUser: User | null;
  memoRecipients: string[];
  setMemoRecipients: React.Dispatch<React.SetStateAction<string[]>>;
  memoMessage: string;
  setMemoMessage: (value: string) => void;
  handleSendMemo: () => void;
  formatUserDisplay: (user: UserProfile) => string;
}

export const MemoSendModal: React.FC<MemoSendModalProps> = ({
  isOpen,
  onClose,
  usersFromStaff,
  currentUser,
  memoRecipients,
  setMemoRecipients,
  memoMessage,
  setMemoMessage,
  handleSendMemo,
  formatUserDisplay,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]">
      <div className="bg-white rounded-sm shadow-xl w-[400px] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            <Send size={16} /> 메모 보내기
          </h3>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-2 flex-1 overflow-y-auto">
          {/* Section 1: 수신자 선택 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Users className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">수신자 선택</h3>
            </div>
            <div className="px-2 py-1.5">
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-sm">
                {usersFromStaff
                  .filter(u => u.uid !== currentUser?.uid)
                  .sort((a, b) => {
                    const isASel = memoRecipients.includes(a.uid);
                    const isBSel = memoRecipients.includes(b.uid);
                    if (isASel && !isBSel) return -1;
                    if (!isASel && isBSel) return 1;
                    return formatUserDisplay(a).localeCompare(formatUserDisplay(b));
                  })
                  .map(u => {
                    const isSelected = memoRecipients.includes(u.uid);
                    return (
                      <label
                        key={u.uid}
                        className={`flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMemoRecipients(prev => [...prev, u.uid]);
                            } else {
                              setMemoRecipients(prev => prev.filter(id => id !== u.uid));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 accent-[#081429]"
                        />
                        <span className="text-sm text-gray-700">{formatUserDisplay(u)}</span>
                      </label>
                    );
                  })}
              </div>
              {memoRecipients.length === 0 && (
                <p className="text-xxs text-red-500 mt-1">최소 한 명의 수신자를 선택해주세요.</p>
              )}
            </div>
          </div>

          {/* Section 2: 메모 내용 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <MessageSquare className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">메모 내용</h3>
            </div>
            <div className="px-2 py-1.5">
              <textarea
                value={memoMessage}
                onChange={(e) => setMemoMessage(e.target.value)}
                placeholder="예: 오늘 회의 일정 만들어주세요"
                className="w-full px-3 py-2 border border-gray-200 rounded-sm text-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none resize-none h-24"
              />
              {!memoMessage.trim() && (
                <p className="text-xxs text-red-500 mt-1">메모 내용을 입력해주세요.</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-sm text-sm font-bold"
          >
            취소
          </button>
          <button
            onClick={handleSendMemo}
            disabled={memoRecipients.length === 0 || !memoMessage.trim()}
            className="px-4 py-2 bg-primary text-white rounded-sm text-sm font-bold hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send size={14} /> 보내기 ({memoRecipients.length}명)
          </button>
        </div>
      </div>
    </div>
  );
};
