import React, { useState, useMemo } from 'react';
import { X, Edit, Trash2, Users, Clock, User, BookOpen, Calendar, MapPin, FileText, BarChart3 } from 'lucide-react';
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
  canEdit?: boolean;  // 수업 수정 권한
  canDelete?: boolean;  // 수업 삭제 권한
}

type TabType = 'info' | 'students' | 'stats';

const ClassDetailModal: React.FC<ClassDetailModalProps> = ({ classInfo, onClose, onStudentClick, canEdit = true, canDelete = true }) => {
  const { className, subject, studentCount } = classInfo;
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');

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
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* 헤더 */}
          <div className="bg-[#081429] text-white px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#fdb813]" />
                <h2 className="text-base font-bold">{className}</h2>
                <span className="px-2 py-0.5 bg-[#fdb813] text-[#081429] rounded text-xs font-bold">
                  {SUBJECT_LABELS[subject as SubjectType] || subject}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    disabled={deleteClassMutation.isPending}
                    className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50 transition-colors"
                  >
                    편집
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={deleteClassMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-semibold text-xs disabled:opacity-50 transition-colors"
                  >
                    삭제
                  </button>
                )}
                <button
                  onClick={onClose}
                  disabled={deleteClassMutation.isPending}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 탭 네비게이션 */}
            <div className="flex gap-1 border-t border-white/20 pt-2">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'bg-[#fdb813] text-[#081429]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                수업 정보
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'students'
                    ? 'bg-[#fdb813] text-[#081429]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Users className="w-3.5 h-3.5 inline mr-1" />
                학생 ({classDetail?.studentCount || studentCount || 0})
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === 'stats'
                    ? 'bg-[#fdb813] text-[#081429]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 inline mr-1" />
                통계
              </button>
            </div>
          </div>

          {/* 컨텐츠 영역 */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* 수업 정보 탭 */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                {/* 기본 정보 */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">담임</p>
                      <p className="text-sm font-medium text-[#081429]">
                        {teacher ? getTeacherDisplayName(teacher) : '미정'}
                      </p>
                    </div>
                    {room && (
                      <div className="flex-1">
                        <MapPin className="w-4 h-4 text-gray-400 inline mr-1" />
                        <span className="text-sm text-gray-600">{room}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">수업 시간</p>
                      <p className="text-sm font-medium text-[#081429]">{formattedSchedule}</p>
                    </div>
                  </div>
                </div>

                {/* 스케줄 그리드 */}
                {schedule && schedule.length > 0 && (() => {
                  const WEEKDAYS = ['월', '화', '수', '목', '금'];
                  const periods = subject === 'english' ? ENGLISH_UNIFIED_PERIODS : MATH_UNIFIED_PERIODS;

                  const selectedSlots = new Set<string>();
                  schedule.forEach(item => {
                    const parts = item.split(' ');
                    if (parts.length >= 2) {
                      selectedSlots.add(`${parts[0]}-${parts[1]}`);
                    }
                  });

                  const selectedPeriodIds = new Set<string>();
                  selectedSlots.forEach(key => {
                    const [, periodId] = key.split('-');
                    selectedPeriodIds.add(periodId);
                  });
                  const displayPeriods = periods.filter(p => selectedPeriodIds.has(p));

                  if (displayPeriods.length === 0) return null;

                  return (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="grid bg-gray-100" style={{ gridTemplateColumns: `40px repeat(${WEEKDAYS.length}, 1fr)` }}>
                        <div className="p-2 text-center text-xs font-semibold text-gray-400 border-r border-gray-200"></div>
                        {WEEKDAYS.map((day, idx) => (
                          <div key={day} className={`p-2 text-center text-sm font-semibold text-gray-600 ${idx < WEEKDAYS.length - 1 ? 'border-r border-gray-200' : ''}`}>
                            {day}
                          </div>
                        ))}
                      </div>
                      {displayPeriods.map(periodId => (
                        <div
                          key={periodId}
                          className="grid border-t border-gray-100"
                          style={{ gridTemplateColumns: `40px repeat(${WEEKDAYS.length}, 1fr)` }}
                        >
                          <div className="p-2 text-center text-xs text-gray-400 bg-gray-50 flex items-center justify-center border-r border-gray-200 font-medium">
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
                                className={`p-2 text-center text-xs min-h-[32px] flex items-center justify-center ${idx < WEEKDAYS.length - 1 ? 'border-r border-gray-100' : ''} ${isSelected ? 'font-semibold' : 'bg-white'
                                  }`}
                                style={isSelected ? {
                                  backgroundColor: colors.bgColor,
                                  color: colors.textColor
                                } : undefined}
                              >
                                {isSelected ? displayName : ''}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 부담임 */}
                {slotTeachers && Object.keys(slotTeachers).length > 0 && (() => {
                  const visibleSlotTeachers = [...new Set(Object.values(slotTeachers))].filter(name => {
                    if (name === teacher) return false;
                    const teacherInfo = teachersData?.find(t => t.name === name || t.englishName === name);
                    return !teacherInfo?.isHidden;
                  });
                  if (visibleSlotTeachers.length === 0) return null;
                  return (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-2">부담임</p>
                      <div className="flex flex-wrap gap-1">
                        {visibleSlotTeachers.map((name) => (
                          <span key={name} className="bg-gray-200 px-2 py-1 rounded text-xs text-gray-700 font-medium">
                            {getTeacherDisplayName(name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 메모 */}
                {classDetail?.memo && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <p className="text-xs text-gray-500 font-medium">메모</p>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{classDetail.memo}</p>
                  </div>
                )}
              </div>
            )}

            {/* 학생 탭 */}
            {activeTab === 'students' && (
              <div>
                {detailLoading ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <p className="text-gray-500 text-sm">불러오는 중...</p>
                  </div>
                ) : classDetail ? (
                  <ClassStudentList
                    students={classDetail.students}
                    onStudentClick={onStudentClick}
                    classDays={classDays}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-gray-400" />
                    <p className="text-gray-500 text-sm">학생 정보를 불러올 수 없습니다.</p>
                  </div>
                )}
              </div>
            )}

            {/* 통계 탭 */}
            {activeTab === 'stats' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">활성 학생</p>
                  <p className="text-2xl font-bold text-[#10b981] mb-1">
                    {classDetail?.students.filter(s => !s.onHold).length || 0}
                  </p>
                  <p className="text-xs text-gray-400">
                    전체 {classDetail?.studentCount || 0}명
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">대기 학생</p>
                  <p className="text-2xl font-bold text-[#f59e0b] mb-1">
                    {classDetail?.students.filter(s => s.onHold).length || 0}
                  </p>
                  <p className="text-xs text-gray-400">
                    {classDetail?.students.filter(s => s.onHold).length > 0 ? '휴원 중' : '휴원생 없음'}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">이번 달 출석률</p>
                  {statsLoading ? (
                    <p className="text-2xl font-bold text-gray-400">...</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-[#3b82f6] mb-1">{attendanceRate}%</p>
                      <p className="text-xs text-gray-400">
                        {attendanceRate >= 90 ? '우수' : attendanceRate >= 80 ? '양호' : '개선 필요'}
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">이번 달 상담률</p>
                  {statsLoading ? (
                    <p className="text-2xl font-bold text-gray-400">...</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-[#8b5cf6] mb-1">{consultationRate}%</p>
                      <p className="text-xs text-gray-400">
                        {consultationRate >= 80 ? '우수' : consultationRate >= 50 ? '양호' : '개선 필요'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
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
            slotTeachers: classDetail.slotTeachers,
            slotRooms: classDetail.slotRooms,
          } : classInfo}
          initialSlotTeachers={classDetail?.slotTeachers}
          onClose={(saved, newClassName) => {
            setShowEditModal(false);
            if (saved && newClassName) {
              onClose();
            }
          }}
        />
      )}
    </>
  );
};

export default ClassDetailModal;
