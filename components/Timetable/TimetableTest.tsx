/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  시간표 테스트 — 진짜 시간표의 READ-ONLY 미러   ⚠️                ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  사용자 결정(2026-05-12): 시간표 테스트 탭은 진짜 시간표(Timetable-  ║
 * ║  Manager)를 그대로 임베드하여 데이터 누락 가능성을 영구히 차단.      ║
 * ║                                                                      ║
 * ║  편집 차단 방식: 본체를 감싸는 div 에 pointer-events:none 적용.      ║
 * ║   - 모든 클릭/드래그/드롭 이벤트가 DOM 단에서 무력화됨               ║
 * ║   - 휠/트랙패드 스크롤은 그대로 동작 (휠은 pointer-event 가 아님)    ║
 * ║   - 사용자 액션을 통한 mutation 경로가 원천 차단됨                   ║
 * ║                                                                      ║
 * ║  단점 (의도된 동작):                                                  ║
 * ║   - 학생 상세 모달도 못 열림 (보기 전용)                              ║
 * ║   - hover highlight 등 시각 효과 비활성                              ║
 * ║                                                                      ║
 * ║  추후 view-only 모달 등 일부 인터랙션이 필요해지면 TimetableManager  ║
 * ║  에 `readOnly` prop 을 추가하는 방향으로 리팩터링.                   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import React from 'react';
import { UserProfile, StaffMember } from '../../types';
import TimetableManager from './TimetableManager';

interface TimetableTestProps {
  currentUser: UserProfile | null;
  staffMember?: StaffMember;
}

const TimetableTest: React.FC<TimetableTestProps> = ({ currentUser }) => {
  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* 헤더 — 클릭 가능 영역 (시간표 본체와 분리) */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
        <span className="text-2xl">🧪</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">시간표 테스트 (시뮬레이션)</h1>
            <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded border border-green-300">
              🔒 원본 보호
            </span>
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded border border-gray-300">
              👁️ read-only
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            진짜 시간표와 100% 동일한 데이터·UI · 모든 클릭/편집 차단 (스크롤만 가능)
          </p>
        </div>
      </div>

      {/* 시간표 본체 — pointer-events:none 으로 사용자 액션 봉인.
          flex-col + overflow-hidden 으로 TimetableManager 내부의 h-full/flex-1 이
          제대로 동작하도록 명시적인 flex container 로 구성 */}
      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{ pointerEvents: 'none' }}
      >
        <TimetableManager currentUser={currentUser} />
      </div>
    </div>
  );
};

export default TimetableTest;