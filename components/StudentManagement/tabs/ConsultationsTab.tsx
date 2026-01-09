import React from 'react';
import { UnifiedStudent } from '../../../types';
import { MessageSquare, Clock } from 'lucide-react';

interface ConsultationsTabProps {
  student: UnifiedStudent;
}

const ConsultationsTab: React.FC<ConsultationsTabProps> = ({ student }) => {
  return (
    <div className="text-center py-12 text-gray-500">
      <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <Clock className="w-10 h-10 text-gray-400" />
      </div>
      <p className="text-lg font-medium text-gray-600">추후 구현 예정</p>
      <p className="text-sm mt-2 text-gray-400">
        학생별 상담 이력 기능은 현재 개발 중입니다.
      </p>
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
        <p className="text-sm text-blue-800 text-left">
          <strong>예정 기능:</strong>
        </p>
        <ul className="text-sm text-blue-700 mt-2 text-left list-disc list-inside space-y-1">
          <li>학생별 상담 기록 관리</li>
          <li>상담 유형 및 결과 추적</li>
          <li>상담 히스토리 타임라인</li>
        </ul>
      </div>
    </div>
  );
};

export default ConsultationsTab;
