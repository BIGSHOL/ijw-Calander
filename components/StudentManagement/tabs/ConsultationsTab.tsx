import React, { useState } from 'react';
import { UnifiedStudent, Consultation, CATEGORY_CONFIG } from '../../../types';
import { MessageSquare, Plus } from 'lucide-react';
import { useStudentConsultations, getFollowUpUrgency, getFollowUpDaysLeft } from '../../../hooks/useStudentConsultations';
import { useStaff } from '../../../hooks/useStaff';
import { AddConsultationModal, ConsultationDetailModal } from '../../StudentConsultation';

interface ConsultationsTabProps {
  student: UnifiedStudent;
}

const ConsultationsTab: React.FC<ConsultationsTabProps> = ({ student }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const { staff } = useStaff();
  const { consultations, loading } = useStudentConsultations({ studentId: student.id });

  // 최신순 정렬
  const sortedConsultations = [...consultations].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleAddSuccess = async () => {
    setShowAddModal(false);
  };

  // 카테고리 라벨 축약
  const getCategoryShortLabel = (category: string) => {
    const labels: Record<string, string> = {
      'progress': '진도',
      'behavior': '행동',
      'counsel': '상담',
      'academic': '학습',
      'attendance': '출결',
      'other': '기타'
    };
    return labels[category] || '기타';
  };

  if (loading) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin w-5 h-5 border-2 border-[#fdb813] border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-gray-500 text-xs">상담 기록 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-[#081429]">상담 기록</h3>
          <span className="text-xs text-[#373d41]">
            ({sortedConsultations.length}건)
          </span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#fdb813] text-[#081429] px-2 py-1 rounded text-xs font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          추가
        </button>
      </div>

      {/* 상담 목록 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        {/* 테이블 헤더 */}
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-[#373d41]">
          <span className="w-16 shrink-0">날짜</span>
          <span className="w-10 shrink-0">구분</span>
          <span className="w-10 shrink-0">분류</span>
          <span className="flex-1">제목</span>
          <span className="w-12 shrink-0 text-right">상담자</span>
        </div>

        {sortedConsultations.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-xs">상담 기록이 없습니다</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              + 상담 기록 추가하기
            </button>
          </div>
        ) : (
          <div>
            {sortedConsultations.map((consultation) => {
              const categoryConfig = CATEGORY_CONFIG[consultation.category] || CATEGORY_CONFIG['other'];
              const urgency = getFollowUpUrgency(consultation);

              return (
                <div
                  key={consultation.id}
                  onClick={() => setSelectedConsultation(consultation)}
                  className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 hover:bg-[#fdb813]/5 transition-colors cursor-pointer"
                >
                  {/* 날짜 */}
                  <span className="w-16 shrink-0 text-xxs text-gray-500">
                    {consultation.date}
                  </span>

                  {/* 구분 (학부모/학생) */}
                  <span className={`w-10 shrink-0 px-1 py-0.5 rounded text-micro font-medium text-center ${
                    consultation.type === 'parent'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {consultation.type === 'parent' ? '학부모' : '학생'}
                  </span>

                  {/* 분류 */}
                  <span
                    className="w-10 shrink-0 px-1 py-0.5 rounded text-micro font-medium text-center"
                    style={{
                      backgroundColor: `${categoryConfig.color}15`,
                      color: categoryConfig.color
                    }}
                  >
                    {getCategoryShortLabel(consultation.category)}
                  </span>

                  {/* 제목 + 후속조치 */}
                  <div className="flex-1 min-w-0 flex items-center gap-1">
                    {urgency && (
                      <span className={`px-1 py-0.5 rounded text-micro font-medium shrink-0 ${
                        urgency === 'urgent' ? 'bg-red-600 text-white' :
                        urgency === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {urgency === 'urgent' && consultation.followUpDate && `D-${getFollowUpDaysLeft(consultation.followUpDate)}`}
                        {urgency === 'pending' && '대기'}
                        {urgency === 'done' && '✓'}
                      </span>
                    )}
                    <span className="text-xs text-[#081429] truncate">
                      {consultation.title}
                    </span>
                  </div>

                  {/* 상담자 */}
                  <span className="w-12 shrink-0 text-xs text-[#373d41] text-right truncate">
                    {consultation.consultantName || '-'}
                  </span>
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
