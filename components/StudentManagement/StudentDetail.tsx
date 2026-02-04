import React, { useState } from 'react';
import { UnifiedStudent, UserProfile } from '../../types';
import BasicInfoTab from './tabs/BasicInfoTab';
import CoursesTab from './tabs/CoursesTab';
import GradesTab from './tabs/GradesTab';
import ConsultationsTab from './tabs/ConsultationsTab';
import AttendanceTab from './tabs/AttendanceTab';
import BillingTab from './tabs/BillingTab';
import WithdrawalModal from './WithdrawalModal';
import { useStudents } from '../../hooks/useStudents';
import { usePermissions } from '../../hooks/usePermissions';
import { collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useQueryClient } from '@tanstack/react-query';
import { User, BookOpen, MessageSquare, GraduationCap, UserMinus, UserCheck, Trash2, Calendar, CreditCard } from 'lucide-react';

interface StudentDetailProps {
  student: UnifiedStudent;
  compact?: boolean;  // 모달에서 사용 시 컴팩트 모드
  readOnly?: boolean; // 조회 전용 모드 (수정 버튼 숨김)
  currentUser?: UserProfile | null; // 권한 체크용
  // compact 모드(모달)에서는 퇴원처리 버튼이 항상 숨겨짐 - 학생관리에서만 처리
}

type TabType = 'basic' | 'courses' | 'grades' | 'attendance' | 'consultations' | 'billing';

const StudentDetail: React.FC<StudentDetailProps> = ({ student, compact = false, readOnly = false, currentUser }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const { updateStudent, deleteStudent } = useStudents();
  const queryClient = useQueryClient();

  // 권한 체크
  const { hasPermission } = usePermissions(currentUser || null);
  const isMaster = currentUser?.role === 'master';
  const canEditStudent = isMaster || hasPermission('students.edit');
  const canDeleteStudent = isMaster || hasPermission('students.delete');
  const canManageEnrollment = isMaster || hasPermission('classes.edit');  // 수강배정은 수업 관리 권한 필요

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: '기본정보', icon: <User className="w-3 h-3" /> },
    { id: 'courses', label: '수업', icon: <BookOpen className="w-3 h-3" /> },
    { id: 'grades', label: '성적', icon: <GraduationCap className="w-3 h-3" /> },
    { id: 'attendance', label: '출결', icon: <Calendar className="w-3 h-3" /> },
    { id: 'consultations', label: '상담', icon: <MessageSquare className="w-3 h-3" /> },
    { id: 'billing', label: '수납', icon: <CreditCard className="w-3 h-3" /> },
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
          <span className="text-sm font-bold text-[#081429]">{student.name}</span>

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

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 bg-white px-3">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-1 py-1.5 text-xs font-bold border-b-2 transition-all ${activeTab === tab.id
                ? 'text-[#081429] border-[#fdb813]'
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

export default StudentDetail;
