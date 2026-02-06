import React, { useState, useEffect } from 'react';
import { useStudents } from '../../hooks/useStudents';
import { WithdrawalEntry } from '../../hooks/useWithdrawalFilters';
import { WITHDRAWAL_REASONS, WITHDRAWAL_REASON_LABEL, SUBJECT_LABEL, SUBJECT_COLOR } from '../../constants/withdrawal';
import { UserCheck, Calendar, FileText, BookOpen, AlertTriangle, Info, User, Clock, Phone, Save, MessageCircle, Pencil, X, Check, Timer } from 'lucide-react';

// 등록기간 계산 (년, 월, 일)
const calculateDuration = (startDate: string | undefined, endDate: string | undefined): string | null => {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  if (end < start) return null;

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  // 일수가 음수면 전 달에서 빌려옴
  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }

  // 월수가 음수면 전 년에서 빌려옴
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  if (months > 0) parts.push(`${months}개월`);
  if (days > 0 || parts.length === 0) parts.push(`${days}일`);

  return parts.join(' ');
};

interface WithdrawalStudentDetailProps {
  entry: WithdrawalEntry;
  canEdit: boolean;
  canReactivate?: boolean;
  onReactivated?: () => void;
}

const WithdrawalStudentDetail: React.FC<WithdrawalStudentDetailProps> = ({
  entry,
  canEdit,
  canReactivate = false,
  onReactivated,
}) => {
  const { student, type, endedEnrollments } = entry;
  const { updateStudent } = useStudents();
  const [isReactivating, setIsReactivating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isWithdrawn = type === 'withdrawn';

  const withdrawalDate = student.withdrawalDate || student.endDate || '-';
  const reasonLabel = student.withdrawalReason
    ? WITHDRAWAL_REASON_LABEL[student.withdrawalReason] || student.withdrawalReason
    : '-';

  // 사유 편집 상태
  const [editReason, setEditReason] = useState(student.withdrawalReason || '');
  const [editMemo, setEditMemo] = useState(student.withdrawalMemo || '');
  const [isSavingReason, setIsSavingReason] = useState(false);

  // 상담 추적 상태
  const consultation = student.withdrawalConsultation || {};
  const [adminCalled, setAdminCalled] = useState(consultation.adminCalledParent || false);
  const [teacherCalled, setTeacherCalled] = useState(consultation.teacherCalledParent || false);
  const [studentTalked, setStudentTalked] = useState(consultation.talkedWithStudent || false);
  const [isSavingConsultation, setIsSavingConsultation] = useState(false);

  // 학생이 바뀌면 상태 리셋
  useEffect(() => {
    setEditReason(student.withdrawalReason || '');
    setEditMemo(student.withdrawalMemo || '');
    const c = student.withdrawalConsultation || {};
    setAdminCalled(c.adminCalledParent || false);
    setTeacherCalled(c.teacherCalledParent || false);
    setStudentTalked(c.talkedWithStudent || false);
    setShowConfirm(false);
    setIsEditing(false);
  }, [student.id, student.withdrawalReason, student.withdrawalMemo, student.withdrawalConsultation]);

  // 수정 취소 시 원래 값으로 복원
  const handleCancelEdit = () => {
    setEditReason(student.withdrawalReason || '');
    setEditMemo(student.withdrawalMemo || '');
    const c = student.withdrawalConsultation || {};
    setAdminCalled(c.adminCalledParent || false);
    setTeacherCalled(c.teacherCalledParent || false);
    setStudentTalked(c.talkedWithStudent || false);
    setIsEditing(false);
  };

  // 사유 변경 여부
  const reasonChanged = editReason !== (student.withdrawalReason || '') || editMemo !== (student.withdrawalMemo || '');

  // 사유 저장
  const handleSaveReason = async () => {
    setIsSavingReason(true);
    try {
      await updateStudent(student.id, {
        withdrawalReason: editReason || undefined,
        withdrawalMemo: editMemo || undefined,
      });
    } catch (error) {
      console.error('사유 저장 실패:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSavingReason(false);
    }
  };

  // 상담 토글 저장
  const handleToggleConsultation = async (
    field: 'adminCalledParent' | 'teacherCalledParent' | 'talkedWithStudent',
    value: boolean
  ) => {
    // 즉시 UI 업데이트
    if (field === 'adminCalledParent') setAdminCalled(value);
    if (field === 'teacherCalledParent') setTeacherCalled(value);
    if (field === 'talkedWithStudent') setStudentTalked(value);

    setIsSavingConsultation(true);
    try {
      const current = student.withdrawalConsultation || {};
      await updateStudent(student.id, {
        withdrawalConsultation: { ...current, [field]: value },
      });
    } catch (error) {
      console.error('상담 상태 저장 실패:', error);
      // 롤백
      if (field === 'adminCalledParent') setAdminCalled(!value);
      if (field === 'teacherCalledParent') setTeacherCalled(!value);
      if (field === 'talkedWithStudent') setStudentTalked(!value);
    } finally {
      setIsSavingConsultation(false);
    }
  };

  // 재원 복구 처리 (퇴원 유형만)
  const handleReactivate = async () => {
    setIsReactivating(true);
    try {
      await updateStudent(student.id, {
        status: 'active',
        withdrawalDate: undefined,
        withdrawalReason: undefined,
        withdrawalMemo: undefined,
        withdrawalConsultation: undefined,
        endDate: undefined,
      });
      setShowConfirm(false);
      onReactivated?.();
    } catch (error) {
      console.error('재원 복구 실패:', error);
      alert('재원 복구에 실패했습니다.');
    } finally {
      setIsReactivating(false);
    }
  };

  // 활성 수강 목록 (수강종료 유형에서 표시)
  const activeEnrollments = student.enrollments.filter(
    e => !e.withdrawalDate && !e.endDate
  );

  // 사유 드롭다운 옵션 (빈 값 제외한 선택 옵션)
  const reasonOptions = WITHDRAWAL_REASONS.filter(r => r.value !== '');

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-3">
        {/* 학생 기본 정보 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
              isWithdrawn ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              <User className={`w-5 h-5 ${isWithdrawn ? 'text-red-500' : 'text-amber-500'}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'rgb(8, 20, 41)' /* primary */ }}>{student.name}</h2>
              <div className="flex items-center gap-1.5">
                {student.grade && <span className="text-xs text-gray-500">{student.grade}</span>}
                {student.school && <span className="text-xs text-gray-400">{student.school}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isWithdrawn ? (
              <span className="text-micro bg-red-100 text-red-700 px-1.5 py-0.5 rounded-sm font-medium">퇴원</span>
            ) : (
              <span className="text-micro bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm font-medium">수강종료</span>
            )}
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 px-2 py-1 text-micro text-gray-500 hover:text-primary hover:bg-gray-100 rounded-sm transition-colors"
              >
                <Pencil className="w-3 h-3" />
                <span>수정</span>
              </button>
            )}
            {isEditing && (
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-2 py-1 text-micro text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
              >
                <X className="w-3 h-3" />
                <span>취소</span>
              </button>
            )}
          </div>
        </div>

        {/* 퇴원 정보 (퇴원 유형 - 읽기 전용) */}
        {isWithdrawn && (() => {
          const duration = calculateDuration(student.startDate, student.withdrawalDate || student.endDate);
          return (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-red-50 border-b border-red-200">
                <Info className="w-3 h-3 text-red-600" />
                <h3 className="text-red-800 font-bold text-xs">퇴원 정보</h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="w-16 shrink-0 text-xs font-medium text-primary-700">퇴원일</span>
                  <span className="text-xs text-primary">{withdrawalDate}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="w-16 shrink-0 text-xs font-medium text-primary-700">등록일</span>
                  <span className="text-xs text-primary">{student.startDate || '-'}</span>
                </div>
                {duration && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                    <Timer className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="w-16 shrink-0 text-xs font-medium text-primary-700">등록기간</span>
                    <span className="text-xs font-bold text-primary">{duration}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 종료된 수강 이력 (수강종료 유형 - 중복 라벨 제거) */}
        {!isWithdrawn && (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 border-b border-amber-200">
              <Clock className="w-3 h-3 text-amber-600" />
              <h3 className="text-amber-800 font-bold text-xs">종료된 수강</h3>
              <span className="text-micro text-amber-500 ml-auto">{endedEnrollments.length}건</span>
            </div>
            <div className="divide-y divide-gray-100">
              {endedEnrollments.map((enrollment, idx) => {
                const endDate = enrollment.withdrawalDate || enrollment.endDate;
                const duration = calculateDuration(enrollment.startDate, endDate);
                return (
                  <div key={idx} className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-micro px-1 py-0 rounded-sm font-medium ${SUBJECT_COLOR[enrollment.subject] || SUBJECT_COLOR.other}`}>
                        {SUBJECT_LABEL[enrollment.subject] || enrollment.subject}
                      </span>
                      <span className="text-xs font-medium text-primary">{enrollment.className}</span>
                      {enrollment.teacher && (
                        <span className="text-micro text-gray-400 ml-auto">{enrollment.teacher}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-micro text-gray-400">
                      {enrollment.startDate && <span>시작: {enrollment.startDate}</span>}
                      {endDate && <span>종료: {endDate}</span>}
                      {duration && (
                        <span className="font-medium text-primary">({duration})</span>
                      )}
                      {enrollment.days?.length > 0 && (
                        <span className="ml-auto">{enrollment.days.join(', ')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 사유 입력 (카테고리 + 상세) — 퇴원/수강종료 공통 */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <FileText className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">
              {isWithdrawn ? '퇴원 사유' : '수강종료 사유'}
            </h3>
          </div>
          <div className="p-3 space-y-2">
            {isEditing ? (
              <>
                <select
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
                >
                  <option value="">사유 선택...</option>
                  {reasonOptions.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <textarea
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  placeholder="상세 사유를 입력하세요..."
                  rows={3}
                  className="w-full text-xs border rounded-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  style={{ borderColor: 'rgba(8, 20, 41, 0.2)' }}
                />
                {reasonChanged && (
                  <button
                    onClick={handleSaveReason}
                    disabled={isSavingReason}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-sm hover:bg-primary-800 transition-colors disabled:opacity-50"
                  >
                    {isSavingReason ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    <span>저장</span>
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-primary">{reasonLabel}</p>
                {student.withdrawalMemo && (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{student.withdrawalMemo}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 퇴원 상담 추적 */}
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <Phone className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">
              {isWithdrawn ? '퇴원 상담' : '수강종료 상담'}
            </h3>
            {isSavingConsultation && (
              <div className="w-3 h-3 border-2 border-gray-300 border-t-[#081429] rounded-full animate-spin ml-auto" />
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { label: '관리자 ↔ 학부모 통화', icon: Phone, value: adminCalled, field: 'adminCalledParent' as const },
              { label: '담임 ↔ 학부모 통화', icon: Phone, value: teacherCalled, field: 'teacherCalledParent' as const },
              { label: '학생 상담 완료', icon: MessageCircle, value: studentTalked, field: 'talkedWithStudent' as const },
            ].map(({ label, icon: Icon, value, field }) => (
              <div key={field} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-primary-700">{label}</span>
                </div>
                {isEditing ? (
                  <button
                    onClick={() => handleToggleConsultation(field, !value)}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                      value ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      value ? 'translate-x-4' : ''
                    }`} />
                  </button>
                ) : (
                  value ? (
                    <span className="flex items-center gap-1 text-micro text-green-600 font-medium">
                      <Check className="w-3 h-3" />
                      완료
                    </span>
                  ) : (
                    <span className="text-micro text-gray-300">미완료</span>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 현재 활성 수강 (수강종료 유형에서 표시) */}
        {!isWithdrawn && activeEnrollments.length > 0 && (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-green-50 border-b border-green-200">
              <BookOpen className="w-3 h-3 text-green-600" />
              <h3 className="text-green-800 font-bold text-xs">현재 수강 중</h3>
              <span className="text-micro text-green-500 ml-auto">{activeEnrollments.length}건</span>
            </div>
            <div className="divide-y divide-gray-100">
              {activeEnrollments.map((enrollment, idx) => (
                <div key={idx} className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-micro px-1 py-0 rounded-sm font-medium ${SUBJECT_COLOR[enrollment.subject] || SUBJECT_COLOR.other}`}>
                      {SUBJECT_LABEL[enrollment.subject] || enrollment.subject}
                    </span>
                    <span className="text-xs font-medium text-primary">{enrollment.className}</span>
                    {enrollment.teacher && (
                      <span className="text-micro text-gray-400 ml-auto">{enrollment.teacher}</span>
                    )}
                  </div>
                  {enrollment.days?.length > 0 && (
                    <div className="mt-1 text-micro text-gray-400">
                      {enrollment.days.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전체 수강 이력 (퇴원 유형) */}
        {isWithdrawn && (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <BookOpen className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">수강 이력</h3>
              <span className="text-micro text-gray-400 ml-auto">{student.enrollments.length}건</span>
            </div>
            <div className="divide-y divide-gray-100">
              {student.enrollments.length === 0 ? (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">수강 이력이 없습니다</div>
              ) : (
                student.enrollments.map((enrollment, idx) => (
                  <div key={idx} className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-micro px-1 py-0 rounded-sm font-medium ${SUBJECT_COLOR[enrollment.subject] || SUBJECT_COLOR.other}`}>
                        {SUBJECT_LABEL[enrollment.subject] || enrollment.subject}
                      </span>
                      <span className="text-xs font-medium text-primary">{enrollment.className}</span>
                      {enrollment.teacher && (
                        <span className="text-micro text-gray-400 ml-auto">{enrollment.teacher}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-micro text-gray-400">
                      {enrollment.startDate && <span>시작: {enrollment.startDate}</span>}
                      {(enrollment.withdrawalDate || enrollment.endDate) && (
                        <span>종료: {enrollment.withdrawalDate || enrollment.endDate}</span>
                      )}
                      {enrollment.days?.length > 0 && (
                        <span className="ml-auto">{enrollment.days.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 연락처 */}
        {(student.studentPhone || student.parentPhone) && (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <User className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">연락처</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {student.studentPhone && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="shrink-0 whitespace-nowrap text-xs font-medium text-primary-700">학생</span>
                  <span className="text-xs text-primary">{student.studentPhone}</span>
                </div>
              )}
              {student.parentPhone && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="shrink-0 whitespace-nowrap text-xs font-medium text-primary-700">
                    보호자{student.parentName ? ` (${student.parentName})` : ''}
                  </span>
                  <span className="text-xs text-primary">{student.parentPhone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 재원 복구 버튼 (퇴원 유형 + 재원복구 권한) */}
        {isWithdrawn && canReactivate && (
          <div className="pt-2">
            {showConfirm ? (
              <div className="bg-white border border-amber-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 border-b border-amber-200">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <h3 className="text-amber-800 font-bold text-xs">재원 복구 확인</h3>
                </div>
                <div className="p-3">
                  <p className="text-xs text-gray-600 mb-3">
                    <strong>{student.name}</strong> 학생을 재원 상태로 복구합니다.<br />
                    퇴원 정보(퇴원일, 사유, 메모, 상담기록)가 초기화됩니다.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
                      disabled={isReactivating}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleReactivate}
                      disabled={isReactivating}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {isReactivating ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      <span>복구 확인</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>재원 복구</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WithdrawalStudentDetail;
