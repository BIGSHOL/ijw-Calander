import React from 'react';
import { ClassInfo } from '../../hooks/useClasses';
import ClassCard from './ClassCard';
import { Inbox } from 'lucide-react';

interface ClassListProps {
  classes: ClassInfo[];
  onClassClick: (classInfo: ClassInfo) => void;
  isLoading?: boolean;
}

const ClassList: React.FC<ClassListProps> = ({ classes, onClassClick, isLoading }) => {
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, index) => (
          <div
            key={index}
            className="bg-white border border-[#081429] border-opacity-10 rounded-lg p-6 animate-pulse"
          >
            <div className="h-6 bg-[#081429] bg-opacity-10 rounded mb-4"></div>
            <div className="h-4 bg-[#081429] bg-opacity-10 rounded mb-3 w-2/3"></div>
            <div className="h-4 bg-[#081429] bg-opacity-10 rounded mb-3 w-1/2"></div>
            <div className="h-4 bg-[#081429] bg-opacity-10 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  // 빈 상태
  if (!classes || classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Inbox className="w-16 h-16 text-[#373d41] opacity-50 mb-4" />
        <h3 className="text-[#081429] font-bold text-lg mb-2">
          등록된 수업이 없습니다
        </h3>
        <p className="text-[#373d41] text-sm">
          새 수업을 추가하거나 필터를 조정해보세요.
        </p>
      </div>
    );
  }

  // 수업 목록 그리드
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {classes.map((classInfo) => (
        <ClassCard
          key={classInfo.id}
          classInfo={classInfo}
          onClick={() => onClassClick(classInfo)}
        />
      ))}
    </div>
  );
};

export default ClassList;
