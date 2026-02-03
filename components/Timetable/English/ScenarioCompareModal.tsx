import React, { useState } from 'react';
import { X, ArrowLeftRight, Check, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { ScenarioEntry } from '../../../types';
import { useSimulationOptional } from './context/SimulationContext';

interface ScenarioCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: ScenarioEntry[];
  onLoadScenario?: (scenarioId: string, scenarioName: string) => void;
}

const ScenarioCompareModal: React.FC<ScenarioCompareModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  onLoadScenario
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const simulation = useSimulationOptional();

  // 시나리오 불러오기
  const handleLoadScenario = async (scenario: ScenarioEntry) => {
    if (loadingId) return; // 이미 로딩 중이면 무시

    setLoadingId(scenario.id);

    try {
      // SimulationContext를 통해 시나리오 불러오기
      if (simulation?.isScenarioMode) {
        await simulation.loadFromScenario(scenario.id);
        setCurrentScenarioId(scenario.id);
        onLoadScenario?.(scenario.id, scenario.name);
      }
    } catch (error) {
      console.error('시나리오 불러오기 실패:', error);
      alert('시나리오 불러오기에 실패했습니다.');
    } finally {
      setLoadingId(null);
    }
  };

  // 키보드 단축키 (1, 2, 3)
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= scenarios.length) {
        handleLoadScenario(scenarios[num - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scenarios, loadingId]);

  if (!isOpen || scenarios.length < 2) return null;

  // 현재 시나리오 이름 가져오기
  const currentScenarioName = currentScenarioId
    ? scenarios.find(s => s.id === currentScenarioId)?.name
    : null;

  // 접힌 상태일 때: 작은 pill 버튼
  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="
          fixed top-4 left-1/2 -translate-x-1/2 z-[100]
          px-4 py-2 rounded-sm
          bg-indigo-600 text-white
          hover:bg-indigo-500
          shadow-xl
          flex items-center gap-2
          transition-all duration-200
          animate-in slide-in-from-top
        "
        title="시나리오 비교 패널 펼치기"
      >
        <ArrowLeftRight size={14} />
        <span className="text-sm font-bold">
          {currentScenarioName || '시나리오 비교'}
        </span>
        <ChevronDown size={14} />
      </button>
    );
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-200"
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-white rounded-sm shadow-2xl border-2 border-indigo-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={16} />
            <span className="font-bold text-sm">시나리오 빠른 전환</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-indigo-500 rounded-sm transition-colors"
              title="접기"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-indigo-500 rounded-sm transition-colors"
              title="닫기"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 시나리오 버튼들 */}
        <div className="flex items-center gap-2 p-3 bg-gray-50">
          {scenarios.map((scenario, idx) => {
            const isLoading = loadingId === scenario.id;
            const isCurrent = currentScenarioId === scenario.id;

            return (
              <button
                key={scenario.id}
                onClick={() => handleLoadScenario(scenario)}
                disabled={isLoading || loadingId !== null}
                className={`
                  relative flex items-center gap-2 px-4 py-2 rounded-sm font-bold text-sm
                  transition-all duration-200 min-w-[120px]
                  ${isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-2'
                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50'
                  }
                  ${isLoading ? 'opacity-70' : ''}
                  disabled:cursor-not-allowed
                `}
              >
                {/* 단축키 뱃지 */}
                <span className={`
                  absolute -top-2 -left-2 w-5 h-5 rounded-sm text-xs flex items-center justify-center font-bold
                  ${isCurrent ? 'bg-indigo-400 text-white' : 'bg-gray-300 text-gray-600'}
                `}>
                  {idx + 1}
                </span>

                {/* 로딩/체크 아이콘 */}
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isCurrent ? (
                  <Check size={14} />
                ) : null}

                {/* 시나리오 이름 */}
                <span className="truncate max-w-[100px]">{scenario.name}</span>
              </button>
            );
          })}
        </div>

        {/* 안내 텍스트 */}
        <div className="px-4 py-2 bg-gray-100 text-xs text-gray-500 text-center border-t">
          숫자키 <kbd className="px-1.5 py-0.5 bg-white rounded-sm border font-mono">1</kbd>
          <kbd className="px-1.5 py-0.5 bg-white rounded-sm border font-mono mx-1">2</kbd>
          {scenarios.length > 2 && <kbd className="px-1.5 py-0.5 bg-white rounded-sm border font-mono">3</kbd>}
          {' '}으로 빠르게 전환
        </div>
      </div>
    </div>
  );
};

export default ScenarioCompareModal;
