import React from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { useTeacherClasses } from '../../hooks/useTeacherClasses';

interface StaffClassHistoryProps {
  staffName: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  math: '수학',
  english: '영어',
  science: '과학',
  korean: '국어',
  other: '기타',
};

const StaffClassHistory: React.FC<StaffClassHistoryProps> = ({ staffName }) => {
  const { data: classes, isLoading } = useTeacherClasses(staffName);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">수업 이력을 불러오는 중...</span>
      </div>
    );
  }

  if (!classes || classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <BookOpen className="w-8 h-8 mb-2" />
        <p className="text-sm">담당한 수업 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <BookOpen className="w-3 h-3 text-primary" />
        <h3 className="text-primary font-bold text-xs">수업 이력</h3>
        <span className="text-xs text-gray-400 ml-1">({classes.length}건)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-2 py-1.5 font-bold text-primary-700">수업명</th>
              <th className="text-left px-2 py-1.5 font-bold text-primary-700">과목</th>
              <th className="text-center px-2 py-1.5 font-bold text-primary-700">역할</th>
              <th className="text-center px-2 py-1.5 font-bold text-primary-700">상태</th>
              <th className="text-left px-2 py-1.5 font-bold text-primary-700">시작일</th>
              <th className="text-left px-2 py-1.5 font-bold text-primary-700">종료일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {classes.map((cls) => (
              <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-2 py-1.5 font-medium text-primary">{cls.className}</td>
                <td className="px-2 py-1.5 text-gray-600">
                  {SUBJECT_LABELS[cls.subject] || cls.subject}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    cls.role === '담임'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {cls.role}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    cls.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {cls.isActive ? '진행중' : '종료'}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-gray-500">{cls.startDate || '-'}</td>
                <td className="px-2 py-1.5 text-gray-500">{cls.endDate || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffClassHistory;
