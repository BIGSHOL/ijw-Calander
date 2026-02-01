import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { SubjectType } from '../../types';
import { useClassroomAssignment } from './hooks/useClassroomAssignment';
import { runAutoAssignment } from './hooks/useAutoAssignAlgorithm';
import { AssignmentToolbar } from './components/AssignmentToolbar';
import { AssignmentGrid } from './components/AssignmentGrid';
import { MergeSuggestionPanel } from './components/MergeSuggestionPanel';
import { ApplyConfirmModal } from './components/ApplyConfirmModal';
import { StrategySettingsPanel } from './components/StrategySettingsPanel';
import { AssignmentSlot, AssignmentResult, MergeSuggestion, RoomAssignmentUpdate, AssignmentStats, AssignmentWeights, AssignmentConstraints, StrategyPreset } from './types';
import { DEFAULT_WEIGHTS, DEFAULT_CONSTRAINTS, STRATEGY_PRESETS } from './constants';

const EXCLUDED_ROOMS_KEY = 'classroom_assignment_excluded_rooms';

const ClassroomAssignmentTab: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState('월');
  const [previewResult, setPreviewResult] = useState<AssignmentResult | null>(null);
  const [manualEdits, setManualEdits] = useState<Map<string, string>>(new Map());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  // 필터 상태
  const [timeRange, setTimeRange] = useState<{ start: number; end: number }>({ start: 9, end: 22 });
  const [selectedRooms, setSelectedRooms] = useState<Set<string> | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<SubjectType> | null>(null);

  // 배정 무시 강의실 (자동 배정에서 제외)
  const [excludedRooms, setExcludedRooms] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(EXCLUDED_ROOMS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // 뷰 모드: 'preview'=자동배정 결과, 'original'=원본
  const [viewMode, setViewMode] = useState<'preview' | 'original'>('preview');

  // 토스트 알림
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  // 전략 설정 상태
  const [strategyPreset, setStrategyPreset] = useState<StrategyPreset>('subject-focus');
  const [weights, setWeights] = useState<AssignmentWeights>(DEFAULT_WEIGHTS);
  const [constraints, setConstraints] = useState<AssignmentConstraints>(DEFAULT_CONSTRAINTS);
  const [showSettings, setShowSettings] = useState(false);

  const { slots: firestoreSlots, rooms, loading } = useClassroomAssignment(selectedDay);

  // 현재 표시할 슬롯 (뷰 모드에 따라 프리뷰 or 원본)
  const displaySlots = useMemo((): AssignmentSlot[] => {
    let slots: AssignmentSlot[];

    if (previewResult && viewMode === 'preview') {
      // 수동 편집 적용
      slots = previewResult.slots.map(slot => {
        const manualRoom = manualEdits.get(slot.id);
        if (manualRoom) {
          return { ...slot, assignedRoom: manualRoom, assignmentSource: 'manual' as const };
        }
        return slot;
      });
    } else {
      slots = firestoreSlots;
    }

    // 과목 필터 적용
    if (selectedSubjects) {
      slots = slots.filter(s => selectedSubjects.has(s.subject));
    }

    return slots;
  }, [previewResult, firestoreSlots, manualEdits, viewMode, selectedSubjects]);

  // 표시할 강의실 목록 (필터 적용)
  const displayRooms = useMemo(() => {
    if (!selectedRooms) return rooms;
    return rooms.filter(r => selectedRooms.has(r.name));
  }, [rooms, selectedRooms]);

  // 강의실 이름 목록 (toolbar용)
  const roomNames = useMemo(() => rooms.map(r => r.name), [rooms]);

  // 충돌 슬롯 ID
  const conflictSlotIds = useMemo((): Set<string> => {
    const ids = new Set<string>();
    if (previewResult) {
      for (const conflict of previewResult.conflicts) {
        for (const id of conflict.slotIds) {
          ids.add(id);
        }
      }
    }
    return ids;
  }, [previewResult]);

  // 통계 (single pass over displaySlots)
  const stats = useMemo((): AssignmentStats | null => {
    if (!previewResult) return null;
    let assigned = 0;
    for (let i = 0; i < displaySlots.length; i++) {
      if (displaySlots[i].assignedRoom) assigned++;
    }
    return {
      ...previewResult.stats,
      assigned,
      unassigned: displaySlots.length - assigned,
    };
  }, [previewResult, displaySlots]);

  // 합반 제안 (dismissed 제외)
  const visibleSuggestions = useMemo((): MergeSuggestion[] => {
    if (!previewResult) return [];
    return previewResult.mergeSuggestions.filter(s => !dismissedSuggestions.has(s.id));
  }, [previewResult, dismissedSuggestions]);

  // 전략 설정 핸들러
  const handlePresetChange = useCallback((preset: StrategyPreset) => {
    setStrategyPreset(preset);
    if (preset !== 'custom') {
      setWeights(STRATEGY_PRESETS[preset].weights);
    }
  }, []);

  const handleWeightChange = useCallback((key: keyof AssignmentWeights, value: number) => {
    setStrategyPreset('custom');
    setWeights(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleConstraintChange = useCallback((key: keyof AssignmentConstraints, value: boolean) => {
    setConstraints(prev => ({ ...prev, [key]: value }));
  }, []);

  // 강의실 필터 핸들러
  const handleRoomToggle = useCallback((room: string) => {
    setSelectedRooms(prev => {
      if (!prev) {
        // 전체 선택 → 해당 강의실만 해제
        const next = new Set(roomNames);
        next.delete(room);
        return next;
      }
      const next = new Set(prev);
      if (next.has(room)) {
        next.delete(room);
        if (next.size === 0) return null; // 모두 해제 → 전체 선택으로
      } else {
        next.add(room);
        if (next.size === roomNames.length) return null; // 전체 선택
      }
      return next;
    });
  }, [roomNames]);

  const handleSelectAllRooms = useCallback(() => {
    setSelectedRooms(null);
  }, []);

  const handleDeselectAllRooms = useCallback(() => {
    setSelectedRooms(new Set());
  }, []);

  // 과목 필터 핸들러
  const handleSubjectToggle = useCallback((subject: SubjectType) => {
    setSelectedSubjects(prev => {
      const allSubjects: SubjectType[] = ['math', 'english', 'science', 'korean'];
      if (!prev) {
        // 전체 → 해당 과목만 해제
        const next = new Set(allSubjects);
        next.delete(subject);
        return next;
      }
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
        if (next.size === 0) return null; // 모두 해제 → 전체
      } else {
        next.add(subject);
        if (next.size === allSubjects.length) return null;
      }
      return next;
    });
  }, []);

  // 배정 무시 강의실 핸들러
  const handleExcludedRoomToggle = useCallback((room: string) => {
    setExcludedRooms(prev => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  }, []);

  // excludedRooms localStorage 저장
  useEffect(() => {
    localStorage.setItem(EXCLUDED_ROOMS_KEY, JSON.stringify([...excludedRooms]));
  }, [excludedRooms]);

  // 배정 가능한 강의실 (배정 무시 제외)
  const availableRooms = useMemo(() => {
    return rooms.filter(r => !excludedRooms.has(r.name));
  }, [rooms, excludedRooms]);

  // 자동 배정 실행 (배정 무시 강의실 제외)
  const handleAutoAssign = useCallback(() => {
    const result = runAutoAssignment(firestoreSlots, availableRooms, weights, constraints);
    setPreviewResult(result);
    setManualEdits(new Map());
    setDismissedSuggestions(new Set());
    setViewMode('preview');

    // 결과 토스트 표시
    const assigned = result.slots.filter(s => s.assignedRoom).length;
    const conflicts = result.conflicts.length;
    const merges = result.mergeSuggestions.length;
    let msg = `${assigned}개 수업 배정 완료`;
    if (excludedRooms.size > 0) msg += ` (배정 제외: ${excludedRooms.size}개 강의실)`;
    if (conflicts > 0) msg += ` | ${conflicts}건 충돌`;
    if (merges > 0) msg += ` | ${merges}건 합반 제안`;
    showToast(msg, conflicts > 0 ? 'info' : 'success');
  }, [firestoreSlots, availableRooms, weights, constraints, excludedRooms, showToast]);

  // 드래그 앤 드롭
  const handleSlotDrop = useCallback((slotId: string, targetRoom: string) => {
    if (!previewResult) {
      // 프리뷰 없으면 먼저 현재 상태로 프리뷰 생성
      const result: AssignmentResult = {
        slots: firestoreSlots.map(s => ({ ...s })),
        conflicts: [],
        mergeSuggestions: [],
        stats: {
          totalSlots: firestoreSlots.length,
          assigned: firestoreSlots.filter(s => s.assignedRoom).length,
          unassigned: firestoreSlots.filter(s => !s.assignedRoom).length,
          conflicts: 0,
          mergesAvailable: 0,
        },
      };
      setPreviewResult(result);
    }
    setManualEdits(prev => {
      const next = new Map(prev);
      next.set(slotId, targetRoom);
      return next;
    });
  }, [previewResult, firestoreSlots]);

  // 초기화
  const handleReset = useCallback(() => {
    setPreviewResult(null);
    setManualEdits(new Map());
    setDismissedSuggestions(new Set());
  }, []);

  // 요일 변경 시 프리뷰 리셋
  const handleDayChange = useCallback((day: string) => {
    setSelectedDay(day);
    setPreviewResult(null);
    setManualEdits(new Map());
    setDismissedSuggestions(new Set());
  }, []);

  // 변경 사항 계산
  const pendingChanges = useMemo((): RoomAssignmentUpdate[] => {
    const changes: RoomAssignmentUpdate[] = [];
    for (const slot of displaySlots) {
      if (slot.assignmentSource === 'existing') continue;
      if (!slot.assignedRoom) continue;
      if (slot.assignedRoom === slot.currentRoom) continue;

      const slotKey = `${slot.day}-${slot.periodId}`;
      changes.push({
        classId: slot.classId,
        slotKey,
        room: slot.assignedRoom,
      });
    }
    return changes;
  }, [displaySlots]);

  // 적용
  const handleApply = useCallback(() => {
    if (pendingChanges.length === 0) return;
    setShowConfirmModal(true);
  }, [pendingChanges]);

  // Firestore에 적용
  const handleConfirmApply = useCallback(async () => {
    setIsApplying(true);
    try {
      const batch = writeBatch(db);

      // classId별로 변경사항 그룹핑
      const changesByClass = new Map<string, RoomAssignmentUpdate[]>();
      for (const change of pendingChanges) {
        if (!changesByClass.has(change.classId)) changesByClass.set(change.classId, []);
        changesByClass.get(change.classId)!.push(change);
      }

      for (const [classId, classChanges] of changesByClass) {
        const classRef = doc(db, 'classes', classId);
        const classDoc = await getDoc(classRef);
        if (!classDoc.exists()) continue;

        const existingSlotRooms = classDoc.data().slotRooms || {};
        const updatedSlotRooms = { ...existingSlotRooms };

        for (const change of classChanges) {
          updatedSlotRooms[change.slotKey] = change.room;
        }

        batch.update(classRef, { slotRooms: updatedSlotRooms });
      }

      await batch.commit();
      setPreviewResult(null);
      setManualEdits(new Map());
      setShowConfirmModal(false);
    } catch (error) {
      console.error('[ClassroomAssignment] Apply error:', error);
      alert('적용 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  }, [pendingChanges]);

  // 합반 제안 적용
  const handleAcceptMerge = useCallback((suggestion: MergeSuggestion) => {
    for (const slot of suggestion.slots) {
      setManualEdits(prev => {
        const next = new Map(prev);
        next.set(slot.id, suggestion.suggestedRoom);
        return next;
      });
    }
  }, []);

  // 합반 제안 무시
  const handleDismissMerge = useCallback((suggestionId: string) => {
    setDismissedSuggestions(prev => new Set(prev).add(suggestionId));
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">데이터 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 relative overflow-hidden">
      {/* 상단 툴바 (고정) */}
      <div className="flex-shrink-0">
        <AssignmentToolbar
          selectedDay={selectedDay}
          onDayChange={handleDayChange}
          selectedRooms={selectedRooms}
          onRoomToggle={handleRoomToggle}
          onSelectAllRooms={handleSelectAllRooms}
          onDeselectAllRooms={handleDeselectAllRooms}
          rooms={roomNames}
          excludedRooms={excludedRooms}
          onExcludedRoomToggle={handleExcludedRoomToggle}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          selectedSubjects={selectedSubjects}
          onSubjectToggle={handleSubjectToggle}
          onAutoAssign={handleAutoAssign}
          onApply={handleApply}
          onReset={handleReset}
          hasPreview={previewResult !== null || manualEdits.size > 0}
          stats={stats}
          isApplying={isApplying}
        />

        {/* 뷰 전환 바 (프리뷰 있을 때만) */}
        {previewResult && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1f3c] border-b border-gray-700">
            <span className="text-xxs text-gray-400 mr-1">뷰:</span>
            <button
              onClick={() => setViewMode('original')}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors ${viewMode === 'original'
                ? 'bg-gray-200 text-gray-800'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
            >
              원본 (적용 전)
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors ${viewMode === 'preview'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
            >
              미리보기 (배정 후)
            </button>
            {viewMode === 'original' && (
              <span className="text-xxs text-amber-400 ml-2">
                현재 원본 보기 중 — 자동 배정 결과를 보려면 &quot;미리보기&quot; 클릭
              </span>
            )}
          </div>
        )}
      </div>

      {/* 스크롤 영역 (설정 패널 + 그리드) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <StrategySettingsPanel
          preset={strategyPreset}
          weights={weights}
          constraints={constraints}
          onPresetChange={handlePresetChange}
          onWeightChange={handleWeightChange}
          onConstraintChange={handleConstraintChange}
          isOpen={showSettings}
          onToggle={() => setShowSettings(prev => !prev)}
        />

        <div className="flex flex-1 min-h-0">
          <AssignmentGrid
            slots={displaySlots}
            rooms={displayRooms}
            conflictSlotIds={conflictSlotIds}
            onSlotDrop={handleSlotDrop}
            timeRange={timeRange}
          />

          <MergeSuggestionPanel
            suggestions={visibleSuggestions}
            onAccept={handleAcceptMerge}
            onDismiss={handleDismissMerge}
          />
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <div className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-fade-in ${toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}>
          {toast.message}
        </div>
      )}

      {showConfirmModal && (
        <ApplyConfirmModal
          changes={pendingChanges}
          onConfirm={handleConfirmApply}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
};

export default ClassroomAssignmentTab;
