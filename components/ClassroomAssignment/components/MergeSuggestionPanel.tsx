import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Users } from 'lucide-react';
import { MergeSuggestion } from '../types';

interface MergeSuggestionPanelProps {
  suggestions: MergeSuggestion[];
  onAccept: (suggestion: MergeSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
}

export const MergeSuggestionPanel: React.FC<MergeSuggestionPanelProps> = ({
  suggestions,
  onAccept,
  onDismiss,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (suggestions.length === 0) return null;

  return (
    <div className="w-64 border-l border-gray-200 bg-white flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-purple-50 border-b border-purple-100 text-sm font-medium text-purple-800 hover:bg-purple-100 transition-colors"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Users size={14} />
        합반 제안 ({suggestions.length})
      </button>

      {isOpen && (
        <div className="flex-1 overflow-auto p-2 space-y-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="bg-purple-50 border border-purple-200 rounded-lg p-2"
            >
              <div className="text-[11px] font-medium text-purple-800 mb-1">
                {suggestion.slots.map(s => s.className).join(' + ')}
              </div>
              <div className="text-[10px] text-purple-600 space-y-0.5">
                <div>레벨 차이: {suggestion.levelDifference}</div>
                <div>합산 인원: {suggestion.combinedStudentCount}명</div>
                <div>추천 강의실: {suggestion.suggestedRoom}</div>
              </div>
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => onAccept(suggestion)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-purple-600 text-white text-[10px] rounded hover:bg-purple-700 transition-colors"
                >
                  <Check size={10} />
                  적용
                </button>
                <button
                  onClick={() => onDismiss(suggestion.id)}
                  className="flex items-center justify-center px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded hover:bg-gray-200 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
