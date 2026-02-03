import React from 'react';
import { Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { AssignmentWeights, AssignmentConstraints, StrategyPreset } from '../types';
import { STRATEGY_PRESETS, WEIGHT_FACTORS } from '../constants';

interface StrategySettingsPanelProps {
  preset: StrategyPreset;
  weights: AssignmentWeights;
  constraints: AssignmentConstraints;
  onPresetChange: (preset: StrategyPreset) => void;
  onWeightChange: (key: keyof AssignmentWeights, value: number) => void;
  onConstraintChange: (key: keyof AssignmentConstraints, value: boolean) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const StrategySettingsPanel: React.FC<StrategySettingsPanelProps> = ({
  preset,
  weights,
  constraints,
  onPresetChange,
  onWeightChange,
  onConstraintChange,
  isOpen,
  onToggle,
}) => {
  return (
    <div className="bg-white border-b border-gray-200">
      {/* 토글 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Settings size={14} />
        배정 전략 설정
        <span className="ml-auto text-xs text-gray-400">
          {STRATEGY_PRESETS[preset].label}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-3 space-y-3">
          {/* 프리셋 선택 */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(STRATEGY_PRESETS) as [StrategyPreset, typeof STRATEGY_PRESETS[StrategyPreset]][]).map(
              ([id, { label, description }]) => (
                <button
                  key={id}
                  onClick={() => onPresetChange(id)}
                  className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${
                    preset === id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                  title={description}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {/* 가중치 슬라이더 */}
          <div className="space-y-2">
            {WEIGHT_FACTORS.map(({ key, label, description }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0">
                  <div className="text-[11px] font-medium text-gray-700">{label}</div>
                  <div className="text-micro text-gray-400 truncate" title={description}>
                    {description}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={weights[key]}
                  onChange={(e) => {
                    onWeightChange(key, parseInt(e.target.value));
                  }}
                  className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
                  disabled={preset !== 'custom'}
                />
                <span className="w-8 text-right text-xxs font-mono text-gray-500">
                  {weights[key]}
                </span>
              </div>
            ))}
          </div>

          {/* 제약 조건 */}
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[11px] font-medium text-gray-600 mb-1.5">제약 조건</div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={constraints.noOverCapacity}
                  onChange={(e) => onConstraintChange('noOverCapacity', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-[11px] text-gray-700">수용인원 초과 금지</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={constraints.keepConsecutive}
                  onChange={(e) => onConstraintChange('keepConsecutive', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-[11px] text-gray-700">연속 수업 같은 교실 유지</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={constraints.labOnlyForLab}
                  onChange={(e) => onConstraintChange('labOnlyForLab', e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-[11px] text-gray-700">LAB 수업은 LAB 교실만</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
