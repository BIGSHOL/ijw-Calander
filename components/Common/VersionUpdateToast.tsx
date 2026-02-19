import React from 'react';
import { useVersionCheck } from '../../hooks/useVersionCheck';
import { RefreshCw } from 'lucide-react';

/**
 * 새 버전이 배포되면 화면 하단에 새로고침 토스트를 표시.
 * App.tsx 최상단에 한 번만 렌더링합니다.
 */
const VersionUpdateToast: React.FC = () => {
  const { hasUpdate, reload } = useVersionCheck();

  if (!hasUpdate) return null;

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
