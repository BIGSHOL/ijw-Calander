/**
 * MemoDetailModal - Shows received memo details with reply/delete actions
 * Extracted from App.tsx Phase 6
 */

import React from 'react';
import { Mail, X, User as UserIcon, Trash2, Send, Clock, FileText } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]">
      <div className="bg-white rounded-sm shadow-xl w-[400px] max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <h3 className="text-sm font-bold text-primary flex items-center gap-2">
            <Mail size={16} /> 받은 메모
          </h3>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-2">
          {/* Section 1: 메모 정보 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <UserIcon className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">메모 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Sender Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-16 shrink-0 text-xs font-medium text-primary-700">보낸 사람</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-sm bg-blue-100 flex items-center justify-center text-blue-600">
                    <UserIcon size={12} />
                  </div>
                  <span className="text-xs text-gray-800 font-bold">{selectedMemo.fromName}</span>
                </div>
              </div>

              {/* Timestamp Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">전송 시각</span>
                <span className="text-xs text-gray-600">
                  {new Date(selectedMemo.createdAt).toLocaleString('ko-KR')}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: 메모 내용 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <FileText className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">메모 내용</h3>
            </div>
            <div className="px-2 py-1.5">
              <div className="bg-gray-50 p-3 rounded-sm text-gray-700 text-xs whitespace-pre-wrap leading-relaxed border border-gray-100 min-h-[80px]">
                {selectedMemo.message}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end p-6 border-t border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={() => handleDeleteMemo(selectedMemo.id)}
            className="mr-auto px-4 py-2 text-red-500 hover:bg-red-50 rounded-sm text-sm font-bold flex items-center gap-2"
          >
            <Trash2 size={14} /> 삭제
          </button>
          <button
            onClick={() => {
              handleMarkMemoRead(selectedMemo.id);
              onClose();
            }}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-sm text-sm font-bold hover:bg-gray-50"
          >
            확인 (닫기)
          </button>
          <button
            onClick={() => {
              onReply(selectedMemo.from);
              handleMarkMemoRead(selectedMemo.id);
            }}
            className="px-4 py-2 bg-primary text-white rounded-sm text-sm font-bold hover:brightness-125 flex items-center gap-2"
          >
            <Send size={14} /> 답장하기
          </button>
        </div>
      </div>
    </div>
  );
};
