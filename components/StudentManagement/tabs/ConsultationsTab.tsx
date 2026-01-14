import React, { useState } from 'react';
import { UnifiedStudent, Consultation, CATEGORY_CONFIG } from '../../../types';
import { MessageSquare, Plus } from 'lucide-react';
import { useStudentConsultations, getFollowUpUrgency, getFollowUpDaysLeft } from '../../../hooks/useStudentConsultations';
import { AddConsultationModal, ConsultationDetailModal } from '../../StudentConsultation';

interface ConsultationsTabProps {
  student: UnifiedStudent;
}

const ConsultationsTab: React.FC<ConsultationsTabProps> = ({ student }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
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
          <p className="text-sm text-[#373d41] mt-1">
            총 {consultations.length}건의 상담 기록
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#fdb813] text-[#081429] px-4 py-2 rounded-lg font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          새 상담 기록
        </button>
      </div>

      {/* 상담 기록 목록 - 행 스타일 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-[#373d41]">
          <span className="w-20 shrink-0">날짜</span>
          <span className="flex-1">제목</span>
          <span className="w-24 shrink-0 text-center">유형</span>
        </div>

        {sortedConsultations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">상담 기록이 없습니다</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 첫 상담 기록하기
            </button>
          </div>
        ) : (
          <div>
            {sortedConsultations.map((consultation) => {
              const categoryConfig = CATEGORY_CONFIG[consultation.category];
              const urgency = getFollowUpUrgency(consultation);

              return (
                <div
                  key={consultation.id}
                  onClick={() => setSelectedConsultation(consultation)}
                  className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 hover:bg-[#fdb813]/5 transition-colors cursor-pointer group"
                >
                  {/* 날짜 */}
                  <span className="text-xs text-[#373d41] w-20 shrink-0">
                    {consultation.date}
                  </span>

                  {/* 제목 */}
                  <span className="flex-1 text-sm text-[#081429] truncate">
                    {consultation.title}
                  </span>

                  {/* 뱃지들 */}
                  <div className="flex items-center gap-1 w-24 shrink-0 justify-end">
                    {/* 상담 유형 */}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      consultation.type === 'parent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {consultation.type === 'parent' ? '학부모' : '학생'}
                    </span>

                    {/* 카테고리 */}
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: `${categoryConfig.color}15`,
                        color: categoryConfig.color
                      }}
                    >
                      {categoryConfig.icon}
                    </span>

                    {/* 후속 조치 */}
                    {urgency && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        urgency === 'urgent' ? 'bg-red-600 text-white' :
                        urgency === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {urgency === 'urgent' && consultation.followUpDate && `D-${getFollowUpDaysLeft(consultation.followUpDate)}`}
                        {urgency === 'pending' && '대기'}
                        {urgency === 'done' && '✓'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 상담 추가 모달 */}
      {showAddModal && (
        <AddConsultationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          preSelectedStudentId={student.id}
        />
      )}

      {/* 상담 상세 모달 */}
      {selectedConsultation && (
        <ConsultationDetailModal
          consultation={selectedConsultation}
          onClose={() => setSelectedConsultation(null)}
        />
      )}
    </div>
  );
};

export default ConsultationsTab;
