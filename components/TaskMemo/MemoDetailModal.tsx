/**
 * MemoDetailModal - Shows received memo details with reply/delete actions
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { Mail, X, User as UserIcon, Trash2, Send } from 'lucide-react';
import { TaskMemo } from '../../types';

interface MemoDetailModalProps {
  selectedMemo: TaskMemo | null;
  onClose: () => void;
  onReply: (senderUid: string) => void;
  handleMarkMemoRead: (id: string) => void;
  handleDeleteMemo: (id: string) => void;
}

export const MemoDetailModal: React.FC<MemoDetailModalProps> = ({
  selectedMemo,
  onClose,
  onReply,
  handleMarkMemoRead,
  handleDeleteMemo,
}) => {
  if (!selectedMemo) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Mail size={16} /> 받은 메모
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <span className="text-xs font-bold text-gray-500 block mb-1">보낸 사람</span>
            <div className="text-gray-800 font-bold flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <UserIcon size={16} />
              </div>
              {selectedMemo.fromName}
            </div>
          </div>
          <div className="mb-6">
            <span className="text-xs font-bold text-gray-500 block mb-1">내용</span>
            <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm whitespace-pre-wrap leading-relaxed border border-gray-100">
              {selectedMemo.message}
            </div>
            <div className="text-right mt-2 text-xs text-gray-400">
              {new Date(selectedMemo.createdAt).toLocaleString('ko-KR')}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => handleDeleteMemo(selectedMemo.id)}
              className="mr-auto px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2"
            >
              <Trash2 size={14} /> 삭제
            </button>
            <button
              onClick={() => {
                handleMarkMemoRead(selectedMemo.id);
                onClose();
              }}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50"
            >
              확인 (닫기)
            </button>
            <button
              onClick={() => {
                onReply(selectedMemo.from);
                handleMarkMemoRead(selectedMemo.id);
              }}
              className="px-4 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-125 flex items-center gap-2"
            >
              <Send size={14} /> 답장하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
