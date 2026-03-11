import React, { useState } from 'react';
import { UnifiedStudent, UserProfile } from '../../types';
import BasicInfoTab from './tabs/BasicInfoTab';
import CoursesTab from './tabs/CoursesTab';
import GradesTab from './tabs/GradesTab';
import ConsultationsTab from './tabs/ConsultationsTab';
import AttendanceTab from './tabs/AttendanceTab';
import BillingTab from './tabs/BillingTab';
import StudentTextbookTab from './tabs/StudentTextbookTab';
import WithdrawalModal from './WithdrawalModal';
import { useStudents } from '../../hooks/useStudents';
import { usePermissions } from '../../hooks/usePermissions';
import { collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';
import { User, BookOpen, MessageSquare, GraduationCap, UserMinus, UserCheck, Trash2, Calendar, CreditCard, AlertTriangle, BookCopy, TrendingUp, Info, Loader2 } from 'lucide-react';
import { useStudentEnrollmentValidation } from './hooks/useStudentEnrollmentValidation';
import { useStudentReports } from '../../hooks/useStudentReports';

interface StudentDetailProps {
  student: UnifiedStudent;
  compact?: boolean;  // 모달에서 사용 시 컴팩트 모드
  readOnly?: boolean; // 조회 전용 모드 (수정 버튼 숨김)
  currentUser?: UserProfile | null; // 권한 체크용
  // compact 모드(모달)에서는 퇴원처리 버튼이 항상 숨겨짐 - 학생관리에서만 처리
}

type TabType = 'basic' | 'courses' | 'grades' | 'attendance' | 'consultations' | 'billing' | 'textbooks' | 'progress';

const StudentDetail: React.FC<StudentDetailProps> = ({ student: studentProp, compact = false, readOnly = false, currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showEnrollmentWarning, setShowEnrollmentWarning] = useState(true);
  const { students, updateStudent, deleteStudent } = useStudents();
  const queryClient = useQueryClient();

  // React Query 캐시에서 최신 학생 데이터 사용 (실시간 반영)
  const student = students.find(s => s.id === studentProp.id) || studentProp;

  // Enrollment 유효성 검사
  const { hasIssues, invalidEnrollments } = useStudentEnrollmentValidation(student);

  // 권한 체크
  const { hasPermission } = usePermissions(currentUser || null);
  const canEditStudent = hasPermission('students.edit');
  const canDeleteStudent = hasPermission('students.delete');
  const canManageEnrollment = hasPermission('classes.edit');  // 수강배정은 수업 관리 권한 필요

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: '기본정보', icon: <User className="w-3 h-3" /> },
    { id: 'courses', label: '수업', icon: <BookOpen className="w-3 h-3" /> },
    { id: 'grades', label: '성적', icon: <GraduationCap className="w-3 h-3" /> },
    { id: 'attendance', label: '출결', icon: <Calendar className="w-3 h-3" /> },
    { id: 'consultations', label: '상담', icon: <MessageSquare className="w-3 h-3" /> },
    { id: 'billing', label: '수납', icon: <CreditCard className="w-3 h-3" /> },
    { id: 'textbooks', label: '교재', icon: <BookCopy className="w-3 h-3" /> },
    { id: 'progress', label: '진도', icon: <TrendingUp className="w-3 h-3" /> },
  ];

  const isWithdrawn = student.status === 'withdrawn';

  // 퇴원 처리
  const handleWithdrawal = async (data: {
    withdrawalDate: string;
    withdrawalReason?: string;
    withdrawalMemo?: string;
  }) => {
    // 1. 학생 문서 상태 변경
    await updateStudent(student.id, {
      status: 'withdrawn',
      endDate: data.withdrawalDate,
      withdrawalDate: data.withdrawalDate,
      withdrawalReason: data.withdrawalReason,
      withdrawalMemo: data.withdrawalMemo,
    });

    // 2. 모든 활성 enrollment에도 withdrawalDate 설정 (시간표 퇴원 섹션 실시간 반영)
    try {
      const enrollmentsRef = collection(db, 'students', student.id, 'enrollments');
      const snapshot = await getDocs(enrollmentsRef);

      const updatePromises = snapshot.docs
        .filter(doc => {
          const d = doc.data();
          return !d.withdrawalDate && !d.endDate; // 아직 퇴원 처리 안 된 enrollment만
        })
        .map(doc =>
          updateDoc(doc.ref, {
            withdrawalDate: data.withdrawalDate,
            endDate: data.withdrawalDate,
          })
        );

      await Promise.all(updatePromises);

      // 모든 시간표 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['mathClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });
      queryClient.invalidateQueries({ queryKey: ['classStudents'] });
    } catch (error) {
      console.error('enrollment 퇴원 동기화 오류:', error);
    }
  };

  // 재원 복구
  const handleReactivate = async () => {
    if (!window.confirm(`${student.name} 학생을 재원 상태로 복구하시겠습니까?`)) return;

    await updateStudent(student.id, {
      status: 'active',
      endDate: undefined,
      withdrawalDate: undefined,
      withdrawalReason: undefined,
      withdrawalMemo: undefined,
    });
  };

  // 학생 삭제 (완전 삭제)
  const handleDelete = async () => {
    if (!window.confirm(`⚠️ ${student.name} 학생을 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) return;
    if (!window.confirm(`정말로 삭제하시겠습니까? 모든 데이터가 영구적으로 삭제됩니다.`)) return;

    await deleteStudent(student.id, true); // hardDelete = true
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더: 학생 이름 + 퇴원/재원 버튼 */}
      <div className={`px-3 py-2 border-b border-gray-200 bg-white ${compact ? 'pr-10' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary">{student.name}</span>
            {student.studentCode && (
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-sm">
                {student.studentCode}
              </span>
            )}
          </div>

          {/* 퇴원/재원/삭제 버튼 - compact 모드(모달)에서는 항상 숨김, 학생관리에서만 표시 */}
          {!compact && (
            <div className="flex items-center gap-1">
              {isWithdrawn ? (
                <button
                  onClick={handleReactivate}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 transition-colors"
                >
                  <UserCheck className="w-3 h-3" />
                  <span>재원 복구</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowWithdrawalModal(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-sm hover:bg-red-200 transition-colors"
                >
                  <UserMinus className="w-3 h-3" />
                  <span>퇴원 처리</span>
                </button>
              )}
              {canDeleteStudent && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 p-1 text-xs bg-gray-100 text-gray-600 rounded-sm hover:bg-red-100 hover:text-red-700 transition-colors"
                  title="학생 삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enrollment 유효성 경고 */}
      {hasIssues && showEnrollmentWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-amber-900 mb-1">
                Enrollment 불일치 ({invalidEnrollments.length}개)
              </div>
              <div className="text-xs text-amber-700 space-y-1">
                {invalidEnrollments.map((invalid, idx) => (
                  <div key={invalid.enrollmentId} className="flex items-center gap-2">
                    <span className="font-medium">"{invalid.className}"</span>
                    <span className="text-amber-600">→</span>
                    <span className="text-gray-600">수업 목록에 없음</span>
                    {invalid.suggestedClasses.length > 0 && (
                      <span className="text-gray-500">
                        (추천: {invalid.suggestedClasses.join(', ')})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setActiveTab('courses')}
                className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-semibold underline"
              >
                수업 탭에서 수정하기 →
              </button>
            </div>
            <button
              onClick={() => setShowEnrollmentWarning(false)}
              className="text-amber-600 hover:text-amber-800 p-1"
              title="경고 닫기"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 bg-white px-3">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-1 py-1.5 text-xs font-bold border-b-2 transition-all ${activeTab === tab.id
                ? 'text-primary border-accent'
                : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 - 각 탭별 권한 체크 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'basic' && <BasicInfoTab student={student} readOnly={readOnly || !canEditStudent} />}
        {activeTab === 'courses' && <CoursesTab student={student} compact={compact} readOnly={readOnly || !canManageEnrollment} currentUser={currentUser} />}
        {activeTab === 'grades' && <GradesTab student={student} readOnly={readOnly || !canEditStudent} currentUser={currentUser} />}
        {activeTab === 'attendance' && <AttendanceTab student={student} readOnly={readOnly || !canEditStudent} />}
        {activeTab === 'consultations' && <ConsultationsTab student={student} readOnly={readOnly || !canEditStudent} currentUser={currentUser} />}
        {activeTab === 'billing' && <BillingTab student={student} />}
        {activeTab === 'textbooks' && <StudentTextbookTab student={student} />}
        {activeTab === 'progress' && <ProgressTab student={student} />}
      </div>

      {/* 퇴원 처리 모달 */}
      {showWithdrawalModal && (
        <WithdrawalModal
          student={student}
          onClose={() => setShowWithdrawalModal(false)}
          onConfirm={handleWithdrawal}
        />
      )}
    </div>
  );
};

/** 진도 탭 컴포넌트 */
const ProgressTab: React.FC<{ student: UnifiedStudent }> = ({ student }) => {
  const { data: reports, isLoading, error } = useStudentReports(student.name, 10);
  const [selectedReport, setSelectedReport] = useState<typeof reports[number] | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-red-600 text-sm font-medium">보고서 조회 실패</p>
          <p className="text-gray-400 text-xs mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-sm font-medium">보고서 없음</p>
          <p className="text-gray-400 text-xs mt-1">Edutrix에 등록된 보고서가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-700">최근 보고서 ({reports.length}개)</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 border-b border-gray-200 text-left font-semibold text-gray-700">수업날짜</th>
              <th className="px-2 py-1.5 border-b border-gray-200 text-left font-semibold text-gray-700">선생님</th>
              <th className="px-2 py-1.5 border-b border-gray-200 text-left font-semibold text-gray-700">진도</th>
              <th className="px-2 py-1.5 border-b border-gray-200 text-center font-semibold text-gray-700">시험성적</th>
              <th className="px-2 py-1.5 border-b border-gray-200 text-center font-semibold text-gray-700">숙제</th>
              <th className="px-2 py-1.5 border-b border-gray-200 text-center font-semibold text-gray-700">기타</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report, index) => {
              const dateObj = new Date(report.date);
              const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

              // 시험 점수 파싱
              const examScore = report.exam_info || '-';

              // 숙제 여부 (assignment_score 기준: 0이면 미제출, 나머지는 제출)
              let homeworkStatus = '-';
              if (report.assignment_score !== null && report.assignment_score !== undefined) {
                const score = parseInt(report.assignment_score, 10);
                homeworkStatus = isNaN(score) || score > 0 ? '○' : '✕';
              }

              return (
                <tr key={report.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-2 py-1.5 border-b border-gray-200">{formattedDate}</td>
                  <td className="px-2 py-1.5 border-b border-gray-200">{report.teacher_name || '-'}</td>
                  <td className="px-2 py-1.5 border-b border-gray-200 text-xs max-w-xs">
                    <div className="truncate" title={report.notes || undefined}>
                      {report.notes || '-'}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-200 text-center">{examScore}</td>
                  <td className="px-2 py-1.5 border-b border-gray-200 text-center">{homeworkStatus}</td>
                  <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                    {report.notes ? (
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-700 transition-colors"
                        title="전체 내용 보기"
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 특이사항 모달 */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelectedReport(null)}>
          <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">특이사항</h3>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="mb-2 text-xs text-gray-500">
              <div>날짜: {selectedReport.date}</div>
              <div>선생님: {selectedReport.teacher_name || '-'}</div>
            </div>
            <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {selectedReport.notes || '내용 없음'}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetail;
