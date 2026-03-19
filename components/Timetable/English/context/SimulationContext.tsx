/**
 * ScenarioContext - 영어 시간표 시나리오 모드 상태 관리
 *
 * PURPOSE: 시나리오 모드에서 메모리 기반 시나리오 상태를 관리하여
 * Firebase 실시간 데이터와 분리된 편집 환경을 제공합니다.
 *
 * DATA STRUCTURE:
 * - scenarioClasses: classes collection 스냅샷 (subject='english')
 * - scenarioEnrollments: enrollments 데이터 (className -> studentId -> enrollment data)
 *
 * WORKFLOW:
 * 1. 시나리오 모드 진입 시 실시간 데이터를 scenarioClasses/scenarioEnrollments에 복사
 * 2. 편집은 시나리오 상태에서만 수행
 * 3. 시나리오 저장: 시나리오 상태를 scenarios collection에 저장
 * 4. 시나리오 로드: scenarios에서 시나리오 상태로 복원
 * 5. 실제 반영: 시나리오 상태를 live classes + enrollments에 적용
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { collection, collectionGroup, query, where, getDocs, getDoc, writeBatch, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';
import { SCENARIO_COLLECTION } from '../englishUtils';
import { IntegrationSettings, CustomGroup } from '../IntegrationViewSettings';
import { convertTimestampToDate } from '../../../../utils/firestoreConverters';
import { formatDateKey } from '../../../../utils/dateUtils';

// ============ UTILITIES ============

/**
 * Firebase에 저장 전 undefined 값을 제거합니다.
 * Firebase Firestore는 undefined 값을 허용하지 않습니다.
 */
const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): T => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
};

// ============ TYPES ============

export interface ScenarioClass {
  id: string;
  className: string;
  subject: 'english';
  teacher: string;
  room?: string;
  schedule: { day: string; periodId: string; room?: string }[];
  slotTeachers?: Record<string, string>;  // "월-5" -> "Teacher"
  slotRooms?: Record<string, string>;     // "월-5" -> "Room"
  slotUnderlines?: Record<string, boolean>; // "월-5" -> true/false (슬롯별 밑줄)
  underline?: boolean;
  mainTeacher?: string;
  // ... 기타 필드
}

export interface ScenarioEnrollment {
  studentId: string;
  className: string;
  subject: 'english';
  underline?: boolean;
  enrollmentDate?: string;
  withdrawalDate?: string;
  onHold?: boolean;
  attendanceDays?: string[];
}

export interface ScenarioStudent extends TimetableStudent {
  isScenarioAdded?: boolean;  // 시나리오에서 추가된 학생
  isScenarioRemoved?: boolean; // 시나리오에서 제거된 학생
}

// ============ HISTORY TYPES ============

export interface HistoryEntry {
  id: string;
  action: string;  // 변경 내용 설명 (예: "LE1 → LE2 레벨업", "홍길동 → LE3 추가")
  timestamp: string;
  targetClass?: string;  // 바로가기 대상 수업 (없으면 바로가기 비활성화)
  scenarioClasses: Record<string, ScenarioClass>;
  scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>>;
}

const MAX_HISTORY_SIZE = 20;

// ============ VIEW SETTINGS TYPES ============

export interface ScenarioViewSettings {
  viewMode: 'START_PERIOD' | 'CUSTOM_GROUP';
  customGroups: CustomGroup[];
  showOthersGroup: boolean;
  othersGroupTitle: string;
}

const DEFAULT_SCENARIO_VIEW_SETTINGS: ScenarioViewSettings = {
  viewMode: 'CUSTOM_GROUP',
  customGroups: [],
  showOthersGroup: true,
  othersGroupTitle: '기타 수업',
};

export interface ScenarioState {
  isScenarioMode: boolean;
  scenarioClasses: Record<string, ScenarioClass>;  // classId -> ScenarioClass
  scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>>;  // className -> studentId -> enrollment
  isDirty: boolean;  // 변경 사항 있는지
  currentScenarioName: string | null;
  // History
  history: HistoryEntry[];
  historyIndex: number;  // 현재 위치 (-1이면 히스토리 없음)
  // Live state backup for redo (최신 상태 백업 - redo 끝에서 복원용)
  liveStateBackup: {
    scenarioClasses: Record<string, ScenarioClass>;
    scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>>;
  } | null;
  // View Settings (시나리오별 독립 관리)
  scenarioViewSettings: ScenarioViewSettings;
}

// ============ CONFLICT TYPES ============

export interface ConflictInfo {
  newInLive: ScenarioClass[];        // 시나리오 편집 중 실시간에 추가된 수업
  deletedInLive: ScenarioClass[];    // 시나리오 편집 중 실시간에서 삭제된 수업
  hasConflicts: boolean;
}

export type PublishMode = 'overwrite' | 'merge' | 'cancel';

export interface ScenarioContextValue extends ScenarioState {
  // Mode control
  enterScenarioMode: () => Promise<void>;
  exitScenarioMode: () => void;

  // Data access (for hooks)
  getClassStudents: (classNames: string[], studentMap: Record<string, any>) => Record<string, {
    studentList: ScenarioStudent[];
    studentIds: string[];
  }>;
  getScenarioClass: (classId: string) => ScenarioClass | undefined;
  getScenarioClassByName: (className: string) => ScenarioClass | undefined;

  // Edit operations
  updateScenarioClass: (classId: string, updates: Partial<ScenarioClass>) => void;
  updateScenarioClassWithHistory: (classId: string, updates: Partial<ScenarioClass>, actionDescription?: string) => void;
  addScenarioClass: (classData: Omit<ScenarioClass, 'id'>) => string;
  deleteScenarioClass: (classId: string) => void;
  renameScenarioClass: (oldClassName: string, newClassName: string) => boolean;
  addStudentToClass: (className: string, studentId: string, enrollmentData?: Partial<ScenarioEnrollment>, studentName?: string) => void;
  removeStudentFromClass: (className: string, studentId: string, studentName?: string) => void;
  moveStudent: (fromClass: string, toClass: string, studentId: string, studentName?: string) => void;

  // Scenario operations
  loadFromLive: () => Promise<void>;
  saveToScenario: (name: string, description: string, userId: string, userName: string) => Promise<string>;
  updateScenario: (scenarioId: string, userId: string, userName: string) => Promise<void>;
  loadFromScenario: (scenarioId: string) => Promise<void>;
  publishToLive: (userId: string, userName: string, mode?: PublishMode) => Promise<void>;
  detectConflicts: () => Promise<ConflictInfo>;

  // State
  setCurrentScenarioName: (name: string | null) => void;

  // History
  history: HistoryEntry[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  getHistoryDescription: () => string[];

  // View Settings
  scenarioViewSettings: ScenarioViewSettings;
  updateScenarioViewSettings: (settings: Partial<ScenarioViewSettings>) => void;
}

// ============ CONTEXT ============

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export const useScenario = () => {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenario must be used within ScenarioProvider');
  }
  return context;
};

