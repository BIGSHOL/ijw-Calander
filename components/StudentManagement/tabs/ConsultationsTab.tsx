import React, { useState, useMemo, useCallback } from 'react';
import { UnifiedStudent, Consultation, CATEGORY_CONFIG, UserProfile, ConsultationRecord } from '../../../types';
import { MessageSquare, Plus, ClipboardList, ChevronDown } from 'lucide-react';
import { useStudentConsultations, getFollowUpUrgency, getFollowUpDaysLeft } from '../../../hooks/useStudentConsultations';
import { useStaff } from '../../../hooks/useStaff';
import { useConsultations, useUpdateConsultation } from '../../../hooks/useConsultations';
import { ConsultationDetailModal } from '../../StudentConsultation';
import { ConsultationForm } from '../../RegistrationConsultation/ConsultationForm';
// Lazy load for better code splitting
const AddConsultationModal = React.lazy(() => import('../../StudentConsultation/AddConsultationModal'));

interface ConsultationsTabProps {
  student: UnifiedStudent;
  readOnly?: boolean; // 조회 전용 모드
  currentUser?: UserProfile | null; // 시뮬레이션 지원
}

const ConsultationsTab: React.FC<ConsultationsTabProps> = ({ student, readOnly = false, currentUser }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [selectedRegistrationRecord, setSelectedRegistrationRecord] = useState<ConsultationRecord | null>(null);
  const { staff } = useStaff();
  const { consultations, loading } = useStudentConsultations({ studentId: student.id });

  // 섹션 접기/펼치기 상태
  const [showStudentConsultations, setShowStudentConsultations] = useState(true);
  const [showRegistrationConsultations, setShowRegistrationConsultations] = useState(true);

  // 전체 등록 상담 기록 조회
  const { data: allConsultations = [], isLoading: regLoading } = useConsultations({});
  const updateConsultation = useUpdateConsultation();

  // 재원생 상담 기록 정렬
  const sortedConsultations = useMemo(() =>
    [...consultations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [consultations]
  );

  // 학교 이름 별칭 매핑
  const SCHOOL_ALIASES: Record<string, string> = {
    '일중': '대구일중학교',
  };

  // 학교 이름 정규화 함수 (축약형 → 전체 이름)
  const normalizeSchoolName = (schoolName: string | undefined): string => {
    if (!schoolName) return '';
    const name = schoolName.trim();
    // 별칭 매핑 확인
    if (SCHOOL_ALIASES[name]) return SCHOOL_ALIASES[name];
    // 이미 전체 이름이면 그대로 반환
    if (name.includes('초등학교') || name.includes('중학교') || name.includes('고등학교')) {
      return name;
    }
    // 축약형 → 전체 이름 변환
    if (name.includes('초')) return name.replace('초', '초등학교');
    if (name.includes('중')) return name.replace('중', '중학교');
    if (name.includes('고')) return name.replace('고', '고등학교');
    return name;
  };

  // 학생 이름, 학교로 필터링한 등록 상담 기록 (학년은 제외 - 진급 시에도 매칭되도록)
  const filteredRegistrationConsultations = useMemo(() => {
    const normalizedStudentSchool = normalizeSchoolName(student.school);

    return allConsultations.filter(record => {
      const nameMatch = record.studentName === student.name;
      const normalizedRecordSchool = normalizeSchoolName(record.schoolName);
      const schoolMatch = normalizedRecordSchool === normalizedStudentSchool;

      return nameMatch && schoolMatch;
    }).sort((a, b) => {
      // 상담 날짜 기준 최신순 정렬
      const dateA = new Date(a.consultationDate || a.createdAt || '').getTime();
      const dateB = new Date(b.consultationDate || b.createdAt || '').getTime();
      return dateB - dateA;
    });
  }, [allConsultations, student.name, student.school, student.grade]);

  const handleAddSuccess = async () => {
    setShowAddModal(false);
  };

  // 등록 상담 수정 핸들러
  const handleUpdateRegistrationRecord = useCallback((data: Omit<ConsultationRecord, 'id'>) => {
    if (!selectedRegistrationRecord?.id) return;

    updateConsultation.mutate({
      id: selectedRegistrationRecord.id,
      updates: data,
    }, {
      onSuccess: () => {
        setSelectedRegistrationRecord({ ...data, id: selectedRegistrationRecord.id } as ConsultationRecord);
        alert('수정이 완료되었습니다.');
      },
      onError: (error) => {
        console.error('상담 수정 오류:', error);
        alert('상담 수정에 실패했습니다.');
      }
    });
  }, [selectedRegistrationRecord, updateConsultation]);

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

  if (loading || regLoading) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-sm mx-auto mb-2"></div>
        <p className="text-gray-500 text-xs">상담 기록 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ========== 상단: 재원생 상담 기록 ========== */}
      <div className="space-y-3">
        {/* 재원생 상담 기록 헤더 */}
        <div className="flex justify-between items-center">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setShowStudentConsultations(!showStudentConsultations)}
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-primary">재원생 상담 기록</h3>
            <span className="text-xs text-primary-700">
              ({sortedConsultations.length}건)
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showStudentConsultations ? '' : 'rotate-180'}`} />
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-accent text-primary px-2 py-1 rounded-sm text-xs font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              추가
            </button>
          )}
        </div>

        {/* 재원생 상담 목록 */}
        {showStudentConsultations && (
        <div className="bg-white border border-gray-200 overflow-hidden rounded-sm">
          {/* 테이블 헤더 */}
          <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-primary-700">
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
              {!readOnly && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  + 상담 기록 추가하기
                </button>
              )}
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
                    className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 hover:bg-accent/5 transition-colors cursor-pointer"
                  >
                    {/* 날짜 */}
                    <span className="w-16 shrink-0 text-xxs text-gray-500">
                      {consultation.date}
                    </span>

                    {/* 구분 (학부모/학생) */}
                    <span className={`w-10 shrink-0 px-1 py-0.5 rounded-sm text-micro font-medium text-center ${
                      consultation.type === 'parent'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {consultation.type === 'parent' ? '학부모' : '학생'}
                    </span>

                    {/* 분류 */}
                    <span
                      className="w-10 shrink-0 px-1 py-0.5 rounded-sm text-micro font-medium text-center"
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
                        <span className={`px-1 py-0.5 rounded-sm text-micro font-medium shrink-0 ${
                          urgency === 'urgent' ? 'bg-red-600 text-white' :
                          urgency === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {urgency === 'urgent' && consultation.followUpDate && `D-${getFollowUpDaysLeft(consultation.followUpDate)}`}
                          {urgency === 'pending' && '대기'}
                          {urgency === 'done' && '✓'}
                        </span>
                      )}
                      <span className="text-xs text-primary truncate">
                        {consultation.title}
                      </span>
                    </div>

                    {/* 상담자 */}
                    <span className="w-12 shrink-0 text-xs text-primary-700 text-right truncate">
                      {consultation.consultantName || '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>

      {/* ========== 하단: 등록 상담 기록 ========== */}
      <div className="space-y-3 pt-3 border-t border-gray-200">
        {/* 등록 상담 기록 헤더 */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setShowRegistrationConsultations(!showRegistrationConsultations)}
        >
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-primary">등록 상담 이력</h3>
          <span className="text-xs text-primary-700">
            ({filteredRegistrationConsultations.length}건)
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showRegistrationConsultations ? '' : 'rotate-180'}`} />
        </div>

        {/* 등록 상담 기록 목록 */}
        {showRegistrationConsultations && (
        <>
        {filteredRegistrationConsultations.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-sm p-6 text-center">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-xs">등록 상담 기록이 없습니다</p>
            <p className="text-gray-400 text-xxs mt-1">
              이름: {student.name} / 학교: {student.school} / 학년: {student.grade}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 overflow-hidden rounded-sm">
            {/* 테이블 헤더 */}
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-200 text-xxs font-medium text-primary-700">
              <span className="w-16 shrink-0">날짜</span>
              <span className="w-10 shrink-0">과목</span>
              <span className="w-14 shrink-0">상태</span>
              <span className="flex-1">내용</span>
              <span className="w-12 shrink-0 text-right">상담자</span>
            </div>
            {filteredRegistrationConsultations.map(record => (
              <div
                key={record.id}
                onClick={() => setSelectedRegistrationRecord(record)}
                className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 hover:bg-accent/5 transition-colors cursor-pointer"
              >
                <span className="w-16 shrink-0 text-xxs text-gray-500">
                  {record.consultationDate?.slice(0, 10) || '-'}
                </span>
                <span className="w-10 shrink-0 px-1 py-0.5 rounded-sm text-micro font-medium text-center bg-gray-100 text-gray-700">
                  {record.subject}
                </span>
                <span className="w-14 shrink-0 px-1 py-0.5 rounded-sm text-micro font-medium text-center bg-green-100 text-green-700 whitespace-nowrap truncate">
                  {record.status}
                </span>
                <span className="flex-1 text-xs text-primary truncate">
                  {record.notes || '내용 없음'}
                </span>
                <span className="w-12 shrink-0 text-xs text-primary-700 text-right truncate">
                  {record.counselor || '-'}
                </span>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* 상담 추가 모달 */}
      {showAddModal && (
        <AddConsultationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
          preSelectedStudentId={student.id}
          userProfile={currentUser}
        />
      )}

      {/* 상담 상세 모달 */}
      {selectedConsultation && (
        <ConsultationDetailModal
          consultation={selectedConsultation}
          onClose={() => setSelectedConsultation(null)}
        />
      )}

      {/* 등록 상담 상세 모달 */}
      <ConsultationForm
        isOpen={!!selectedRegistrationRecord}
        onClose={() => setSelectedRegistrationRecord(null)}
        onSubmit={handleUpdateRegistrationRecord}
        initialData={selectedRegistrationRecord}
      />
    </div>
  );
};

export default ConsultationsTab;
