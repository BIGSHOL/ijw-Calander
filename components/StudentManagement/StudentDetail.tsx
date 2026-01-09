import React, { useState } from 'react';
import { UnifiedStudent } from '../../types';
import BasicInfoTab from './tabs/BasicInfoTab';
import CoursesTab from './tabs/CoursesTab';
import ConsultationsTab from './tabs/ConsultationsTab';
import { User, BookOpen, Phone } from 'lucide-react';

interface StudentDetailProps {
  student: UnifiedStudent;
}

type TabType = 'basic' | 'courses' | 'consultations';

const StudentDetail: React.FC<StudentDetailProps> = ({ student }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: '기본정보', icon: <User className="w-4 h-4" /> },
    { id: 'courses', label: '수업', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'consultations', label: '콜앤상담', icon: <Phone className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
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
        {activeTab === 'consultations' && <ConsultationsTab student={student} />}
      </div>
    </div>
  );
};

export default StudentDetail;