// Optional hook that doesn't throw if outside provider
export const useScenarioOptional = () => {
  return useContext(ScenarioContext);
};

// Backward compatibility (deprecated)
export const useSimulation = useScenario;
export const useSimulationOptional = useScenarioOptional;

// ============ PROVIDER ============

interface ScenarioProviderProps {
  children: React.ReactNode;
}

export const ScenarioProvider: React.FC<ScenarioProviderProps> = ({ children }) => {
  const [state, setState] = useState<ScenarioState>({
    isScenarioMode: false,
    scenarioClasses: {},
    scenarioEnrollments: {},
    isDirty: false,
    currentScenarioName: null,
    history: [],
    historyIndex: -1,
    liveStateBackup: null,
    scenarioViewSettings: DEFAULT_SCENARIO_VIEW_SETTINGS,
  });

  // Ref for stable access in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // ============ HISTORY MANAGEMENT ============

  /**
   * 현재 상태를 히스토리에 저장 (변경 전에 호출)
   */
  const saveToHistory = useCallback((action: string) => {
    setState(prev => {
      const newEntry: HistoryEntry = {
        id: `history_${Date.now()}`,
        action,
        timestamp: new Date().toISOString(),
        scenarioClasses: JSON.parse(JSON.stringify(prev.scenarioClasses)),
        scenarioEnrollments: JSON.parse(JSON.stringify(prev.scenarioEnrollments)),
      };

      // 현재 위치 이후의 히스토리 삭제 (새 분기)
      const newHistory = (prev.history ?? []).slice(0, prev.historyIndex + 1);
      newHistory.push(newEntry);

      // 최대 크기 유지
      while (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
      }

      return {
        ...prev,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        liveStateBackup: null,  // 새 액션 시 이전 백업 클리어
      };
    });
  }, []);

  /**
   * Undo - 이전 상태로 복원
   */
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex < 0) return prev;

      const historyEntry = prev.history[prev.historyIndex];
      if (!historyEntry) return prev;

      // 첫 번째 undo 시 현재 live state 백업 (나중에 redo로 복원 가능하도록)
      const isFirstUndo = prev.historyIndex === prev.history.length - 1;
      const liveStateBackup = isFirstUndo
        ? {
            scenarioClasses: JSON.parse(JSON.stringify(prev.scenarioClasses)),
            scenarioEnrollments: JSON.parse(JSON.stringify(prev.scenarioEnrollments)),
          }
        : prev.liveStateBackup;

      return {
        ...prev,
        scenarioClasses: JSON.parse(JSON.stringify(historyEntry.scenarioClasses)),
        scenarioEnrollments: JSON.parse(JSON.stringify(historyEntry.scenarioEnrollments)),
        historyIndex: prev.historyIndex - 1,
        liveStateBackup,
        isDirty: true,
      };
    });
  }, []);

  /**
   * Redo - 다음 상태로 복원
   *
   * 히스토리 모델:
   * - history[i] = action i 실행 전의 상태 (즉, action i-1 실행 후의 상태)
   * - historyIndex = 현재 위치 (undo하면 history[historyIndex]로 복원됨)
   * - liveStateBackup = 마지막 action 실행 후의 상태 (undo 시 저장됨)
   *
   * Redo 시:
   * - historyIndex를 i에서 i+1로 증가
   * - 복원할 상태는 history[i+2] 또는 liveStateBackup (마지막으로 가는 경우)
   */
  const redo = useCallback(() => {
    setState(prev => {
      if (!prev.history || prev.history.length === 0) return prev;

      const targetIndex = prev.historyIndex + 1;

      // targetIndex가 history 범위를 벗어나면 redo 불가
      if (targetIndex >= prev.history.length) {
        return prev;
      }

      // 복원할 상태 결정
      let stateToRestore: { scenarioClasses: any; scenarioEnrollments: any } | null = null;

      if (targetIndex === prev.history.length - 1) {
        // 마지막 히스토리 위치로 이동 - liveStateBackup 사용
        if (!prev.liveStateBackup) return prev;
        stateToRestore = prev.liveStateBackup;
      } else {
        // 중간 위치 - history[targetIndex + 1] 사용 (다음 action 전의 상태 = 현재 action 후의 상태)
        stateToRestore = prev.history[targetIndex + 1];
      }

      if (!stateToRestore) return prev;

      return {
        ...prev,
        scenarioClasses: JSON.parse(JSON.stringify(stateToRestore.scenarioClasses)),
        scenarioEnrollments: JSON.parse(JSON.stringify(stateToRestore.scenarioEnrollments)),
        historyIndex: targetIndex,
        // 마지막으로 복원 시에만 liveStateBackup 클리어
        liveStateBackup: targetIndex === prev.history.length - 1 ? null : prev.liveStateBackup,
        isDirty: true,
      };
    });
  }, []);

  /**
   * 히스토리 설명 목록 가져오기
   */
  const getHistoryDescription = useCallback((): string[] => {
    return (stateRef.current.history ?? []).map((entry, index) => {
      const isCurrent = index === stateRef.current.historyIndex;
      const time = new Date(entry.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `${isCurrent ? '▶ ' : '  '}[${time}] ${entry.action}`;
    });
  }, []);

  // Computed values for canUndo/canRedo
  const canUndo = state.historyIndex >= 0;
  // canRedo: 다음 히스토리 항목이 있거나, 마지막 히스토리에서 liveStateBackup이 있으면 redo 가능
  const canRedo = !!state.history && (
    state.historyIndex < state.history.length - 1 ||
    (state.historyIndex === state.history.length - 1 && !!state.liveStateBackup)
  );

  // ============ MODE CONTROL ============

  const enterScenarioMode = useCallback(async () => {
    // Load current live data into draft
    await loadFromLiveInternal();

    // 현재 실시간 뷰 설정도 로드
    const viewSettingsDoc = await getDoc(doc(db, 'settings', 'english_class_integration'));
    let initialViewSettings = DEFAULT_SCENARIO_VIEW_SETTINGS;
    if (viewSettingsDoc.exists()) {
      const data = viewSettingsDoc.data();
      initialViewSettings = {
        viewMode: data.viewMode || 'CUSTOM_GROUP',
        customGroups: data.customGroups || [],
        showOthersGroup: data.showOthersGroup ?? true,
        othersGroupTitle: data.othersGroupTitle || '기타 수업',
      };
    }

    setState(prev => ({
      ...prev,
      isScenarioMode: true,
      isDirty: false,
      currentScenarioName: null,
      scenarioViewSettings: initialViewSettings,
      history: [],
      historyIndex: -1,
      liveStateBackup: null,
    }));
  }, []);

  const exitScenarioMode = useCallback(() => {
    if (stateRef.current.isDirty) {
      if (!confirm('저장하지 않은 변경 사항이 있습니다. 정말 나가시겠습니까?')) {
        return;
      }
    }
    setState({
      isScenarioMode: false,
      scenarioClasses: {},
      scenarioEnrollments: {},
      isDirty: false,
      currentScenarioName: null,
      history: [],
      historyIndex: -1,
      liveStateBackup: null,
      scenarioViewSettings: DEFAULT_SCENARIO_VIEW_SETTINGS,
    });
  }, []);

  // ============ INTERNAL LOAD FROM LIVE ============

  const loadFromLiveInternal = async () => {
    // [async-parallel] Load classes, students, and enrollments in parallel
    const [classesSnapshot, studentsSnapshot, enrollmentsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'classes'), where('subject', '==', 'english'))),
      getDocs(collection(db, 'students')),
      getDocs(query(collectionGroup(db, 'enrollments'), where('subject', '==', 'english')))
    ]);

    // 존재하는 학생 ID Set 생성 (고아 enrollment 필터링용)
    const existingStudentIds = new Set<string>();
    studentsSnapshot.docs.forEach(doc => {
      existingStudentIds.add(doc.id);
    });

    // 1. Process classes
    const scenarioClasses: Record<string, ScenarioClass> = {};
    classesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      scenarioClasses[docSnap.id] = {
        id: docSnap.id,
        className: data.className,
        subject: 'english',
        teacher: data.teacher,
        room: data.room,
        schedule: data.schedule || [],
        slotTeachers: data.slotTeachers || {},
        slotRooms: data.slotRooms || {},
        underline: data.underline,
        // mainTeacher가 없으면 teacher 필드를 사용 (호환성)
        mainTeacher: data.mainTeacher || data.teacher,
      };
    });

    // 2. Process enrollments

    const scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>> = {};
    let withdrawnCount = 0;
    let activeCount = 0;
    let orphanedCount = 0;

    enrollmentsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const className = data.className as string;
      const studentId = docSnap.ref.parent.parent?.id;

      if (!studentId || !className) return;

      // 학생이 삭제되었으면 enrollment 무시 (고아 enrollment 필터링)
      if (!existingStudentIds.has(studentId)) {
        orphanedCount++;
        return;
      }

      // 실시간 모드와 동일하게 모든 학생 포함 (퇴원생, 대기생, 반이동생 포함)

      if (data.withdrawalDate) {
        withdrawnCount++;
      } else {
        activeCount++;
      }

      if (!scenarioEnrollments[className]) {
        scenarioEnrollments[className] = {};
      }

      // withdrawalDate와 endDate 둘 다 체크 (실시간 모드와 동일)
      const withdrawalDate = convertTimestampToDate(data.withdrawalDate);
      const endDate = convertTimestampToDate(data.endDate);

      scenarioEnrollments[className][studentId] = {
        studentId,
        className,
        subject: 'english',
        underline: data.underline,
        enrollmentDate: convertTimestampToDate(data.enrollmentDate || data.startDate),
        withdrawalDate: withdrawalDate || endDate,  // endDate도 퇴원으로 처리
        onHold: data.onHold || false,  // onHold 상태 유지
        attendanceDays: data.attendanceDays || [],
      };
    });

    setState(prev => ({
      ...prev,
      scenarioClasses,
      scenarioEnrollments,
    }));

    return { scenarioClasses, scenarioEnrollments };
  };

  // ============ DATA ACCESS ============

  const getClassStudents = useCallback((
    classNames: string[],
    studentMap: Record<string, any>
  ) => {
    const { isScenarioMode, scenarioEnrollments } = stateRef.current;
    const result: Record<string, { studentList: ScenarioStudent[]; studentIds: string[] }> = {};

    if (!isScenarioMode) {
      classNames.forEach(className => {
        result[className] = { studentList: [], studentIds: [] };
      });
      return result;
    }

    const today = formatDateKey(new Date());

    // 1단계: 반이동 감지를 위해 모든 학생의 활성/종료 수업 목록 수집
    const studentActiveClasses: Record<string, Set<string>> = {};  // studentId -> Set of active classNames
    const studentEndedClasses: Record<string, Set<string>> = {};   // studentId -> Set of ended classNames

    Object.entries(scenarioEnrollments).forEach(([className, enrollments]) => {
      Object.entries(enrollments).forEach(([studentId, enrollment]) => {
        const hasEndDate = !!(enrollment.withdrawalDate);

        if (!hasEndDate) {
          // 활성 등록
          if (!studentActiveClasses[studentId]) {
            studentActiveClasses[studentId] = new Set();
          }
          studentActiveClasses[studentId].add(className);
        } else {
          // 종료된 등록
          if (!studentEndedClasses[studentId]) {
            studentEndedClasses[studentId] = new Set();
          }
          studentEndedClasses[studentId].add(className);
        }
      });
    });

    // 2단계: 요청된 수업들에 대해 학생 목록 생성
    classNames.forEach(className => {
      const enrollments = scenarioEnrollments[className] || {};
      const studentIds = Object.keys(enrollments);

      const studentList: ScenarioStudent[] = studentIds
        .map(id => {
          const baseStudent = studentMap[id];
          const enrollment = enrollments[id];

          // 실시간 모드와 동일한 필터링 로직 적용
          if (!baseStudent) {
            return null;
          }

          // Skip if student is not active
          if (baseStudent.status !== 'active') {
            return null;
          }

          // Priority for enrollment date (useClassStudents와 동일한 로직):
          const studentEnrollmentDate = enrollment?.enrollmentDate || baseStudent?.startDate;

          // 미래 시작일 학생 (배정 예정)
          const isScheduled = studentEnrollmentDate && studentEnrollmentDate > today;

          // 반이동 감지
          const hasEndDate = !!(enrollment?.withdrawalDate);
          const activeClasses = studentActiveClasses[id] || new Set();
          const endedClasses = studentEndedClasses[id] || new Set();

          // isTransferred: 이 수업에서 종료됐지만 다른 수업에 활성 등록이 있음 (퇴원 아님)
          const isTransferred = hasEndDate &&
            Array.from(activeClasses).some(c => c !== className);

          // isTransferredIn: 이 수업에 활성 등록이 있고, 다른 수업에서 종료된 기록이 있음 (반이동 온 학생)
          const isTransferredIn = !hasEndDate &&
            Array.from(endedClasses).some(c => c !== className);

          return {
            id,
            name: baseStudent.name || '',
            englishName: baseStudent.englishName || '',
            school: baseStudent.school || '',
            grade: baseStudent.grade || '',
            underline: enrollment?.underline ?? baseStudent.underline ?? false,
            enrollmentDate: studentEnrollmentDate,
            withdrawalDate: enrollment?.withdrawalDate,
            onHold: enrollment?.onHold,
            isMoved: false,
            attendanceDays: enrollment?.attendanceDays || [],
            isScheduled,
            isTransferred,
            isTransferredIn,
            isScenarioAdded: false,
          } as ScenarioStudent;
        })
        .filter(Boolean) as ScenarioStudent[];

      studentList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

      result[className] = { studentList, studentIds };
    });

    return result;
  }, []);

  const getScenarioClass = useCallback((classId: string) => {
    return stateRef.current.scenarioClasses[classId];
  }, []);

  const getScenarioClassByName = useCallback((className: string) => {
    return Object.values(stateRef.current.scenarioClasses).find(c => c.className === className);
  }, []);

  // ============ EDIT OPERATIONS ============

  const updateScenarioClass = useCallback((classId: string, updates: Partial<ScenarioClass>) => {
    setState(prev => ({
      ...prev,
      scenarioClasses: {
        ...prev.scenarioClasses,
        [classId]: {
          ...prev.scenarioClasses[classId],
          ...updates,
        },
      },
      isDirty: true,
    }));
  }, []);

  // 히스토리 엔트리 생성 헬퍼
  const createHistoryEntry = (prev: ScenarioState, action: string, targetClass?: string): HistoryEntry => ({
    id: `history_${Date.now()}`,
    action,
    timestamp: new Date().toISOString(),
    targetClass,  // 바로가기 대상 수업
    scenarioClasses: JSON.parse(JSON.stringify(prev.scenarioClasses)),
    scenarioEnrollments: JSON.parse(JSON.stringify(prev.scenarioEnrollments)),
  });

  // 히스토리 업데이트 헬퍼
  const updateHistoryInState = (prev: ScenarioState, newEntry: HistoryEntry) => {
    const newHistory = (prev.history ?? []).slice(0, prev.historyIndex + 1);
    newHistory.push(newEntry);
    while (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }
    return {
      history: newHistory,
      historyIndex: newHistory.length - 1,
    };
  };

  // 수업 정보 업데이트 (히스토리 포함) - 스케줄 변경 등
  const updateScenarioClassWithHistory = useCallback((
    classId: string,
    updates: Partial<ScenarioClass>,
    actionDescription?: string
  ) => {
    setState(prev => {
      const existingClass = prev.scenarioClasses[classId];
      if (!existingClass) return prev;

      const action = actionDescription || `${existingClass.className} 수업 정보 변경`;
      const historyEntry = createHistoryEntry(prev, action, existingClass.className);
      const historyUpdate = updateHistoryInState(prev, historyEntry);

      return {
        ...prev,
        ...historyUpdate,
        scenarioClasses: {
          ...prev.scenarioClasses,
          [classId]: {
            ...existingClass,
            ...updates,
          },
        },
        isDirty: true,
      };
    });
  }, []);

  // 새 수업 추가 (히스토리 포함)
  const addScenarioClass = useCallback((classData: Omit<ScenarioClass, 'id'>): string => {
    const newClassId = `scenario_class_${Date.now()}`;

    setState(prev => {
      // 같은 이름의 수업이 있는지 확인
      const existingClass = Object.values(prev.scenarioClasses).find(
        c => c.className === classData.className
      );
      if (existingClass) {
        alert(`⚠️ '${classData.className}' 수업이 이미 존재합니다.`);
        return prev;
      }

      const historyEntry = createHistoryEntry(prev, `${classData.className} 수업 추가`, classData.className);
      const historyUpdate = updateHistoryInState(prev, historyEntry);

      const newClass: ScenarioClass = {
        ...classData,
        id: newClassId,
      };

      return {
        ...prev,
        ...historyUpdate,
        scenarioClasses: {
          ...prev.scenarioClasses,
          [newClassId]: newClass,
        },
        isDirty: true,
      };
    });

    return newClassId;
  }, []);

  // 수업 삭제 (히스토리 포함)
  const deleteScenarioClass = useCallback((classId: string) => {
    setState(prev => {
      const classToDelete = prev.scenarioClasses[classId];
      if (!classToDelete) return prev;

      const historyEntry = createHistoryEntry(prev, `${classToDelete.className} 수업 삭제`, classToDelete.className);
      const historyUpdate = updateHistoryInState(prev, historyEntry);

      // 수업 삭제
      const updatedClasses = { ...prev.scenarioClasses };
      delete updatedClasses[classId];

      // 해당 수업의 enrollment도 삭제
      const updatedEnrollments = { ...prev.scenarioEnrollments };
      delete updatedEnrollments[classToDelete.className];

      return {
        ...prev,
        ...historyUpdate,
        scenarioClasses: updatedClasses,
        scenarioEnrollments: updatedEnrollments,
        isDirty: true,
      };
    });
  }, []);

  const renameScenarioClass = useCallback((oldClassName: string, newClassName: string): boolean => {
    let success = false;

    setState(prev => {
      // 0. 충돌 검사: 새 이름의 수업이 이미 존재하는지 확인
      const existingClass = Object.values(prev.scenarioClasses).find(c => c.className === newClassName);
      if (existingClass) {
        // 이미 같은 이름의 수업이 있으면 충돌 - 변경하지 않음
        alert(`⚠️ '${newClassName}' 수업이 이미 존재합니다.\n\n기존 수업과 이름이 충돌하여 레벨 변경을 할 수 없습니다.\n먼저 기존 '${newClassName}' 수업을 다른 이름으로 변경하거나 레벨업 해주세요.`);
        return prev;
      }

      success = true;

      // 히스토리 저장 (바로가기 대상: 새 수업명)
      const historyEntry = createHistoryEntry(prev, `${oldClassName} → ${newClassName} 레벨 변경`, newClassName);
      const historyUpdate = updateHistoryInState(prev, historyEntry);

      // 1. Find the class by old name and update className
      const updatedClasses = { ...prev.scenarioClasses };
      const classEntry = Object.entries(updatedClasses).find(([, c]) => c.className === oldClassName);
      if (classEntry) {
        const [classId, classData] = classEntry;
        updatedClasses[classId] = { ...classData, className: newClassName };
      }

      // 2. Move enrollments from old className key to new className key
      const updatedEnrollments = { ...prev.scenarioEnrollments };
      const oldEnrollments = updatedEnrollments[oldClassName];
      if (oldEnrollments) {
        // Update each enrollment's className field
        const renamedEnrollments: Record<string, ScenarioEnrollment> = {};
        Object.entries(oldEnrollments).forEach(([studentId, enrollment]) => {
          renamedEnrollments[studentId] = { ...enrollment, className: newClassName };
        });
        updatedEnrollments[newClassName] = renamedEnrollments;
        delete updatedEnrollments[oldClassName];
      }

      return {
        ...prev,
        ...historyUpdate,
        scenarioClasses: updatedClasses,
        scenarioEnrollments: updatedEnrollments,
        isDirty: true,
      };
    });

    return success;
  }, []);

  const addStudentToClass = useCallback((
    className: string,
    studentId: string,
    enrollmentData?: Partial<ScenarioEnrollment>,
    studentName?: string  // 히스토리 설명용 (선택)
  ) => {
    setState(prev => {
      // 히스토리 저장 (바로가기 대상: 추가된 수업)
      const historyEntry = createHistoryEntry(prev, `${studentName || studentId} → ${className} 추가`, className);
      const historyUpdate = updateHistoryInState(prev, historyEntry);

      const classEnrollments = prev.scenarioEnrollments[className] || {};

      return {
        ...prev,
        ...historyUpdate,
        scenarioEnrollments: {
          ...prev.scenarioEnrollments,
          [className]: {
            ...classEnrollments,
            [studentId]: {
              studentId,
              className,
              subject: 'english',
              ...enrollmentData,
            },
          },
        },
        isDirty: true,
      };
    });
  }, []);

  const removeStudentFromClass = useCallback((className: string, studentId: string, studentName?: string) => {
    setState(prev => {
      // 히스토리 저장 (바로가기 대상: 제거된 수업)
      const historyEntry = createHistoryEntry(prev, `${studentName || studentId} ← ${className} 제거`, className);
      const historyUpdate = updateHistoryInState(prev, historyEntry);

      const classEnrollments = { ...prev.scenarioEnrollments[className] };
      delete classEnrollments[studentId];

      return {
        ...prev,
        ...historyUpdate,
        scenarioEnrollments: {
          ...prev.scenarioEnrollments,
          [className]: classEnrollments,
        },
        isDirty: true,
      };
    });
  }, []);

  const moveStudent = useCallback((fromClass: string, toClass: string, studentId: string, studentName?: string) => {
    setState(prev => {
      const fromEnrollments = { ...prev.scenarioEnrollments[fromClass] };
      const toEnrollments = prev.scenarioEnrollments[toClass] || {};

      const enrollment = fromEnrollments[studentId];
      if (!enrollment) return prev;

      // 히스토리 저장 (바로가기 대상: 이동 후 수업)
      const historyEntry = createHistoryEntry(prev, `${studentName || studentId}: ${fromClass} → ${toClass} 이동`, toClass);
      const historyUpdate = updateHistoryInState(prev, historyEntry);

      delete fromEnrollments[studentId];

      return {
        ...prev,
        ...historyUpdate,
        scenarioEnrollments: {
          ...prev.scenarioEnrollments,
          [fromClass]: fromEnrollments,
          [toClass]: {
            ...toEnrollments,
            [studentId]: {
              ...enrollment,
              className: toClass,
            },
          },
        },
        isDirty: true,
      };
    });
  }, []);

  // ============ SCENARIO OPERATIONS ============

  const loadFromLive = useCallback(async () => {
    if (stateRef.current.isDirty) {
      if (!confirm('현재 변경 사항이 사라집니다. 계속하시겠습니까?')) {
        return;
      }
    }
    await loadFromLiveInternal();
    setState(prev => ({
      ...prev,
      isDirty: false,
      currentScenarioName: null,
    }));
  }, []);

  const saveToScenario = useCallback(async (
    name: string,
    description: string,
    userId: string,
    userName: string
  ): Promise<string> => {
    const { scenarioClasses, scenarioEnrollments, scenarioViewSettings } = stateRef.current;

    const scenarioId = `scenario_${Date.now()}`;

    // Calculate stats
    const classCount = Object.keys(scenarioClasses).length;
    const studentCount = Object.values(scenarioEnrollments)
      .reduce((acc, enrollments) => acc + Object.keys(enrollments).length, 0);

    // 재원생만 필터링 (퇴원생과 대기생 제외)
    const activeEnrollmentsOnly: Record<string, Record<string, ScenarioEnrollment>> = {};
    let filteredOutCount = 0;
    let activeOnlyCount = 0;

    Object.entries(scenarioEnrollments).forEach(([className, classEnrollments]) => {
      activeEnrollmentsOnly[className] = {};
      Object.entries(classEnrollments).forEach(([studentId, enrollment]) => {
        // 퇴원생(withdrawalDate 있음) 또는 대기생(onHold) 제외
        if (enrollment.withdrawalDate || enrollment.onHold) {
          filteredOutCount++;
          return;
        }
        activeEnrollmentsOnly[className][studentId] = enrollment;
        activeOnlyCount++;
      });
      // 빈 반은 제거
      if (Object.keys(activeEnrollmentsOnly[className]).length === 0) {
        delete activeEnrollmentsOnly[className];
      }
    });

    // Firebase에 저장 전 undefined 값 제거
    const sanitizedClasses = sanitizeForFirestore(scenarioClasses);
    const sanitizedEnrollments = sanitizeForFirestore(activeEnrollmentsOnly);  // 필터링된 데이터 사용
    const sanitizedViewSettings = sanitizeForFirestore(scenarioViewSettings);

    const scenarioData = {
      id: scenarioId,
      name,
      description,
      // 새 구조 데이터 (sanitized)
      classes: sanitizedClasses,
      enrollments: sanitizedEnrollments,
      // 뷰 설정 (시나리오별 독립 관리)
      viewSettings: sanitizedViewSettings,
      // 메타데이터
      createdAt: new Date().toISOString(),
      createdBy: userName,
      createdByUid: userId,
      stats: {
        classCount,
        studentCount: activeOnlyCount,  // 재원생만 카운트
        timetableDocCount: classCount,  // 호환성
      },
      version: 3,  // 뷰 설정 포함 버전
    };

    await setDoc(doc(db, SCENARIO_COLLECTION, scenarioId), scenarioData);

    setState(prev => ({
      ...prev,
      isDirty: false,
      currentScenarioName: name,
    }));

    return scenarioId;
  }, []);

  const updateScenario = useCallback(async (
    scenarioId: string,
    userId: string,
    userName: string
  ): Promise<void> => {
    const { scenarioClasses, scenarioEnrollments, scenarioViewSettings } = stateRef.current;

    // 기존 시나리오 정보 가져오기
    const existingDoc = await getDoc(doc(db, SCENARIO_COLLECTION, scenarioId));
    if (!existingDoc.exists()) {
      throw new Error('시나리오를 찾을 수 없습니다.');
    }

    const existingData = existingDoc.data();

    // Calculate stats
    const classCount = Object.keys(scenarioClasses).length;
    const studentCount = Object.values(scenarioEnrollments)
      .reduce((acc, enrollments) => acc + Object.keys(enrollments).length, 0);

    // Firebase에 저장 전 undefined 값 제거
    const sanitizedClasses = sanitizeForFirestore(scenarioClasses);
    const sanitizedEnrollments = sanitizeForFirestore(scenarioEnrollments);
    const sanitizedViewSettings = sanitizeForFirestore(scenarioViewSettings);

    // 기존 시나리오 업데이트
    await setDoc(doc(db, SCENARIO_COLLECTION, scenarioId), {
      ...existingData,
      // 새 구조 데이터 (sanitized)
      classes: sanitizedClasses,
      enrollments: sanitizedEnrollments,
      // 뷰 설정 (시나리오별 독립 관리)
      viewSettings: sanitizedViewSettings,
      // 업데이트 정보
      updatedAt: new Date().toISOString(),
      updatedBy: userName,
      updatedByUid: userId,
      stats: {
        classCount,
        studentCount,
        timetableDocCount: classCount,
      },
      version: 3,
    });

    setState(prev => ({
      ...prev,
      isDirty: false,
      currentScenarioName: existingData.name,
    }));
  }, []);

  const loadFromScenario = useCallback(async (scenarioId: string) => {
    // [async-parallel] Direct document read instead of scanning collection
    const [docSnap, liveClassesSnapshot] = await Promise.all([
      getDoc(doc(db, SCENARIO_COLLECTION, scenarioId)),
      getDocs(query(collection(db, 'classes'), where('subject', '==', 'english')))
    ]);

    if (!docSnap.exists()) {
      throw new Error('시나리오를 찾을 수 없습니다.');
    }

    const scenario = docSnap.data();

    // 버전 체크 (version 2 또는 3)
    if (scenario.version >= 2) {
      const scenarioClasses = scenario.classes || {};
      const scenarioEnrollments = scenario.enrollments || {};

      // 로드된 시나리오의 퇴원생 체크
      let withdrawnInLoaded = 0;
      let totalInLoaded = 0;
      Object.values(scenarioEnrollments).forEach((classEnrollments: any) => {
        Object.values(classEnrollments).forEach((enrollment: any) => {
          totalInLoaded++;
          if (enrollment.withdrawalDate) withdrawnInLoaded++;
        });
      });

      // 실시간 데이터에서 삭제된 수업 감지
      const liveClassIds = new Set<string>();
      liveClassesSnapshot.docs.forEach(docSnap => {
        liveClassIds.add(docSnap.id);
      });

      const deletedInLive: ScenarioClass[] = [];
      Object.keys(scenarioClasses).forEach(classId => {
        if (!liveClassIds.has(classId)) {
          deletedInLive.push(scenarioClasses[classId]);
        }
      });

      // 삭제된 수업이 있으면 사용자에게 처리 방법 확인
      let finalClasses = scenarioClasses;
      let finalEnrollments = scenarioEnrollments;

      if (deletedInLive.length > 0) {
        let message = `⚠️ 시나리오에 포함된 수업 중 ${deletedInLive.length}개가 실시간 데이터에서 삭제되었습니다.\n\n`;
        message += '삭제된 수업:\n';
        deletedInLive.forEach(cls => {
          message += `   - ${cls.className}\n`;
        });
        message += '\n시나리오에서도 이 수업들을 제거하시겠습니까?\n\n';
        message += '[제거] - 삭제된 수업을 시나리오에서 제거\n';
        message += '[유지] - 삭제된 수업을 시나리오에 유지 (반영 시 복원됨)';

        const choice = prompt(message + '\n\n선택을 입력하세요 (제거/유지):');

        if (choice === '제거') {
          // 삭제된 수업을 시나리오에서 제거
          finalClasses = { ...scenarioClasses };
          finalEnrollments = { ...scenarioEnrollments };

          deletedInLive.forEach(cls => {
            delete finalClasses[cls.id];
            delete finalEnrollments[cls.className];
          });

        }
      }

      // 새 구조 (v2: 기본, v3: 뷰설정 포함)
      setState(prev => ({
        ...prev,
        scenarioClasses: finalClasses,
        scenarioEnrollments: finalEnrollments,
        // 뷰 설정: 저장된 설정이 있으면 사용, 없으면 기본값 유지
        scenarioViewSettings: scenario.viewSettings || prev.scenarioViewSettings,
        isDirty: deletedInLive.length > 0,  // 삭제 처리했으면 dirty로 표시
        currentScenarioName: scenario.name,
        // 히스토리 초기화 (새 시나리오 로드)
        history: [],
        historyIndex: -1,
        liveStateBackup: null,
      }));
    } else {
      // 레거시 구조 - 변환 필요
      // TODO: 레거시 시나리오 마이그레이션 로직
      throw new Error('레거시 시나리오는 아직 지원되지 않습니다. 새로운 시나리오를 생성해주세요.');
    }
  }, []);

  /**
   * 충돌 감지: 시나리오 편집 중 실시간 데이터 변경 확인
   */
  const detectConflicts = useCallback(async (): Promise<ConflictInfo> => {
    const { scenarioClasses } = stateRef.current;
    const scenarioClassIds = new Set(Object.keys(scenarioClasses));

    // 현재 실시간 데이터 가져오기
    const liveClassesSnapshot = await getDocs(
      query(collection(db, 'classes'), where('subject', '==', 'english'))
    );

    const liveClassIds = new Set<string>();
    const liveClassesMap: Record<string, ScenarioClass> = {};

    liveClassesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      liveClassIds.add(docSnap.id);
      liveClassesMap[docSnap.id] = {
        id: docSnap.id,
        className: data.className,
        subject: 'english',
        teacher: data.teacher,
        room: data.room,
        schedule: data.schedule || [],
        slotTeachers: data.slotTeachers || {},
        slotRooms: data.slotRooms || {},
        underline: data.underline,
        mainTeacher: data.mainTeacher,
      };
    });

    // 1. 실시간에 새로 추가된 수업 (시나리오에 없는 수업)
    const newInLive: ScenarioClass[] = [];
    liveClassIds.forEach(classId => {
      if (!scenarioClassIds.has(classId)) {
        newInLive.push(liveClassesMap[classId]);
      }
    });

    // 2. 실시간에서 삭제된 수업 (시나리오에만 있는 수업)
    const deletedInLive: ScenarioClass[] = [];
    scenarioClassIds.forEach(classId => {
      if (!liveClassIds.has(classId)) {
        deletedInLive.push(scenarioClasses[classId]);
      }
    });

    return {
      newInLive,
      deletedInLive,
      hasConflicts: newInLive.length > 0 || deletedInLive.length > 0,
    };
  }, []);

  const publishToLive = useCallback(async (userId: string, userName: string, mode?: PublishMode) => {
    const { scenarioClasses, scenarioEnrollments, currentScenarioName } = stateRef.current;

    // 모드가 지정되지 않은 경우 충돌 감지 수행
    if (!mode) {
      const conflicts = await detectConflicts();

      if (conflicts.hasConflicts) {
        // 충돌 정보 메시지 생성
        let conflictMessage = '⚠️ 시나리오 편집 중 실시간 데이터가 변경되었습니다.\n\n';

        if (conflicts.newInLive.length > 0) {
          conflictMessage += `📌 새로 추가된 수업 (${conflicts.newInLive.length}개):\n`;
          conflicts.newInLive.forEach(cls => {
            conflictMessage += `   - ${cls.className}\n`;
          });
          conflictMessage += '\n';
        }

        if (conflicts.deletedInLive.length > 0) {
          conflictMessage += `🗑️ 삭제된 수업 (${conflicts.deletedInLive.length}개):\n`;
          conflicts.deletedInLive.forEach(cls => {
            conflictMessage += `   - ${cls.className}\n`;
          });
          conflictMessage += '\n';
        }

        conflictMessage += '어떻게 처리하시겠습니까?\n\n';
        conflictMessage += '[덮어쓰기] - 시나리오 데이터로 모두 대체 (새 수업 삭제, 삭제된 수업 복원)\n';
        conflictMessage += '[병합] - 새 수업 유지, 삭제된 수업은 반영 안 함\n';
        conflictMessage += '[취소] - 반영 취소';

        // 사용자 선택
        const choice = prompt(conflictMessage + '\n\n선택을 입력하세요 (덮어쓰기/병합/취소):');

        if (!choice || choice === '취소') {
          return;
        } else if (choice === '덮어쓰기') {
          mode = 'overwrite';
        } else if (choice === '병합') {
          mode = 'merge';
        } else {
          alert('올바른 선택이 아닙니다. 반영을 취소합니다.');
          return;
        }
      } else {
        // 충돌 없음 - 기본 확인
        if (!confirm('⚠️ 정말로 실제 시간표에 반영하시겠습니까?\n이 작업은 모든 사용자에게 즉시 반영됩니다.')) {
          return;
        }
        mode = 'overwrite';
      }
    }

    let backupId = '';

    try {
      // 1. 백업 생성 (현재 실시간 데이터)
      backupId = `backup_${Date.now()}`;
      const { scenarioClasses: liveClasses, scenarioEnrollments: liveEnrollments } = await loadFromLiveInternal();

      await setDoc(doc(db, SCENARIO_COLLECTION, backupId), {
        id: backupId,
        name: `백업_${new Date().toLocaleString()}`,
        description: '[자동백업] 실제 반영 전 자동 생성',
        classes: sanitizeForFirestore(liveClasses),
        enrollments: sanitizeForFirestore(liveEnrollments),
        createdAt: new Date().toISOString(),
        createdBy: `${userName} (자동)`,
        createdByUid: userId,
        version: 2,
      });

      // 2. classes 업데이트 결정
      const liveClassIds = new Set(Object.keys(liveClasses));
      const scenarioClassIds = new Set(Object.keys(scenarioClasses));

      // 최종 반영할 classes 결정
      const classesToPublish = { ...scenarioClasses };
      const enrollmentsToPublish = { ...scenarioEnrollments };

      if (mode === 'merge') {
        // 병합 모드: 새로 추가된 수업 유지
        liveClassIds.forEach(classId => {
          if (!scenarioClassIds.has(classId)) {
            // 실시간에만 있는 수업 -> 유지
            classesToPublish[classId] = liveClasses[classId];
          }
        });

        // 새 수업의 enrollments도 유지
        Object.entries(liveEnrollments).forEach(([className, enrollments]) => {
          // 시나리오에 없는 className의 enrollments 유지
          const classInScenario = Object.values(scenarioClasses).find(c => c.className === className);
          if (!classInScenario) {
            enrollmentsToPublish[className] = enrollments;
          }
        });

        // 삭제된 수업은 반영하지 않음 (시나리오에서만 있던 수업 제거)
        scenarioClassIds.forEach(classId => {
          if (!liveClassIds.has(classId)) {
            delete classesToPublish[classId];
            const className = scenarioClasses[classId].className;
            delete enrollmentsToPublish[className];
          }
        });

      } else {
        // 덮어쓰기 모드: 시나리오 데이터로 모두 대체
        // 실시간에만 있는 수업 삭제
        const classesToDelete: string[] = [];
        liveClassIds.forEach(classId => {
          if (!scenarioClassIds.has(classId)) {
            classesToDelete.push(classId);
          }
        });

        if (classesToDelete.length > 0) {
          const deleteBatch = writeBatch(db);
          classesToDelete.forEach(classId => {
            deleteBatch.delete(doc(db, 'classes', classId));
          });
          await deleteBatch.commit();
        }
      }

      // 3. classes 업데이트 (sanitized, merge: true로 기존 필드 보존)
      // ScenarioClass에 없는 필드(isActive, createdAt, updatedAt, mainTeacher 등)를 유지
      const classBatch = writeBatch(db);
      Object.entries(classesToPublish).forEach(([classId, classData]) => {
        classBatch.set(doc(db, 'classes', classId), sanitizeForFirestore({
          ...classData,
          updatedAt: new Date().toISOString(),
        }), { merge: true });
      });
      await classBatch.commit();

      // 4. enrollments 업데이트 (이동 이력 추적 방식)
      // 기존: 전체 삭제 후 재생성 → 개선: 변경된 부분만 업데이트하고 이력 유지
      const existingEnrollmentsSnapshot = await getDocs(
        query(collectionGroup(db, 'enrollments'), where('subject', '==', 'english'))
      );

      const today = formatDateKey(new Date()); // YYYY-MM-DD

      // 반 이름 변경 감지: 같은 classId인데 className이 바뀐 경우 (레벨업 등)
      // oldClassName → newClassName 매핑
      const renamedClasses: Record<string, string> = {};
      Object.entries(liveClasses).forEach(([classId, liveClass]) => {
        const scenarioClass = classesToPublish[classId];
        if (scenarioClass && liveClass.className !== scenarioClass.className) {
          renamedClasses[liveClass.className] = scenarioClass.className;
        }
      });

      // 현재 실시간 enrollments 맵 구축: studentId -> { className, docRef, data }
      const liveStudentEnrollments: Record<string, { className: string; docRef: any; data: any }> = {};
      existingEnrollmentsSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        // endDate가 없는 (현재 수강중인) enrollment만 처리
        if (!data.endDate) {
          const studentId = docSnap.ref.parent.parent?.id;
          if (studentId) {
            liveStudentEnrollments[studentId] = {
              className: data.className,
              docRef: docSnap.ref,
              data,
            };
          }
        }
      });

      // className → classId 매핑 (classesToPublish의 key가 classId)
      const classNameToIdMap: Record<string, string> = {};
      Object.entries(classesToPublish).forEach(([classId, classData]) => {
        if (classData.className) {
          classNameToIdMap[classData.className] = classId;
        }
      });

      // 시나리오 enrollments 맵 구축: studentId -> className
      const scenarioStudentEnrollments: Record<string, string> = {};
      Object.entries(enrollmentsToPublish).forEach(([className, students]) => {
        Object.keys(students).forEach(studentId => {
          scenarioStudentEnrollments[studentId] = className;
        });
      });

      // 변경 사항 분류
      const toEndDate: { docRef: any }[] = [];  // 이전 수업 종료 처리
      const toCreate: { ref: any; data: any }[] = [];  // 새 수업 생성
      const toRename: { docRef: any; studentId: string; oldClassName: string; newClassName: string; data: any }[] = [];  // 반 이름 변경 (이동 아님)
      const unchanged: string[] = [];  // 변경 없음

      // 1. 기존 학생들 처리
      Object.entries(liveStudentEnrollments).forEach(([studentId, liveInfo]) => {
        const newClassName = scenarioStudentEnrollments[studentId];

        if (!newClassName) {
          // 학생이 시나리오에서 제거됨 → 이전 수업 종료
          toEndDate.push({ docRef: liveInfo.docRef });
        } else if (newClassName !== liveInfo.className) {
          // className이 다른 경우: 반 이름 변경인지 실제 이동인지 구분
          if (renamedClasses[liveInfo.className] === newClassName) {
            // 반 이름 변경 (레벨업 등) → 기존 enrollment 삭제 + 새 doc 생성 (startDate 유지)
            toRename.push({
              docRef: liveInfo.docRef,
              studentId,
              oldClassName: liveInfo.className,
              newClassName,
              data: liveInfo.data,
            });
          } else {
            // 실제 반이동 → 이전 수업 종료 + 새 수업 생성
            toEndDate.push({ docRef: liveInfo.docRef });
            const newEnrollment = enrollmentsToPublish[newClassName]?.[studentId];
            if (newEnrollment) {
              const newClassId = classNameToIdMap[newClassName] || newClassName;
              toCreate.push({
                ref: doc(db, 'students', studentId, 'enrollments', newClassId),
                data: sanitizeForFirestore({
                  ...newEnrollment,
                  classId: newClassId,
                  subject: 'english',
                  className: newClassName,
                  startDate: today,
                }),
              });
            }
          }
        } else {
          // 같은 수업 유지 → 변경 없음
          unchanged.push(studentId);
        }
      });

      // 2. 새로 추가된 학생들 처리
      Object.entries(scenarioStudentEnrollments).forEach(([studentId, className]) => {
        if (!liveStudentEnrollments[studentId]) {
          const newEnrollment = enrollmentsToPublish[className]?.[studentId];
          if (newEnrollment) {
            const newClassId = classNameToIdMap[className] || className;
            toCreate.push({
              ref: doc(db, 'students', studentId, 'enrollments', newClassId),
              data: sanitizeForFirestore({
                ...newEnrollment,
                classId: newClassId,
                subject: 'english',
                className,
                startDate: today,
              }),
            });
          }
        }
      });

      // 반 이름 변경 배치 (기존 doc 삭제 + 새 doc 생성, startDate 유지)
      for (let i = 0; i < toRename.length; i += 250) {
        const batch = writeBatch(db);
        const chunk = toRename.slice(i, i + 250);
        chunk.forEach(item => {
          // 기존 enrollment 삭제 (endDate 설정 안 함 → 반이동 흔적 안 남김)
          batch.delete(item.docRef);
          // 새 className으로 enrollment 생성 (doc ID = classId, 기존 startDate 유지)
          const newClassId = classNameToIdMap[item.newClassName] || `english_${item.newClassName}`;
          const newRef = doc(db, 'students', item.studentId, 'enrollments', newClassId);
          const newData = { ...item.data };
          newData.classId = newClassId;
          newData.className = item.newClassName;
          delete newData.endDate;
          delete newData.withdrawalDate;
          batch.set(newRef, sanitizeForFirestore(newData));
        });
        await batch.commit();
      }

      // 종료 처리 배치 (endDate 설정)
      for (let i = 0; i < toEndDate.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = toEndDate.slice(i, i + 500);
        chunk.forEach(item => {
          batch.update(item.docRef, {
            endDate: today,
            withdrawalDate: today,  // 통합뷰 호환
          });
        });
        await batch.commit();
      }

      // 생성 배치
      for (let i = 0; i < toCreate.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = toCreate.slice(i, i + 500);
        chunk.forEach(item => {
          batch.set(item.ref, item.data);
        });
        await batch.commit();
      }

      // 5. 시나리오 이름을 english_config에 저장 (영구 저장)
      if (currentScenarioName) {
        await setDoc(doc(db, 'settings', 'english_config'), {
          publishedScenarioName: currentScenarioName,
          publishedAt: new Date().toISOString(),
          publishedBy: userName,
          publishedByUid: userId,
        }, { merge: true });
      }

      setState(prev => ({
        ...prev,
        isDirty: false,
      }));

      const modeLabel = mode === 'merge' ? '병합' : '덮어쓰기';
      alert(`✅ 성공적으로 반영되었습니다. (${modeLabel} 모드)\n(백업 ID: ${backupId})`);
    } catch (error) {
      console.error('publishToLive 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`❌ 실제 반영 중 오류가 발생했습니다.\n${errorMessage}\n\n${backupId ? `백업이 생성되었습니다: ${backupId}` : ''}`);
      throw error;
    }
  }, [detectConflicts]);

  const setCurrentScenarioName = useCallback((name: string | null) => {
    setState(prev => ({
      ...prev,
      currentScenarioName: name,
    }));
  }, []);

  // ============ VIEW SETTINGS ============

  const updateScenarioViewSettings = useCallback((updates: Partial<ScenarioViewSettings>) => {
    setState(prev => ({
      ...prev,
      scenarioViewSettings: {
        ...prev.scenarioViewSettings,
        ...updates,
      },
      isDirty: true,
    }));
  }, []);

  // ============ CONTEXT VALUE ============

  const value = useMemo<ScenarioContextValue>(() => ({
    ...state,
    enterScenarioMode,
    exitScenarioMode,
    getClassStudents,
    getScenarioClass,
    getScenarioClassByName,
    updateScenarioClass,
    updateScenarioClassWithHistory,
    addScenarioClass,
    deleteScenarioClass,
    renameScenarioClass,
    addStudentToClass,
    removeStudentFromClass,
    moveStudent,
    loadFromLive,
    saveToScenario,
    updateScenario,
    loadFromScenario,
    publishToLive,
    detectConflicts,
    setCurrentScenarioName,
    // History
    canUndo,
    canRedo,
    undo,
    redo,
    getHistoryDescription,
    // View Settings
    updateScenarioViewSettings,
  }), [
    state,
    enterScenarioMode,
    exitScenarioMode,
    getClassStudents,
    getScenarioClass,
    getScenarioClassByName,
    updateScenarioClass,
    updateScenarioClassWithHistory,
    addScenarioClass,
    deleteScenarioClass,
    renameScenarioClass,
    addStudentToClass,
    removeStudentFromClass,
    moveStudent,
    loadFromLive,
    saveToScenario,
    updateScenario,
    loadFromScenario,
    publishToLive,
    detectConflicts,
    setCurrentScenarioName,
    canUndo,
    canRedo,
    undo,
    redo,
    getHistoryDescription,
  ]);

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
};

// Backward compatibility
export const SimulationProvider = ScenarioProvider;

export default ScenarioContext;
