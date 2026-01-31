/**
 * MemoSendModal - Modal for sending memos to other staff
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { Send, X } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-[400px] max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Send size={16} /> 메모 보내기
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">받는 사람</label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
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
                    <label key={u.uid} className={`flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 ${isSelected ? 'bg-blue-50' : ''}`}>
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
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">메모 내용</label>
            <textarea
              value={memoMessage}
              onChange={(e) => setMemoMessage(e.target.value)}
              placeholder="예: 오늘 회의 일정 만들어주세요"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none resize-none h-24"
            />
          </div>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold"
          >
            취소
          </button>
          <button
            onClick={handleSendMemo}
            disabled={memoRecipients.length === 0 || !memoMessage.trim()}
            className="px-4 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send size={14} /> 보내기 ({memoRecipients.length}명)
          </button>
        </div>
      </div>
    </div>
  );
};
