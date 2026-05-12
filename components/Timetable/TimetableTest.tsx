/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  시간표 테스트 — 독립 상태로 TimetableManager 임베드                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Phase 1 (현재): 화면 정상 표시 + 진짜 시간표와 독립적인 state.      ║
 * ║  - subject/viewType/mathViewMode 등 시간표 컨트롤 상태를 별도 useState║
 * ║    로 관리. 실 시간표 탭의 동일 상태와 격리됨 (탭 전환해도 양쪽 따로) ║
 * ║  - TimetableManager 가 사용하는 useClasses/useStudents 등 쿼리는      ║
 * ║    그대로 Firestore 를 읽음 → 데이터는 실시간 동기화                  ║
 * ║                                                                       ║
 * ║  ⚠️ Phase 2 (TODO): 현재 mutation(저장/삭제/드래그) 은 진짜 Firestore ║
 * ║     에 반영됨. 시뮬레이션 모드를 자동 활성화하거나 useClassMutations  ║
 * ║     을 stub하여 격리해야 함. 그 전까지는 상단 빨간 배너로 경고 표시.  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import React, { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { UserProfile, StaffMember, TimetableSubjectType } from '../../types';
import TimetableManager from './TimetableManager';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { usePermissions } from '../../hooks/usePermissions';

interface TimetableTestProps {
  currentUser: UserProfile | null;
  staffMember?: StaffMember;
}

const TimetableTest: React.FC<TimetableTestProps> = ({ currentUser }) => {
  // 진짜 시간표와 격리된 독립 상태
  const [subjectTab, setSubjectTab] = useState<TimetableSubjectType | 'shuttle' | 'all'>('math');
  const [viewType, setViewType] = useState<string>('excel');
  const [mathViewMode, setMathViewMode] = useState<string>('excel-teacher');
  const [, setIsTimetableSettingsOpen] = useState(false);

  const { data: teachers = [] } = useTeachers(true);

  // 권한 체크 함수 — 진짜 시간표와 동일 로직
  const { hasPermission } = usePermissions(currentUser);
  const hasPermissionFn = useMemo(() => {
    return (perm: string) => hasPermission(perm as any);
  }, [hasPermission]);

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* 경고 배너 (Phase 2 전까지) */}
      <div className="flex-shrink-0 bg-red-600 text-white px-3 py-1.5 flex items-center gap-2 text-xs font-bold border-b border-red-800">
        <AlertTriangle size={14} />
        <span>⚠️ 테스트 모드 — 진짜 시간표와 독립된 상태이지만,</span>
        <span className="text-yellow-200">변경(드래그·저장·삭제)은 실제 데이터에 반영됩니다.</span>
        <span className="ml-auto text-red-100">읽기만 권장</span>
      </div>

      {/* 실제 시간표 임베드 */}
      <div className="flex-1 min-h-0">
        <TimetableManager
          subjectTab={subjectTab as any}
          onSubjectChange={setSubjectTab as any}
          viewType={viewType as any}
          onViewTypeChange={setViewType}
          currentUser={currentUser}
          teachers={teachers}
          mathViewMode={mathViewMode}
          onMathViewModeChange={setMathViewMode}
          hasPermissionFn={hasPermissionFn}
          setIsTimetableSettingsOpen={setIsTimetableSettingsOpen}
        />
      </div>
    </div>
  );
};

export default TimetableTest;