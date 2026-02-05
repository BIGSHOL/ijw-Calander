/**
 * MemoDropdown - Memo/messenger dropdown in header
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { MessageCircle, Mail } from 'lucide-react';
import { TaskMemo } from '../../types';

interface MemoDropdownProps {
  isMemoDropdownOpen: boolean;
  setIsMemoDropdownOpen: (value: boolean) => void;
  unreadMemoCount: number;
  taskMemos: TaskMemo[];
  setIsMemoModalOpen: (value: boolean) => void;
  setSelectedMemo: (memo: TaskMemo | null) => void;
  handleMarkMemoRead: (id: string) => void;
}

export const MemoDropdown: React.FC<MemoDropdownProps> = ({
  isMemoDropdownOpen,
  setIsMemoDropdownOpen,
  unreadMemoCount,
  taskMemos,
  setIsMemoModalOpen,
  setSelectedMemo,
  handleMarkMemoRead,
}) => {
  return (
    <div className="relative">
      <button
        onClick={() => setIsMemoDropdownOpen(!isMemoDropdownOpen)}
        className={`relative transition-colors mt-[5px] ${isMemoDropdownOpen ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
      >
        <MessageCircle size={20} />
        {unreadMemoCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-xxs font-bold rounded-sm flex items-center justify-center">
            {unreadMemoCount}
          </span>
        )}
      </button>

      {isMemoDropdownOpen && (
        <>
          <div className="fixed inset-0 z-[119]" onClick={() => setIsMemoDropdownOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-sm shadow-2xl border border-gray-100 z-[120] overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-700 text-sm flex items-center gap-2">
                <Mail size={14} /> 받�? 메모
              </span>
              <button
                onClick={() => { setIsMemoModalOpen(true); setIsMemoDropdownOpen(false); }}
                className="text-xs px-2 py-1 bg-primary text-white rounded font-bold hover:brightness-125"
              >
                + ??메모
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {taskMemos.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">받�? 메모가 ?�습?�다</div>
              ) : (
                taskMemos.map(memo => (
                  <div
                    key={memo.id}
                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!memo.isRead ? 'bg-blue-50/50' : ''}`}
                    onClick={() => {
                      setSelectedMemo(memo);
                      setIsMemoDropdownOpen(false);
                      handleMarkMemoRead(memo.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">{memo.fromName}</span>
                          {!memo.isRead && <span className="w-2 h-2 bg-blue-500 rounded-sm" />}
                        </div>
                        <p className="text-gray-600 text-xs mt-1 line-clamp-2">{memo.message}</p>
                        <span className="text-gray-400 text-xxs mt-1 block">
                          {new Date(memo.createdAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
