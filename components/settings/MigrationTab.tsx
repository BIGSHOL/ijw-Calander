import React from 'react';
import { Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';

const MigrationTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [useNewStructure, setUseNewStructure] = React.useState(() => {
    // 기본값: false (기존 구조 사용)
    return storage.getBoolean(STORAGE_KEYS.USE_NEW_DATA_STRUCTURE, false);
  });

  const handleToggleStructure = () => {
    const newValue = !useNewStructure;
    setUseNewStructure(newValue);
    storage.setBoolean(STORAGE_KEYS.USE_NEW_DATA_STRUCTURE, newValue);

    // 캐시 무효화로 새로운 데이터 구조 즉시 적용
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    queryClient.invalidateQueries({ queryKey: ['unified-classes'] });
    queryClient.invalidateQueries({ queryKey: ['enrollments-as-classes'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });

    // 페이지 리로드 권장 알림
    setTimeout(() => {
      if (window.confirm('데이터 구조 전환이 완료되었습니다.\n\n시간표에 즉시 반영하려면 페이지를 새로고침해야 합니다.\n\n지금 새로고침하시겠습니까?')) {
        window.location.reload();
      }
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8" />
          <h2 className="text-2xl font-bold">데이터 마이그레이션</h2>
        </div>
        <p className="text-blue-100 text-sm">
          학생 중심 데이터 구조로 전환합니다. 기존 데이터는 보존됩니다.
        </p>
      </div>

      {/* 데이터 구조 전환 토글 */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">데이터 구조 전환</h3>
            <p className="text-sm text-gray-600">
              마이그레이션 후 새 데이터 구조를 테스트할 수 있습니다
            </p>
          </div>
          <button
            onClick={handleToggleStructure}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              useNewStructure ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                useNewStructure ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div
          className={`p-3 rounded-lg border-2 ${
            useNewStructure ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            {useNewStructure ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">통일된 구조 사용 중</span>
                <span className="text-green-600">(classes 컬렉션)</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-800">기존 데이터 구조 사용 중</span>
                <span className="text-gray-600">(수업목록/english_schedules)</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-700">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">이 마이그레이션의 목표:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>수학/영어 수업을 <strong>통일된 구조</strong>의 <code className="bg-blue-100 px-1 rounded">classes</code> 컬렉션으로 마이그레이션</li>
                  <li>향후 다른 과목(과학, 국어 등) 추가 시 동일한 구조 사용</li>
                  <li><strong>기존 데이터(수업목록, english_schedules)는 보존</strong>됩니다</li>
                </ul>
                <p className="mt-3 font-semibold">통일된 구조 (ScheduleSlot 기반):</p>
                <code className="block bg-blue-100 text-blue-900 p-2 rounded mt-1 text-xs overflow-x-auto">
                  {'{ className, subject, teacher, schedule: [{ day, periodId, room, teacher }], ... }'}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 다음 단계 안내 */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">테스트 방법</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>✅ <strong>수업 관리 탭</strong>에서 영어 수업 추가 (예: LT1a, Ellen 강사, 화 2)</p>
          <p>✅ 위의 <strong>"데이터 구조 전환"</strong> 토글을 켜서 새 데이터 사용</p>
          <p>✅ <strong>영어 시간표</strong>에서 추가한 수업이 정상 표시되는지 확인</p>
          <p>✅ 문제가 없으면 토글을 켜둔 상태로 사용</p>
          <p>⚠️ 문제 발생 시 토글을 끄면 즉시 기존 구조로 복원됩니다</p>
        </div>
      </div>
    </div>
  );
};

export default MigrationTab;
