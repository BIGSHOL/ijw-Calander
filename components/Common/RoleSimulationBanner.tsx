import React, { useState, useMemo } from 'react';
import { Eye, ChevronDown, ChevronUp, User, Users, X, FlaskConical } from 'lucide-react';
import { useRoleSimulation } from '../../hooks/useRoleSimulation';
import { ROLE_LABELS, UserRole, UserProfile } from '../../types';

interface RoleSimulationBannerProps {
  /** 실제 사용자 역할 */
  actualRole: UserRole | null;
  /** 시뮬레이션 가능한 사용자 목록 (마스터 제외) */
  availableUsers?: UserProfile[];
}

/** 시뮬레이션 모드 타입 */
type SimulationMode = 'role' | 'user';

/**
 * 역할/사용자 시뮬레이션 배너
 * 마스터 사용자가 다른 역할 또는 특정 사용자의 권한으로 화면을 테스트할 수 있는 UI
 *
 * - 기본: 작은 플로팅 버튼으로 표시
 * - 클릭 시 확장되어 선택 UI 표시
 * - 시뮬레이션 중이면 확장된 상태로 유지
 */
export function RoleSimulationBanner({ actualRole, availableUsers = [] }: RoleSimulationBannerProps) {
  const {
    simulatedRole,
    simulationType,
    isSimulating,
    startRoleSimulation,
    startUserSimulation,
    stopSimulation,
    availableRoles,
    simulatedRoleLabel,
    simulatedUserInfo,
  } = useRoleSimulation();

  // 패널 확장 상태
  const [isExpanded, setIsExpanded] = useState(false);
  // 시뮬레이션 중 접기 상태
  const [isCollapsed, setIsCollapsed] = useState(false);
  // 로컬 UI 상태: 역할 시뮬레이션 vs 사용자 시뮬레이션
  const [mode, setMode] = useState<SimulationMode>('role');

  // 마스터가 아니면 표시하지 않음
  if (actualRole !== 'master') {
    return null;
  }

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const role = e.target.value as UserRole;
    if (role) {
      startRoleSimulation(role);
    }
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uid = e.target.value;
    const selectedUser = availableUsers.find(u => u.uid === uid);
    if (selectedUser) {
      startUserSimulation(selectedUser);
    }
  };

  // 시뮬레이션 가능한 사용자 (마스터 제외, 승인된 사용자만) - rerender-memo
  const simulatableUsers = useMemo(() =>
    availableUsers.filter(u => u.role !== 'master' && u.status === 'approved'),
    [availableUsers]
  );

  // 역할별로 그룹화 - rerender-memo
  const usersByRole = useMemo(() =>
    simulatableUsers.reduce((acc, user) => {
      const role = user.role || 'user';
      if (!acc[role]) acc[role] = [];
      acc[role].push(user);
      return acc;
    }, {} as Record<UserRole, UserProfile[]>),
    [simulatableUsers]
  );

  // 시뮬레이션 중이 아니고 축소 상태일 때: 작은 플로팅 버튼
  if (!isSimulating && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="
          fixed top-3 right-[270px] z-[9999]
          w-10 h-10 rounded-full
          bg-gray-800 text-gray-300
          hover:bg-gray-700 hover:text-white
          shadow-lg
          flex items-center justify-center
          transition-all duration-200
          group
        "
        title="권한 테스트 모드"
      >
        <FlaskConical className="w-5 h-5" />
        <span className="
          absolute right-12 top-1/2 -translate-y-1/2
          bg-gray-900 text-white text-xs px-2 py-1 rounded
          opacity-0 group-hover:opacity-100 transition-opacity
          whitespace-nowrap pointer-events-none
        ">
          권한 테스트
        </span>
      </button>
    );
  }

  // 시뮬레이션 중이고 접힌 상태일 때: 작은 배너
  if (isSimulating && isCollapsed) {
    const displayName = simulationType === 'user' && simulatedUserInfo
      ? simulatedUserInfo.displayName
      : simulatedRoleLabel;

    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="
          fixed top-3 right-[270px] z-[9999]
          px-3 py-2 rounded-full
          bg-amber-500 text-amber-950
          hover:bg-amber-400
          shadow-lg
          flex items-center gap-2
          transition-all duration-200
        "
        title="시뮬레이션 패널 펼치기"
      >
        <Eye className="w-4 h-4" />
        <span className="text-sm font-medium max-w-[100px] truncate">
          {displayName}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div
      className={`
        fixed top-3 right-[270px] z-[9999]
        rounded-lg shadow-xl
        transition-all duration-300
        ${isSimulating
          ? 'bg-amber-500 text-amber-950'
          : 'bg-gray-800 text-gray-300'
        }
      `}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          {isSimulating ? (
            <Eye className="w-4 h-4" />
          ) : (
            <FlaskConical className="w-4 h-4" />
          )}
          <span className="font-medium text-sm">
            {isSimulating
              ? simulationType === 'user' && simulatedUserInfo
                ? `${simulatedUserInfo.displayName} 으로 보는 중`
                : `${simulatedRoleLabel} 으로 보는 중`
              : '권한 테스트 모드'
            }
          </span>
        </div>
        {isSimulating ? (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 hover:bg-amber-600/50 rounded transition-colors"
            title="접기"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 본문 */}
      <div className="p-4 space-y-3">
        {/* 시뮬레이션 중이 아닐 때: 선택 UI */}
        {!isSimulating && (
          <>
            {/* 모드 선택 탭 */}
            <div className="flex bg-gray-700/50 rounded-md p-0.5">
              <button
                onClick={() => setMode('role')}
                className={`
                  flex-1 px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5
                  transition-colors
                  ${mode === 'role'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                  }
                `}
              >
                <Users className="w-3.5 h-3.5" />
                역할로 보기
              </button>
              <button
                onClick={() => setMode('user')}
                className={`
                  flex-1 px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5
                  transition-colors
                  ${mode === 'user'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                  }
                `}
              >
                <User className="w-3.5 h-3.5" />
                사용자로 보기
              </button>
            </div>

            {/* 역할 선택 드롭다운 */}
            {mode === 'role' && (
              <div className="relative">
                <select
                  value=""
                  onChange={handleRoleChange}
                  className="
                    w-full appearance-none pr-8 pl-3 py-2 rounded-md
                    text-sm font-medium cursor-pointer
                    bg-gray-700 text-gray-200
                    focus:outline-none focus:ring-2 focus:ring-gray-500
                  "
                >
                  <option value="">역할 선택...</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-70" />
              </div>
            )}

            {/* 사용자 선택 드롭다운 */}
            {mode === 'user' && (
              <div className="relative">
                <select
                  value=""
                  onChange={handleUserChange}
                  className="
                    w-full appearance-none pr-8 pl-3 py-2 rounded-md
                    text-sm font-medium cursor-pointer
                    bg-gray-700 text-gray-200
                    focus:outline-none focus:ring-2 focus:ring-gray-500
                  "
                >
                  <option value="">사용자 선택...</option>
                  {availableRoles.map((role) => {
                    const usersInRole = usersByRole[role] || [];
                    if (usersInRole.length === 0) return null;
                    return (
                      <optgroup key={role} label={ROLE_LABELS[role]}>
                        {usersInRole.map((user) => (
                          <option key={user.uid} value={user.uid}>
                            {user.displayName || user.email.split('@')[0]}
                            {user.jobTitle && ` (${user.jobTitle})`}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-70" />
              </div>
            )}

            {/* 안내 */}
            <p className="text-xs opacity-60 text-center">
              {mode === 'role'
                ? '선택한 역할의 기본 권한으로 화면을 봅니다'
                : '선택한 사용자와 동일한 권한으로 화면을 봅니다'
              }
            </p>
          </>
        )}

        {/* 시뮬레이션 중일 때: 종료 버튼 */}
        {isSimulating && (
          <div className="space-y-3">
            {/* 현재 시뮬레이션 정보 */}
            <div className="bg-amber-600/30 rounded-md p-3 text-center">
              {simulationType === 'user' && simulatedUserInfo ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <User className="w-4 h-4" />
                    <span className="font-bold">{simulatedUserInfo.displayName}</span>
                  </div>
                  <div className="text-xs opacity-70">
                    {ROLE_LABELS[simulatedUserInfo.role]}
                    {simulatedUserInfo.jobTitle && ` / ${simulatedUserInfo.jobTitle}`}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="font-bold">{simulatedRoleLabel}</span>
                </div>
              )}
            </div>

            {/* 종료 버튼 */}
            <button
              onClick={stopSimulation}
              className="
                w-full px-4 py-2 rounded-md
                bg-amber-700 text-amber-100
                hover:bg-amber-800
                transition-colors
                text-sm font-bold
              "
            >
              시뮬레이션 종료
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoleSimulationBanner;
