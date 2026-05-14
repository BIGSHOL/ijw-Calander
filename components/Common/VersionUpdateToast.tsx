import React from 'react';
import { useVersionCheck } from '../../hooks/useVersionCheck';
import { RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * 새 버전이 배포되면 화면 하단에 새로고침 토스트를 표시.
 * - 일반 모드: navy/yellow 토스트, "새로고침" 권고
 * - critical 모드: 빨강 강조 토스트, "지금 새로고침" 강한 권고
 *   (청크 로드 실패 — 일부 기능이 실제로 작동하지 않는 상태)
 *
 * App.tsx 최상단에 한 번만 렌더링합니다.
 */
const VersionUpdateToast: React.FC = () => {
  const { hasUpdate, isCritical, reload } = useVersionCheck();

  if (!hasUpdate) return null;

  if (isCritical) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 duration-300 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-lg shadow-2xl border-2 border-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-sm font-bold">새 버전이 적용되었습니다</span>
            <span className="text-xs text-red-100">일부 기능이 작동하지 않을 수 있습니다. 작업 저장 후 새로고침해주세요.</span>
          </div>
          <button
            onClick={reload}
            className="px-3 py-1.5 bg-white text-red-700 text-sm font-bold rounded hover:bg-red-50 transition-all flex-shrink-0"
          >
            지금 새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 bg-[#081429] text-white px-5 py-3 rounded-lg shadow-2xl">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">새 버전이 있습니다.</span>
        <button
          onClick={reload}
          className="px-3 py-1 bg-[#fdb813] text-[#081429] text-sm font-bold rounded hover:brightness-110 transition-all"
        >
          새로고침
        </button>
      </div>
    </div>
  );
};

export default VersionUpdateToast;
