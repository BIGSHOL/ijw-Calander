import React, { useState } from 'react';
import { UnifiedStudent } from '../../types';
import BasicInfoTab from './tabs/BasicInfoTab';
import CoursesTab from './tabs/CoursesTab';
import GradesTab from './tabs/GradesTab';
import ConsultationsTab from './tabs/ConsultationsTab';
import WithdrawalModal from './WithdrawalModal';
import { useStudents } from '../../hooks/useStudents';
import { User, BookOpen, MessageSquare, GraduationCap, UserMinus, UserCheck } from 'lucide-react';

interface StudentDetailProps {
  student: UnifiedStudent;
}

type TabType = 'basic' | 'courses' | 'grades' | 'consultations';

const StudentDetail: React.FC<StudentDetailProps> = ({ student }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const { updateStudent } = useStudents();

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: '기본정보', icon: <User className="w-4 h-4" /> },
    { id: 'courses', label: '수업', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'grades', label: '성적', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'consultations', label: '상담', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const isWithdrawn = student.status === 'withdrawn';

  // 퇴원 처리
  const handleWithdrawal = async (data: {
    withdrawalDate: string;
    withdrawalReason?: string;
    withdrawalMemo?: string;
  }) => {
    await updateStudent(student.id, {
      status: 'withdrawn',
      endDate: data.withdrawalDate,
      withdrawalDate: data.withdrawalDate,
      withdrawalReason: data.withdrawalReason,
      withdrawalMemo: data.withdrawalMemo,
    });
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

  return (
    <div className="flex flex-col h-full">
      {/* 헤더: 학생 이름 + 퇴원/재원 버튼 */}
      <div className="p-5 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#081429]">{student.name}</h2>
            {student.englishName && (
              <p className="text-sm text-gray-500 mt-1 font-medium">{student.englishName}</p>
            )}
          </div>

          {/* 퇴원/재원 버튼 */}
          {isWithdrawn ? (
            <button
              onClick={handleReactivate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>재원 복구</span>
            </button>
          ) : (
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <UserMinus className="w-4 h-4" />
              <span>퇴원 처리</span>
            </button>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 bg-white px-5">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-1 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id
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

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'basic' && <BasicInfoTab student={student} />}
        {activeTab === 'courses' && <CoursesTab student={student} />}
        {activeTab === 'grades' && <GradesTab student={student} />}
        {activeTab === 'consultations' && <ConsultationsTab student={student} />}
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
