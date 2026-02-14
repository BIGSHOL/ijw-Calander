import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { Search, FileBarChart, Download, Printer, Users } from 'lucide-react';

interface ReportsTabProps {
  currentUser?: UserProfile | null;
}

export default function ReportsTab({ currentUser }: ReportsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [reportType, setReportType] = useState<'student' | 'class' | 'monthly'>('student');

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">학습 리포트</h1>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200">
            <Printer size={14} /> 인쇄
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200">
            <Download size={14} /> 내보내기
          </button>
        </div>
      </div>

      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="학생명 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1">
          {([['student', '학생별'], ['class', '반별'], ['monthly', '월별']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setReportType(id)}
              className={`px-2.5 py-1 text-xs rounded ${reportType === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="text-center text-gray-400 py-12">
          <FileBarChart size={48} className="mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">학습 리포트</p>
          <p className="text-xs">학생의 성적, 출결, 상담 기록을 통합하여<br />종합 학습 리포트를 생성합니다</p>
          <button className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 mx-auto">
            <Users size={14} /> 학생 선택하여 리포트 생성
          </button>
        </div>
      </div>
    </div>
  );
}
