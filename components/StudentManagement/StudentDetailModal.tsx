import React from 'react';
import { X } from 'lucide-react';
import { UnifiedStudent, UserProfile } from '../../types';
import StudentDetail from './StudentDetail';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { useDraggable } from '../../hooks/useDraggable';

interface StudentDetailModalProps {
  student: UnifiedStudent;
  onClose: () => void;
  readOnly?: boolean; // 조회 전용 모드 (퇴원/삭제 버튼 숨김)
  currentUser?: UserProfile | null; // 권한 체크용
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({ student, onClose, readOnly = false, currentUser }) => {
  useEscapeClose(onClose);
  const { handleMouseDown, dragStyle } = useDraggable();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]"
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-xl h-[600px] flex flex-col overflow-hidden relative"
        style={dragStyle}
      >
        {/* 드래그 핸들 + 닫기 버튼 */}
        <div
          className="flex items-center justify-end px-2 py-1 border-b border-gray-100 cursor-move shrink-0 select-none"
          onMouseDown={handleMouseDown}
        >
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* StudentDetail 컴포넌트 */}
        <div className="flex-1 overflow-hidden">
          <StudentDetail student={student} compact readOnly={readOnly} currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
};

export default StudentDetailModal;
