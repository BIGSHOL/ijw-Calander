import React from 'react';
import { Database, CheckCircle2 } from 'lucide-react';

const MigrationTab: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8" />
          <h2 className="text-2xl font-bold">데이터 마이그레이션 완료</h2>
          <CheckCircle2 className="w-6 h-6 text-green-200" />
        </div>
        <p className="text-green-100 text-sm">
          학생 중심 데이터 구조로 성공적으로 전환되었습니다.
        </p>
      </div>

      {/* 현재 상태 */}
      <div className="bg-white rounded-lg border-2 border-green-200 p-6">
        <div className="p-3 rounded-lg bg-green-50 border-2 border-green-200">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-800">통일된 구조 사용 중</span>
            <span className="text-green-600">(classes 컬렉션)</span>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-700">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">현재 데이터 구조:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>수학/영어 수업: <code className="bg-blue-100 px-1 rounded">classes</code> 컬렉션</li>
                <li>학생 등록: <code className="bg-blue-100 px-1 rounded">students/{'{studentId}'}/enrollments</code> 서브컬렉션</li>
                <li>강사 정보: <code className="bg-blue-100 px-1 rounded">staff</code> 컬렉션</li>
              </ul>
              <p className="mt-3 font-semibold">구조 예시 (ScheduleSlot 기반):</p>
              <code className="block bg-blue-100 text-blue-900 p-2 rounded mt-1 text-xs overflow-x-auto">
                {'{ className, subject, teacher, schedule: [{ day, periodId, room }], isActive, ... }'}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* 완료 안내 */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">마이그레이션 완료 체크리스트</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>✅ 수학/영어 시간표 → <code className="bg-gray-100 px-1 rounded">classes</code> 컬렉션 사용</p>
          <p>✅ 학생 관리 → <code className="bg-gray-100 px-1 rounded">enrollments</code> 서브컬렉션 사용</p>
          <p>✅ Cloud Functions 업데이트 완료</p>
          <p>✅ 레거시 fallback 코드 제거 완료</p>
          <p className="text-gray-500 mt-4">
            💡 레거시 컬렉션 정리 완료. 현재 <code className="bg-gray-100 px-1 rounded">classes</code> 컬렉션을 사용합니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MigrationTab;
