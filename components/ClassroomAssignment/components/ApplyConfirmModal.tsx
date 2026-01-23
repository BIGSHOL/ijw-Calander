import React from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';
import { RoomAssignmentUpdate } from '../types';

interface ApplyConfirmModalProps {
  changes: RoomAssignmentUpdate[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ApplyConfirmModal: React.FC<ApplyConfirmModalProps> = ({
  changes,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[400px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">강의실 배정 적용</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs text-amber-700">
              {changes.length}개 슬롯의 강의실이 변경됩니다.
            </span>
          </div>

          <div className="space-y-1 max-h-[300px] overflow-auto">
            {changes.map((change, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 bg-gray-50 rounded">
                <span className="font-medium text-gray-700 truncate flex-1">{change.classId.slice(0, 8)}...</span>
                <span className="text-gray-400">{change.slotKey}</span>
                <span className="text-blue-600 font-medium">{change.room}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save size={14} />
            적용
          </button>
        </div>
      </div>
    </div>
  );
};
