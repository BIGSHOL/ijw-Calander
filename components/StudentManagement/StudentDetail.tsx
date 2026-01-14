import React, { useState } from 'react';
import { UnifiedStudent } from '../../types';
import BasicInfoTab from './tabs/BasicInfoTab';
import CoursesTab from './tabs/CoursesTab';
import GradesTab from './tabs/GradesTab';
import ConsultationsTab from './tabs/ConsultationsTab';
import { User, BookOpen, MessageSquare, GraduationCap, UserCheck, Calendar, AlertCircle } from 'lucide-react';
import { useConvertToActive } from '../../hooks/useProspectConversion';

interface StudentDetailProps {
  student: UnifiedStudent;
}

type TabType = 'basic' | 'courses' | 'grades' | 'consultations';

const StudentDetail: React.FC<StudentDetailProps> = ({ student }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertStartDate, setConvertStartDate] = useState(
    student.plannedStartDate || new Date().toISOString().split('T')[0]
  );
  const convertToActive = useConvertToActive();

  const isProspect = student.status === 'prospect';

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: '기본정보', icon: <User className="w-4 h-4" /> },
    { id: 'courses', label: '수업', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'grades', label: '성적', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'consultations', label: '상담', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const handleConvertToActive = () => {
    if (!convertStartDate) {
      alert('등록일을 선택해주세요.');
      return;
    }

    convertToActive.mutate({
      studentId: student.id,
      startDate: convertStartDate,
      enrollments: student.enrollments || [],
    }, {
      onSuccess: () => {
        alert(`[${student.name}] 학생이 재원생으로 전환되었습니다.`);
        setShowConvertModal(false);
      },
      onError: (error) => {
        console.error('전환 오류:', error);
        alert('재원생 전환에 실패했습니다.');
      }
    });
  };

  const getProspectStatusLabel = (status?: string) => {
    switch (status) {
      case 'contacted': return '상담 완료';
      case 'pending_registration': return '등록 예정';
      case 'pending_test': return '테스트 예정';
      case 'on_hold': return '보류';
      default: return '예비원생';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 예비원생 배너 */}
      {isProspect && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200 px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <span className="text-sm font-bold text-orange-800">
                  {getProspectStatusLabel(student.prospectStatus)}
                </span>
                {student.plannedStartDate && (
                  <span className="ml-2 text-xs text-orange-600">
                    (등록 예정: {student.plannedStartDate})
                  </span>
                )}
                {student.plannedSubjects && student.plannedSubjects.length > 0 && (
                  <span className="ml-2 text-xs text-orange-600">
                    • {student.plannedSubjects.map(s => s === 'math' ? '수학' : '영어').join(', ')}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowConvertModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
            >
              <UserCheck className="w-4 h-4" />
              재원생 전환
            </button>
          </div>
          {student.prospectNotes && (
            <p className="mt-2 text-xs text-orange-700 bg-orange-100/50 rounded px-3 py-1.5">
              📝 {student.prospectNotes}
            </p>
          )}
        </div>
      )}

      {/* 헤더: 학생 이름 */}
      <div className="p-5 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-bold text-[#081429]">{student.name}</h2>
        {student.englishName && (
          <p className="text-sm text-gray-500 mt-1 font-medium">{student.englishName}</p>
        )}
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

      {/* 재원생 전환 모달 */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-green-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                재원생 전환
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  <strong className="text-gray-900">{student.name}</strong> 학생을 재원생으로 전환합니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline-block w-4 h-4 mr-1" />
                  등록일 (수업 시작일)
                </label>
                <input
                  type="date"
                  value={convertStartDate}
                  onChange={(e) => setConvertStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {student.plannedSubjects && student.plannedSubjects.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">등록 예정 과목</p>
                  <div className="flex gap-2">
                    {student.plannedSubjects.map(subject => (
                      <span
                        key={subject}
                        className={`px-2 py-1 text-xs font-medium rounded ${subject === 'math' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}
                      >
                        {subject === 'math' ? '수학' : '영어'}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    ※ 수업 배치는 "수업" 탭에서 별도로 진행해주세요.
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
              <button
                onClick={handleConvertToActive}
                disabled={convertToActive.isPending}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
              >
                {convertToActive.isPending ? '전환 중...' : '재원생으로 전환'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetail;

