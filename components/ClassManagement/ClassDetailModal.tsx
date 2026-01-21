import React, { useState, useMemo } from 'react';
import { X, Edit, Trash2, Users, Clock, User, BookOpen, Calendar, MapPin, FileText } from 'lucide-react';
import { ClassInfo } from '../../hooks/useClasses';
import { useClassDetail } from '../../hooks/useClassDetail';
import { useDeleteClass } from '../../hooks/useClassMutations';
import ClassStudentList from './ClassStudentList';
import EditClassModal from './EditClassModal';
import { SUBJECT_LABELS, SubjectType } from '../../utils/styleUtils';
import { formatScheduleCompact, SubjectForSchedule, ENGLISH_UNIFIED_PERIODS, MATH_UNIFIED_PERIODS } from '../Timetable/constants';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { useClassStats } from '../../hooks/useClassStats';

interface ClassDetailModalProps {
  classInfo: ClassInfo;
  onClose: () => void;
  onStudentClick?: (studentId: string) => void;
}

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({ classInfo, onClose, onStudentClick }) => {
  const { className, subject, studentCount } = classInfo;
  const [showEditModal, setShowEditModal] = useState(false);

  // 수업 상세 정보 조회 (학생 목록 포함)
  const { data: classDetail, isLoading: detailLoading } = useClassDetail(className, subject);
  const deleteClassMutation = useDeleteClass();
  const { data: teachersData } = useTeachers();

  // 학생 ID 목록 추출
  const studentIds = useMemo(() => {
    return classDetail?.students.map(s => s.id) || [];
  }, [classDetail?.students]);

  // 수업 통계 조회
  const { attendanceRate, consultationRate, isLoading: statsLoading } = useClassStats(
    className,
    subject,
    studentIds
  );

  // Helper to display teacher name based on subject
  const getTeacherDisplayName = (teacherName: string) => {
    const staffMember = teachersData?.find(t => t.name === teacherName || t.englishName === teacherName);
    if (subject === 'english') {
      return staffMember?.englishName || staffMember?.name || teacherName;
    }
    return staffMember?.name || teacherName;
  };

  // 강사 색상 가져오기
  const getTeacherColor = (teacherName: string) => {
    const teacherInfo = teachersData?.find(t => t.name === teacherName || t.englishName === teacherName);
    return {
      bgColor: teacherInfo?.bgColor || '#fdb813',
      textColor: teacherInfo?.textColor || '#081429'
    };
  };

  // classDetail에서 최신 데이터 사용 (없으면 props fallback)
  const teacher = classDetail?.teacher || classInfo.teacher;
  const schedule = classDetail?.schedule || classInfo.schedule;
  const room = classDetail?.room || classInfo.room;
  const slotTeachers = classDetail?.slotTeachers;

  // 스케줄 포맷팅 ("월 7, 월 8, 목 7, 목 8" -> "월목 4교시")
  // SubjectType을 SubjectForSchedule로 변환 (science, korean, other는 math로 취급)
  const subjectForSchedule: SubjectForSchedule = subject === 'english' ? 'english' : 'math';
  const formattedSchedule = formatScheduleCompact(schedule, subjectForSchedule, false);

  // 수업 요일 추출 (등원 요일 표시에 사용)
  const classDays = React.useMemo(() => {
    const days = new Set<string>();
    (schedule || []).forEach(item => {
      const parts = item.split(' ');
      if (parts.length >= 1) {
        days.add(parts[0]);
      }
    });
    const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
    return Array.from(days).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  }, [schedule]);

  // 수업 삭제
  const handleDelete = async () => {
    const warningMsg = `정말로 "${className}" 수업을 삭제하시겠습니까?\n\n` +
      `⚠️ 다음 항목이 모두 삭제됩니다:\n` +
      `• 수업 정보 (강사, 스케줄, 교실)\n` +
      `• ${studentCount || 0}명 학생의 수업 배정\n` +
      `• 시간표에서 해당 수업\n\n` +
      `이 작업은 되돌릴 수 없습니다.`;

    if (!window.confirm(warningMsg)) {
      return;
    }

    try {
      await deleteClassMutation.mutateAsync({ className, subject });
      onClose();
    } catch (err) {
      console.error('[ClassDetailModal] Error deleting class:', err);
      alert('수업 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[680px] flex flex-col overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
          {/* 컴팩트 헤더 - 학생 모달 스타일 */}
          <div className="bg-[#081429] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#fdb813]" />
              <h2 className="text-base font-bold">수업 상세</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowEditModal(true)}
                disabled={deleteClassMutation.isPending}
                className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-3 py-1.5 rounded font-semibold flex items-center gap-1 transition-colors text-xs disabled:opacity-50"
              >
                <Edit className="w-3.5 h-3.5" />
                편집
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteClassMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-semibold flex items-center gap-1 transition-colors text-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                삭제
              </button>
              <button
                onClick={onClose}
                disabled={deleteClassMutation.isPending}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded font-semibold flex items-center gap-1 transition-colors text-xs disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                닫기
              </button>
            </div>
          </div>

          {/* 스크롤 가능한 컨텐츠 영역 - 2열 레이아웃 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 좌측: 수업 정보 & 메모 */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="w-4 h-4 text-[#081429]" />
                    <h3 className="text-[#081429] font-bold text-sm">수업 정보</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                {/* 수업명 & 과목 */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[50px]">수업명:</span>
                  <span className="text-[#081429] font-bold">{className}</span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {SUBJECT_LABELS[subject as SubjectType] || subject}
                  </span>
                </div>

                {/* 담임 & 강의실 */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-600">{teacher ? getTeacherDisplayName(teacher) : '미정'}</span>
                  </div>
                  {room && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-600">{room}</span>
                    </div>
                  )}
                </div>

                {/* 스케줄 텍스트 */}
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[#081429] font-medium">{formattedSchedule}</span>
                </div>

                {/* 스케줄 그리드 (선택된 교시만) */}
                {schedule && schedule.length > 0 && (() => {
                  const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
                  const periods = subject === 'english' ? ENGLISH_UNIFIED_PERIODS : MATH_UNIFIED_PERIODS;

                  // schedule에서 선택된 슬롯 추출
                  const selectedSlots = new Set<string>();
                  schedule.forEach(item => {
                    const parts = item.split(' ');
                    if (parts.length >= 2) {
                      selectedSlots.add(`${parts[0]}-${parts[1]}`);
                    }
                  });

                  // 선택된 교시만 필터링
                  const selectedPeriodIds = new Set<string>();
                  selectedSlots.forEach(key => {
                    const [, periodId] = key.split('-');
                    selectedPeriodIds.add(periodId);
                  });
                  const displayPeriods = periods.filter(p => selectedPeriodIds.has(p));

                  if (displayPeriods.length === 0) return null;

                  return (
                    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                      {/* 헤더 */}
                      <div className="grid bg-gray-100" style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}>
                        <div className="p-1 text-center text-[10px] font-semibold text-gray-400 border-r border-gray-200"></div>
                        {WEEKDAYS.map((day, idx) => (
                          <div key={day} className={`p-1 text-center text-xs font-semibold text-gray-600 ${idx < WEEKDAYS.length - 1 ? 'border-r border-gray-200' : ''}`}>
                            {day}
                          </div>
                        ))}
                      </div>
                      {/* 교시 */}
                      {displayPeriods.map(periodId => (
                        <div
                          key={periodId}
                          className="grid border-t border-gray-100"
                          style={{ gridTemplateColumns: `32px repeat(${WEEKDAYS.length}, 1fr)` }}
                        >
                          <div className="p-1 text-center text-[10px] text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200">
                            {periodId}
                          </div>
                          {WEEKDAYS.map((day, idx) => {
                            const key = `${day}-${periodId}`;
                            const isSelected = selectedSlots.has(key);
                            const slotTeacher = slotTeachers?.[key];
                            const displayTeacher = slotTeacher || teacher;
                            const colors = displayTeacher ? getTeacherColor(displayTeacher) : { bgColor: '#fdb813', textColor: '#081429' };
                            const displayName = displayTeacher ? getTeacherDisplayName(displayTeacher) : '';

                            return (
                              <div
                                key={key}
                                className={`p-1 text-center text-[10px] min-h-[24px] flex items-center justify-center ${idx < WEEKDAYS.length - 1 ? 'border-r border-gray-100' : ''} ${isSelected ? 'font-semibold' : 'bg-white'
                                  }`}
                                style={isSelected ? {
                                  backgroundColor: colors.bgColor,
                                  color: colors.textColor
                                } : undefined}
                              >
                                {isSelected ? displayName.slice(0, 4) : ''}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 부담임 (교시별 강사) - 담임 및 숨김 강사 제외 */}
                {slotTeachers && Object.keys(slotTeachers).length > 0 && (() => {
                  const visibleSlotTeachers = [...new Set(Object.values(slotTeachers))].filter(name => {
                    // 담임과 동일하면 제외
                    if (name === teacher) return false;
                    // 숨김 강사면 제외
                    const teacherInfo = teachersData?.find(t => t.name === name || t.englishName === name);
                    return !teacherInfo?.isHidden;
                  });
                  if (visibleSlotTeachers.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500">부담임:</span>
                      <div className="flex flex-wrap gap-1">
                        {visibleSlotTeachers.map((name) => (
                          <span key={name} className="bg-gray-200 px-1.5 py-0.5 rounded text-xs text-gray-600">
                            {getTeacherDisplayName(name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                  </div>
                </div>

                {/* 메모 섹션 */}
                {classDetail?.memo && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="w-4 h-4 text-[#081429]" />
                      <h3 className="text-[#081429] font-bold text-sm">메모</h3>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-600 text-sm whitespace-pre-wrap">{classDetail.memo}</p>
                    </div>
                  </div>
                )}

                {/* 통계 섹션 */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-4 h-4 text-[#081429]" />
                    <h3 className="text-[#081429] font-bold text-sm">통계</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center">
                        <p className="text-gray-500 text-xs mb-0.5">활성 학생</p>
                        <p className="text-[#10b981] font-bold text-lg">
                          {classDetail?.students.filter(s => !s.onHold).length || 0}명
                        </p>
                        <p className="text-[10px] text-gray-400">
                          전체 {classDetail?.studentCount || 0}명
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs mb-0.5">대기 학생</p>
                        <p className="text-[#f59e0b] font-bold text-lg">
                          {classDetail?.students.filter(s => s.onHold).length || 0}명
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {classDetail?.students.filter(s => s.onHold).length > 0
                            ? '휴원 중'
                            : '휴원생 없음'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs mb-0.5">이번 달 출석률</p>
                        {statsLoading ? (
                          <p className="text-gray-400 font-bold text-lg">...</p>
                        ) : (
                          <>
                            <p className="text-[#3b82f6] font-bold text-lg">{attendanceRate}%</p>
                            <p className="text-[10px] text-gray-400">
                              {attendanceRate >= 90 ? '우수' : attendanceRate >= 80 ? '양호' : '개선 필요'}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs mb-0.5">이번 달 상담률</p>
                        {statsLoading ? (
                          <p className="text-gray-400 font-bold text-lg">...</p>
                        ) : (
                          <>
                            <p className="text-[#8b5cf6] font-bold text-lg">{consultationRate}%</p>
                            <p className="text-[10px] text-gray-400">
                              {consultationRate >= 80 ? '우수' : consultationRate >= 50 ? '양호' : '개선 필요'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측: 수강 학생 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-4 h-4 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-sm">
                    등록 학생 ({classDetail?.studentCount || studentCount || 0}명)
                  </h3>
                </div>

                {detailLoading ? (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-gray-500 text-sm">불러오는 중...</p>
                  </div>
                ) : classDetail ? (
                  <ClassStudentList
                    students={classDetail.students}
                    onStudentClick={onStudentClick}
                    classDays={classDays}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-gray-400" />
                    <p className="text-gray-500 text-sm">학생 정보를 불러올 수 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 수업 편집 모달 */}
      {showEditModal && (
        <EditClassModal
          classInfo={classDetail ? {
            ...classInfo,
            schedule: classDetail.schedule,
            teacher: classDetail.teacher,
            room: classDetail.room,
          } : classInfo}
          initialSlotTeachers={classDetail?.slotTeachers}
          onClose={(saved, newClassName) => {
            setShowEditModal(false);
            // 수업명이 변경된 경우 모달을 닫아야 함 (이전 수업명으로 조회하는 문제 방지)
            if (saved && newClassName) {
              onClose(); // 상세 모달도 닫음
            }
          }}
        />
      )}
    </>
  );
};

export default ClassDetailModal;
