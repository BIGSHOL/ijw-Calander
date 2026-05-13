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
import React, { useState, useMemo, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { UserProfile, StaffMember, TimetableSubjectType } from '../../types';
import TimetableManager from './TimetableManager';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { usePermissions } from '../../hooks/usePermissions';

interface TimetableTestProps {
  currentUser: UserProfile | null;
  staffMember?: StaffMember;
}

// 편집/수정 관련 권한 — 테스트 모드에서 false 강제 (다중방어 #1)
const EDIT_PERMISSION_PATTERNS = [
  '.edit', '.create', '.delete', '.manage', '.update', '.move',
  '.approve', '.assign', '.bucket', '.drag', '.handover',
];

const isEditPermission = (perm: string): boolean => {
  return EDIT_PERMISSION_PATTERNS.some(suffix => perm.endsWith(suffix) || perm.includes(suffix + '_'));
};

const TimetableTest: React.FC<TimetableTestProps> = ({ currentUser }) => {
  // 진짜 시간표와 격리된 독립 상태
  const [subjectTab, setSubjectTab] = useState<TimetableSubjectType | 'shuttle' | 'all'>('math');
  const [viewType, setViewType] = useState<string>('excel');
  const [mathViewMode, setMathViewMode] = useState<string>('excel-teacher');
  const [, setIsTimetableSettingsOpen] = useState(false);

  const { data: teachers = [] } = useTeachers(true);

  // 권한 체크 함수 — 편집 권한은 모두 false 강제 (조회·이동·드롭다운은 통과)
  const { hasPermission } = usePermissions(currentUser);
  const hasPermissionFn = useMemo(() => {
    return (perm: string) => {
      if (isEditPermission(perm)) return false;
      return hasPermission(perm as any);
    };
  }, [hasPermission]);

  // 다중방어 #2: capture-phase 이벤트 차단 — wheel/scroll 은 통과, click/drag 류만 막음
  // CSS pointer-events:none 방식은 휠 스크롤까지 죽여서 시간표 아래 영역을 볼 수가 없었음.
  // 이제 JS capture 로 편집성 이벤트만 selectively 차단 → 스크롤·hover·focus 모두 정상.
  // 예외: .readonly-allow 클래스 가진 요소 (주차 네비, 과목/뷰 토글, 학생 통계 드롭다운)
  useEffect(() => {
    document.body.classList.add('timetable-readonly'); // 시각 힌트(cursor)용 — 차단은 JS 가 담당
    const main = document.getElementById('main-content');
    if (!main) return () => { document.body.classList.remove('timetable-readonly'); };

    const blockEvent = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.readonly-allow')) return; // 허용영역
      e.preventDefault();
      e.stopPropagation();
    };

    // 편집/드래그/컨텍스트 류 이벤트만 차단. wheel/scroll/touchmove/keyboard 는 통과.
    const blockedEvents = ['click', 'mousedown', 'mouseup', 'dblclick', 'dragstart', 'dragenter', 'dragover', 'drop', 'contextmenu'];
    blockedEvents.forEach(ev => main.addEventListener(ev, blockEvent, true));

    return () => {
      document.body.classList.remove('timetable-readonly');
      blockedEvents.forEach(ev => main.removeEventListener(ev, blockEvent, true));
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* READ-ONLY 안내 배너 */}
      <div className="flex-shrink-0 bg-blue-600 text-white px-3 py-1.5 flex items-center gap-2 text-xs font-bold border-b border-blue-800 readonly-allow">
        <Eye size={14} />
        <span>읽기 전용 모드 — 주차 이동·과목 전환·통계 조회만 가능,</span>
        <span className="text-blue-100">편집 작업 모두 차단됩니다.</span>
        <span className="ml-auto text-blue-200">리팩토링 검증용</span>
      </div>

      {/* 실제 시간표 임베드 (pointer-events:none 적용됨) */}
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