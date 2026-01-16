import React, { useState } from 'react';
import { UnifiedStudent, Consultation, CATEGORY_CONFIG } from '../../../types';
import { MessageSquare, Plus } from 'lucide-react';
import { useStudentConsultations, getFollowUpUrgency, getFollowUpDaysLeft } from '../../../hooks/useStudentConsultations';
import { useStaff } from '../../../hooks/useStaff';
import { AddConsultationModal, ConsultationDetailModal, ConsultationList } from '../../StudentConsultation';

interface ConsultationsTabProps {
  student: UnifiedStudent;
}

const ConsultationsTab: React.FC<ConsultationsTabProps> = ({ student }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const { staff } = useStaff();
  const { consultations, loading } = useStudentConsultations({ studentId: student.id });

  // 최신순 정렬
  const sortedConsultations = [...consultations].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleAddSuccess = async () => {
    setShowAddModal(false);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-[#fdb813] border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">상담 기록 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-[#081429]">상담 기록</h3>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#fdb813] text-[#081429] px-4 py-2 rounded-lg font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          새 상담 기록
        </button>
      </div>

      {/* 상담 목록 (공통 컴포넌트 사용) */}
      <ConsultationList
        consultations={sortedConsultations}
        loading={loading}
        onRefresh={() => { }} // 자동 갱신되므로 빈 함수
        students={[student]}
        staff={staff}
      />

      {/* 상담 추가 모달 */}
      {showAddModal && (
        <AddConsultationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          preSelectedStudentId={student.id}
        />
      )}
    </div>
  );
};

export default ConsultationsTab;
