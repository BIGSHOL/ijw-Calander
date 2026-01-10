import React, { useState } from 'react';
import { UnifiedStudent, Consultation, CATEGORY_CONFIG } from '../../../types';
import { MessageSquare, Plus, Calendar, User, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useStudentConsultations } from '../../../hooks/useStudentConsultations';
import { AddConsultationModal } from '../../ConsultationManagement';

interface ConsultationsTabProps {
  student: UnifiedStudent;
}

const ConsultationsTab: React.FC<ConsultationsTabProps> = ({ student }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const { consultations, loading, refetch } = useStudentConsultations({ studentId: student.id });

  // 최신순 정렬
  const sortedConsultations = [...consultations].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleAddSuccess = () => {
    setShowAddModal(false);
    refetch();
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

      {/* 상담 기록 목록 */}
      {sortedConsultations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium text-gray-600">상담 기록이 없습니다</p>
          <p className="text-sm mt-2 text-gray-400">
            "새 상담 기록" 버튼을 눌러 첫 상담을 등록하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedConsultations.map((consultation) => (
            <ConsultationCard key={consultation.id} consultation={consultation} />
          ))}
        </div>
      )}

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

// 상담 카드 컴포넌트
const ConsultationCard: React.FC<{ consultation: Consultation }> = ({ consultation }) => {
  const categoryConfig = CATEGORY_CONFIG[consultation.category];

  return (
    <div className="bg-white border border-[#081429] border-opacity-10 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* 상단: 날짜, 유형, 카테고리 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[#373d41]">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">{consultation.date}</span>
            {consultation.time && (
              <>
                <Clock className="w-4 h-4 ml-2" />
                <span>{consultation.time}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 상담 유형 뱃지 */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              consultation.type === 'parent'
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-green-100 text-green-800 border border-green-200'
            }`}
          >
            {consultation.type === 'parent' ? '학부모 상담' : '학생 상담'}
          </span>

          {/* 카테고리 뱃지 */}
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: `${categoryConfig.color}15`,
              borderColor: `${categoryConfig.color}40`,
              color: categoryConfig.color,
            }}
          >
            {categoryConfig.icon} {categoryConfig.label}
          </span>
        </div>
      </div>

      {/* 제목 */}
      <h4 className="font-bold text-[#081429] mb-2">{consultation.title}</h4>

      {/* 내용 미리보기 */}
      <p className="text-sm text-[#373d41] mb-3 line-clamp-2">
        {consultation.content}
      </p>

      {/* 하단: 상담자, 후속조치 */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm text-[#373d41]">
          <User className="w-4 h-4" />
          <span>{consultation.consultantName}</span>
        </div>

        {consultation.followUpNeeded && (
          <div className="flex items-center gap-2">
            {consultation.followUpDone ? (
              <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                <CheckCircle className="w-4 h-4" />
                후속조치 완료
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                <AlertCircle className="w-4 h-4" />
                후속조치 필요
                {consultation.followUpDate && ` (${consultation.followUpDate})`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 학부모 상담 추가 정보 */}
      {consultation.type === 'parent' && consultation.parentName && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-[#373d41]">
            <strong>참석:</strong> {consultation.parentName} ({consultation.parentRelation})
          </p>
        </div>
      )}

      {/* 학생 상담 감정 상태 */}
      {consultation.type === 'student' && consultation.studentMood && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
              consultation.studentMood === 'positive'
                ? 'bg-green-100 text-green-800'
                : consultation.studentMood === 'negative'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {consultation.studentMood === 'positive' && '😊 긍정적'}
            {consultation.studentMood === 'neutral' && '😐 보통'}
            {consultation.studentMood === 'negative' && '😔 부정적'}
          </span>
        </div>
      )}
    </div>
  );
};

export default ConsultationsTab;
