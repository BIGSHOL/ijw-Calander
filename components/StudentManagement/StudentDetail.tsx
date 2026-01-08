import React, { useState } from 'react';
import { UnifiedStudent } from '../../types';
import BasicInfoTab from './tabs/BasicInfoTab';
import CoursesTab from './tabs/CoursesTab';
import ConsultationsTab from './tabs/ConsultationsTab';
import { User, BookOpen, MessageSquare } from 'lucide-react';

interface StudentDetailProps {
  student: UnifiedStudent;
}

type TabType = 'basic' | 'courses' | 'consultations';

const StudentDetail: React.FC<StudentDetailProps> = ({ student }) => {
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: '기본정보', icon: <User className="w-4 h-4" /> },
    { id: 'courses', label: '수업', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'consultations', label: '상담', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 헤더: 학생 이름 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800">{student.name}</h2>
        {student.englishName && (
          <p className="text-sm text-gray-600 mt-1">{student.englishName}</p>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
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
