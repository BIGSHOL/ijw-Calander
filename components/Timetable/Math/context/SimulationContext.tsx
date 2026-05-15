/**
 * MathSimulationContext - 수학 시간표 시나리오 모드 상태 관리
 *
 * PURPOSE: 시나리오 모드에서 메모리 기반 시나리오 상태를 관리하여
 * Firebase 실시간 데이터와 분리된 편집 환경을 제공합니다.
 *
 * DATA STRUCTURE:
 * - scenarioClasses: classes collection 스냅샷 (subject='math')
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
import { collection, collectionGroup, query, where, getDocs, getDoc, writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';
import { convertTimestampToDate } from '../../../../utils/firestoreConverters';

const SCENARIO_COLLECTION = 'math_scenarios';

// ============ UTILITIES ============

/**
 * Firebase에 저장 전 undefined 값을 제거합니다.
 * Firebase Firestore는 undefined 값을 허용하지 않습니다.
 * Timestamp/Date 등 특수 객체는 평탄화하지 않고 그대로 보존합니다.
 */
const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): T => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      // Timestamp(toDate), Date(getTime) 등 특수 객체는 그대로 보존
      typeof (value as any).toDate !== 'function' &&
      !(value instanceof Date)
    ) {
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
  subject: 'math' | 'highmath';
  teacher: string;
  room?: string;
  schedule: { day: string; periodId: string; room?: string }[];
  slotTeachers?: Record<string, string>;  // "월-5" -> "Teacher"
  slotRooms?: Record<string, string>;     // "월-5" -> "Room"
  underline?: boolean;
  mainTeacher?: string;
  bgColor?: string;
  textColor?: string;
  // 라이브 원본 doc data 전체 보관 (publish 시 머지하여 미관리 필드 손실 방지)
  _raw?: Record<string, any>;
}

export interface ScenarioEnrollment {
  studentId: string;
  className: string;
  classId?: string;
  subject: 'math' | 'highmath';
  underline?: boolean;
  enrollmentDate?: string;
  withdrawalDate?: string;
  onHold?: boolean;
  attendanceDays?: string[];
  // 라이브 원본 enrollment doc data 전체 보관
  _raw?: Record<string, any>;
}

export interface ScenarioStudent extends TimetableStudent {
  isScenarioAdded?: boolean;  // 시나리오에서 추가된 학생
  isScenarioRemoved?: boolean; // 시나리오에서 제거된 학생
}

export interface ScenarioState {
  isScenarioMode: boolean;
  scenarioClasses: Record<string, ScenarioClass>;  // classId -> ScenarioClass
  scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>>;  // className -> studentId -> enrollment
  isDirty: boolean;  // 변경 사항 있는지
  currentScenarioName: string | null;
}

export interface MathSimulationContextValue extends ScenarioState {
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
  addStudentToClass: (className: string, studentId: string, enrollmentData?: Partial<ScenarioEnrollment>) => void;
  removeStudentFromClass: (className: string, studentId: string) => void;
  moveStudent: (fromClass: string, toClass: string, studentId: string) => void;

  // Undo (Ctrl+Z)
  undo: () => boolean;  // true = undo 실행, false = 스택 비어있음
  undoAll: () => number;  // 모든 변경 되돌리기 — 되돌린 개수 반환
  canUndo: boolean;
  historyDepth: number;  // 현재 history 스택 크기
  // 다중 작업을 단일 history 엔트리로 묶음 (예: 다중 학생 이동)
  batchEdit: (fn: () => void) => void;

  // 시각 diff (실시간 모드의 pendingExcel*과 동일 형태 — UI에서 그대로 사용)
  scenarioDiff: {
    addedIds: Set<string>;                          // 신규 등록 학생 (전역)
    moveFromMap: Map<string, Set<string>>;          // classId → 출발지 학생 ids
    moveToMap: Map<string, Set<string>>;            // classId → 도착지 학생 ids
    removedFromClassIds: Map<string, Set<string>>;  // classId → 삭제 학생 ids (이동 아닌 단순 삭제)
  };

  // Scenario operations
  loadFromLive: () => Promise<void>;
  saveToScenario: (name: string, description: string, userId: string, userName: string) => Promise<string>;
  updateScenario: (scenarioId: string, userId: string, userName: string) => Promise<void>;
  loadFromScenario: (scenarioId: string) => Promise<void>;
  publishToLive: (userId: string, userName: string) => Promise<void>;

  // State
  setCurrentScenarioName: (name: string | null) => void;
}

// ============ CONTEXT ============

const MathSimulationContext = createContext<MathSimulationContextValue | null>(null);

export const useMathSimulation = () => {
  const context = useContext(MathSimulationContext);
  if (!context) {
    throw new Error('useMathSimulation must be used within MathSimulationProvider');
  }
  return context;
};

// Optional hook that doesn't throw if outside provider
export const useMathSimulationOptional = () => {
  return useContext(MathSimulationContext);
};

// ============ PROVIDER ============

interface MathSimulationProviderProps {
  children: React.ReactNode;
}

export const MathSimulationProvider: React.FC<MathSimulationProviderProps> = ({ children }) => {
  const [state, setState] = useState<ScenarioState>({
    isScenarioMode: false,
    scenarioClasses: {},
    scenarioEnrollments: {},
    isDirty: false,
    currentScenarioName: null,
  });

  // 시뮬 진입 시점 스냅샷 — 시각 diff(추가/삭제/이동 표시) 계산용
  const [initialEnrollments, setInitialEnrollments] = useState<
    Record<string, Record<string, ScenarioEnrollment>>
  >({});

  // Ref for stable access in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;
  const initialEnrollmentsRef = useRef(initialEnrollments);
  initialEnrollmentsRef.current = initialEnrollments;

  // ============ UNDO HISTORY ============
  // 편집 작업 직전의 (scenarioClasses, scenarioEnrollments) 스냅샷 스택
  // 최대 50개 유지 (메모리 보호)
  const HISTORY_LIMIT = 50;
  type HistoryEntry = {
    scenarioClasses: Record<string, ScenarioClass>;
    scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>>;
  };
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // batch 진행 중에는 개별 edit op의 pushHistory를 건너뜀
  const batchInProgress = useRef(false);

  const pushHistorySnapshot = useCallback(() => {
    const { scenarioClasses, scenarioEnrollments } = stateRef.current;
    setHistory(prev => {
      const next = [...prev, { scenarioClasses, scenarioEnrollments }];
      return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next;
    });
  }, []);

  const pushHistory = useCallback(() => {
    if (batchInProgress.current) return;
    pushHistorySnapshot();
  }, [pushHistorySnapshot]);

  const batchEdit = useCallback((fn: () => void) => {
    pushHistorySnapshot();  // 단일 스냅샷
    batchInProgress.current = true;
    try {
      fn();
    } finally {
      batchInProgress.current = false;
    }
  }, [pushHistorySnapshot]);

  // ============ INTERNAL LOAD FROM LIVE ============

  const loadFromLiveInternal = useCallback(async () => {
    // [async-parallel] Load classes and enrollments in parallel (math + highmath)
    const MATH_SUBJECTS = ['math', 'highmath'];
    const [classesSnapshot, enrollmentsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'classes'), where('subject', 'in', MATH_SUBJECTS))),
      getDocs(query(collectionGroup(db, 'enrollments'), where('subject', 'in', MATH_SUBJECTS)))
    ]);

    // 1. Process classes
    const scenarioClasses: Record<string, ScenarioClass> = {};
    classesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      scenarioClasses[docSnap.id] = {
        id: docSnap.id,
        className: data.className,
        subject: (data.subject === 'highmath' ? 'highmath' : 'math') as 'math' | 'highmath',
        teacher: data.teacher,
        room: data.room,
        schedule: data.schedule || [],
        slotTeachers: data.slotTeachers || {},
        slotRooms: data.slotRooms || {},
        underline: data.underline,
        mainTeacher: data.mainTeacher,
        bgColor: data.bgColor,
        textColor: data.textColor,
        _raw: data,
      };
    });

    // 2. Process enrollments — useSubjectClassStudents와 동일한 "현재 활성" 필터 적용
    const todayStr = new Date().toISOString().split('T')[0];

    const scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>> = {};
    enrollmentsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const className = data.className as string;
      const studentId = docSnap.ref.parent.parent?.id;
      const classId = data.classId as string;

      if (!studentId || !className) return;

      // 취소된 예약 제외
      if (data.cancelledAt) return;
      // 퇴원 제외
      if (data.withdrawalDate) return;

      const startDate = convertTimestampToDate(data.enrollmentDate || data.startDate);
      const endDate = convertTimestampToDate(data.endDate);
      const wdDate = convertTimestampToDate(data.withdrawalDate);

      // 모순 record 가드 — startDate > endDate 인 깨진 record 무시
      const effEnd = wdDate || endDate;
      if (startDate && effEnd && startDate > effEnd) return;

      // 종료된 등록 제외 (endDate <= today)
      if (endDate && endDate <= todayStr) return;

      // 미래 예정 등록 제외 (현재 시점 시간표만 반영)
      if (startDate && startDate > todayStr) return;

      if (!scenarioEnrollments[className]) {
        scenarioEnrollments[className] = {};
      }

      // 동일 학생이 같은 반에 중복 enrollment(예: 과거+현재) 있을 때
      // 최신 enrollmentDate를 우선
      const existing = scenarioEnrollments[className][studentId];
      if (existing) {
        const existingStart = existing.enrollmentDate || '';
        const newStart = startDate || '';
        if (existingStart >= newStart) return;
      }

      scenarioEnrollments[className][studentId] = {
        studentId,
        className,
        classId,
        subject: (data.subject === 'highmath' ? 'highmath' : 'math') as 'math' | 'highmath',
        underline: data.underline,
        enrollmentDate: startDate,
        withdrawalDate: wdDate,
        onHold: data.onHold || false,
        attendanceDays: data.attendanceDays || [],
        _raw: data,
      };
    });

    setState(prev => ({
      ...prev,
      scenarioClasses,
      scenarioEnrollments,
    }));

    return { scenarioClasses, scenarioEnrollments };
  }, []);

  // ============ MODE CONTROL ============

  const enterScenarioMode = useCallback(async () => {
    // Load current live data into draft
    const result = await loadFromLiveInternal();
    setInitialEnrollments(result.scenarioEnrollments); // 시각 diff 기준선
    setHistory([]);
    setState(prev => ({
      ...prev,
      isScenarioMode: true,
      isDirty: false,
      currentScenarioName: null,
    }));
  }, [loadFromLiveInternal]);

  const exitScenarioMode = useCallback(() => {
    if (stateRef.current.isDirty) {
      if (!confirm('저장하지 않은 변경 사항이 있습니다. 정말 나가시겠습니까?')) {
        return;
      }
    }
    setHistory([]);
    setInitialEnrollments({});
    setState({
      isScenarioMode: false,
      scenarioClasses: {},
      scenarioEnrollments: {},
      isDirty: false,
      currentScenarioName: null,
    });
  }, []);

  // ============ DATA ACCESS ============

  const getClassStudents = useCallback((
    classNames: string[],
    studentMap: Record<string, any>
  ) => {
    const { isScenarioMode, scenarioEnrollments } = stateRef.current;
    const initial = initialEnrollmentsRef.current;
    const result: Record<string, { studentList: ScenarioStudent[]; studentIds: string[] }> = {};

    classNames.forEach(className => {
      if (!isScenarioMode) {
        // Not in simulation mode - return empty, let hooks handle it
        result[className] = { studentList: [], studentIds: [] };
        return;
      }

      const enrollments = scenarioEnrollments[className] || {};
      const initialEnrollmentsForClass = initial[className] || {};

      // 현재 + 초기 학생 ID 합집합 — 초기에 있었으나 지금 없는 학생도 표시 (취소선)
      const allIds = Array.from(new Set([
        ...Object.keys(enrollments),
        ...Object.keys(initialEnrollmentsForClass),
      ]));

      const studentList: ScenarioStudent[] = allIds
        .map(id => {
          const baseStudent = studentMap[id];
          const enrollment = enrollments[id] || initialEnrollmentsForClass[id];

          if (!baseStudent || baseStudent.status !== 'active') return null;

          const studentEnrollmentDate = enrollment?.enrollmentDate || baseStudent.startDate;
          const isScenarioRemoved = !enrollments[id] && !!initialEnrollmentsForClass[id];
          const isScenarioAdded = !!enrollments[id] && !initialEnrollmentsForClass[id];

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
            isScenarioAdded,
            isScenarioRemoved,
          } as ScenarioStudent;
        })
        .filter(Boolean) as ScenarioStudent[];

      studentList.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

      result[className] = { studentList, studentIds: allIds };
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
    pushHistory();
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
  }, [pushHistory]);

  const addStudentToClass = useCallback((
    className: string,
    studentId: string,
    enrollmentData?: Partial<ScenarioEnrollment>
  ) => {
    pushHistory();
    setState(prev => {
      const classEnrollments = prev.scenarioEnrollments[className] || {};

      return {
        ...prev,
        scenarioEnrollments: {
          ...prev.scenarioEnrollments,
          [className]: {
            ...classEnrollments,
            [studentId]: {
              studentId,
              className,
              subject: enrollmentData?.subject || 'math',
              ...enrollmentData,
            },
          },
        },
        isDirty: true,
      };
    });
  }, [pushHistory]);

  const removeStudentFromClass = useCallback((className: string, studentId: string) => {
    pushHistory();
    setState(prev => {
      const classEnrollments = { ...prev.scenarioEnrollments[className] };
      delete classEnrollments[studentId];

      return {
        ...prev,
        scenarioEnrollments: {
          ...prev.scenarioEnrollments,
          [className]: classEnrollments,
        },
        isDirty: true,
      };
    });
  }, [pushHistory]);

  const moveStudent = useCallback((fromClass: string, toClass: string, studentId: string) => {
    pushHistory();
    setState(prev => {
      const fromEnrollments = { ...prev.scenarioEnrollments[fromClass] };
      const toEnrollments = prev.scenarioEnrollments[toClass] || {};

      const enrollment = fromEnrollments[studentId];
      if (!enrollment) return prev;

      delete fromEnrollments[studentId];

      return {
        ...prev,
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
  }, [pushHistory]);

  // ============ UNDO ============

  const undo = useCallback((): boolean => {
    let didUndo = false;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setState(s => ({
        ...s,
        scenarioClasses: last.scenarioClasses,
        scenarioEnrollments: last.scenarioEnrollments,
        isDirty: true,
      }));
      didUndo = true;
      return prev.slice(0, -1);
    });
    return didUndo;
  }, []);

  // 전체 되돌리기 — 가장 오래된 스냅샷(시뮬 진입 직후 상태)으로 복원 후 history 비움
  const undoAll = useCallback((): number => {
    let count = 0;
    setHistory(prev => {
      if (prev.length === 0) return prev;
      count = prev.length;
      const earliest = prev[0];
      setState(s => ({
        ...s,
        scenarioClasses: earliest.scenarioClasses,
        scenarioEnrollments: earliest.scenarioEnrollments,
        isDirty: false,
      }));
      return [];
    });
    return count;
  }, []);

  // ============ SCENARIO OPERATIONS ============

  const loadFromLive = useCallback(async () => {
    if (stateRef.current.isDirty) {
      if (!confirm('현재 변경 사항이 사라집니다. 계속하시겠습니까?')) {
        return;
      }
    }
    const result = await loadFromLiveInternal();
    setInitialEnrollments(result.scenarioEnrollments);
    setHistory([]);
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
    const { scenarioClasses, scenarioEnrollments } = stateRef.current;

    const scenarioId = `scenario_${Date.now()}`;

    // Calculate stats
    const classCount = Object.keys(scenarioClasses).length;
    const studentCount = Object.values(scenarioEnrollments)
      .reduce((acc, enrollments) => acc + Object.keys(enrollments).length, 0);

    const sanitizedClasses = sanitizeForFirestore(scenarioClasses);
    const sanitizedEnrollments = sanitizeForFirestore(scenarioEnrollments);

    const scenarioData = {
      id: scenarioId,
      name,
      description,
      classes: sanitizedClasses,
      enrollments: sanitizedEnrollments,
      createdAt: new Date().toISOString(),
      createdBy: userName,
      createdByUid: userId,
      stats: {
        classCount,
        studentCount,
        timetableDocCount: classCount,
      },
      version: 2,
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
    const { scenarioClasses, scenarioEnrollments } = stateRef.current;

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

    const sanitizedClasses = sanitizeForFirestore(scenarioClasses);
    const sanitizedEnrollments = sanitizeForFirestore(scenarioEnrollments);

    // 기존 시나리오 업데이트
    await setDoc(doc(db, SCENARIO_COLLECTION, scenarioId), {
      ...existingData,
      classes: sanitizedClasses,
      enrollments: sanitizedEnrollments,
      updatedAt: new Date().toISOString(),
      updatedBy: userName,
      updatedByUid: userId,
      stats: {
        classCount,
        studentCount,
        timetableDocCount: classCount,
      },
      version: 2,
    });

    setState(prev => ({
      ...prev,
      isDirty: false,
      currentScenarioName: existingData.name,
    }));
  }, []);

  const loadFromScenario = useCallback(async (scenarioId: string) => {
    // Direct document read instead of full collection scan
    const docRef = doc(db, SCENARIO_COLLECTION, scenarioId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('시나리오를 찾을 수 없습니다.');
    }

    const scenario = docSnap.data();

    if (scenario.version === 2) {
      setHistory([]);
      // 시나리오 로드 시점을 새 기준선으로 (이후 편집이 diff로 표시되도록)
      setInitialEnrollments(scenario.enrollments || {});
      setState(prev => ({
        ...prev,
        scenarioClasses: scenario.classes || {},
        scenarioEnrollments: scenario.enrollments || {},
        isDirty: false,
        currentScenarioName: scenario.name,
      }));
    } else {
      throw new Error('레거시 시나리오는 아직 지원되지 않습니다. 새로운 시나리오를 생성해주세요.');
    }
  }, []);

  const publishToLive = useCallback(async (userId: string, userName: string) => {
    const { scenarioClasses, scenarioEnrollments } = stateRef.current;

    if (!confirm('⚠️ 정말로 실제 시간표에 반영하시겠습니까?\n이 작업은 모든 사용자에게 즉시 반영됩니다.')) {
      return;
    }

    let backupId = '';

    try {
      // 1. 백업 생성
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

      // 2. classes 업데이트 — _raw(라이브 원본)와 편집 필드 머지하여 미관리 필드 보존
      const classBatch = writeBatch(db);
      Object.entries(scenarioClasses).forEach(([classId, classData]) => {
        const { _raw, ...editable } = classData;
        const merged = { ...(_raw || {}), ...editable };
        classBatch.set(doc(db, 'classes', classId), sanitizeForFirestore(merged));
      });
      await classBatch.commit();

      // 3. enrollments 업데이트 (math + highmath)
      const MATH_SUBJECTS_PUBLISH = ['math', 'highmath'];
      const existingEnrollmentsSnapshot = await getDocs(
        query(collectionGroup(db, 'enrollments'), where('subject', 'in', MATH_SUBJECTS_PUBLISH))
      );

      // 삭제 배치
      const docsToDelete = existingEnrollmentsSnapshot.docs;
      for (let i = 0; i < docsToDelete.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docsToDelete.slice(i, i + 500);
        chunk.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      // className → classId 역방향 맵 구축
      const classNameToIdMap: Record<string, string> = {};
      Object.entries(scenarioClasses).forEach(([classId, classData]) => {
        classNameToIdMap[classData.className] = classId;
      });

      // 생성 배치 - doc ID = classId, subject = 실제 과목
      // _raw(라이브 원본)와 편집 필드 머지: 시뮬에서 변경한 className/classId/subject는 새 값이 우선
      // 학생 이동 시 enrollment의 teacher/schedule은 새 반 정보로 동기화
      const enrollmentsToCreate: { ref: any; data: any }[] = [];
      Object.entries(scenarioEnrollments).forEach(([className, students]) => {
        const classId = classNameToIdMap[className];
        const targetClass = classId ? scenarioClasses[classId] : undefined;
        const classSubject = (targetClass?.subject) || 'math';
        // 새 반의 schedule을 enrollment 형식("월 1-1")으로 변환
        const targetSchedule = targetClass?.schedule?.map((s: any) =>
          typeof s === 'string' ? s : `${s.day} ${s.periodId}`
        );
        const targetTeacher = targetClass?.teacher;
        Object.entries(students).forEach(([studentId, enrollment]) => {
          const enrollDocId = classId || enrollment.classId || className;
          const enrollmentRef = doc(db, 'students', studentId, 'enrollments', enrollDocId);
          const { _raw, ...editable } = enrollment;
          const merged: Record<string, any> = {
            ...(_raw || {}),
            ...editable,
            classId: enrollDocId,
            subject: classSubject,
            className,
          };
          if (targetSchedule && targetSchedule.length > 0) {
            merged.schedule = targetSchedule;
          }
          if (targetTeacher) {
            merged.teacher = targetTeacher;
            merged.staffId = targetTeacher;
          }
          enrollmentsToCreate.push({
            ref: enrollmentRef,
            data: sanitizeForFirestore(merged),
          });
        });
      });

      for (let i = 0; i < enrollmentsToCreate.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = enrollmentsToCreate.slice(i, i + 500);
        chunk.forEach(item => {
          batch.set(item.ref, item.data);
        });
        await batch.commit();
      }

      setState(prev => ({
        ...prev,
        isDirty: false,
      }));

      alert(`✅ 성공적으로 반영되었습니다.\n(백업 ID: ${backupId})`);
    } catch (error) {
      console.error('publishToLive 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`❌ 실제 반영 중 오류가 발생했습니다.\n${errorMessage}\n\n${backupId ? `백업이 생성되었습니다: ${backupId}` : ''}`);
      throw error;
    }
  }, []);

  const setCurrentScenarioName = useCallback((name: string | null) => {
    setState(prev => ({
      ...prev,
      currentScenarioName: name,
    }));
  }, []);

  // ============ CONTEXT VALUE ============

  const canUndo = history.length > 0;
  const historyDepth = history.length;

  // 시각 diff 계산 — initialEnrollments vs 현재 scenarioEnrollments
  // 학생이 여러 반에 동시 등록될 수 있으므로 (학생, 반) 단위로 정확히 비교
  // (이전엔 학생ID→단일 className 매핑이라 마지막 반만 기록되어 실제 잡은 반이 아닌 곳에 취소선 발생)
  const scenarioDiff = useMemo(() => {
    const addedIds = new Set<string>();
    const moveFromMap = new Map<string, Set<string>>();
    const moveToMap = new Map<string, Set<string>>();
    const removedFromClassIds = new Map<string, Set<string>>();

    // className → classId
    const classNameToId: Record<string, string> = {};
    Object.entries(state.scenarioClasses).forEach(([id, cls]) => {
      classNameToId[cls.className] = id;
    });

    // 학생별 초기/현재 소속 반 집합
    const initialClassesByStudent: Record<string, Set<string>> = {};
    Object.entries(initialEnrollments).forEach(([className, students]) => {
      Object.keys(students).forEach(id => {
        if (!initialClassesByStudent[id]) initialClassesByStudent[id] = new Set();
        initialClassesByStudent[id].add(className);
      });
    });
    const currentClassesByStudent: Record<string, Set<string>> = {};
    Object.entries(state.scenarioEnrollments).forEach(([className, students]) => {
      Object.keys(students).forEach(id => {
        if (!currentClassesByStudent[id]) currentClassesByStudent[id] = new Set();
        currentClassesByStudent[id].add(className);
      });
    });

    const allIds = new Set([
      ...Object.keys(initialClassesByStudent),
      ...Object.keys(currentClassesByStudent),
    ]);
    allIds.forEach(id => {
      const initialSet = initialClassesByStudent[id] || new Set<string>();
      const currentSet = currentClassesByStudent[id] || new Set<string>();
      const removedClasses = [...initialSet].filter(c => !currentSet.has(c));
      const addedClasses = [...currentSet].filter(c => !initialSet.has(c));

      if (removedClasses.length > 0 && addedClasses.length > 0) {
        // 이동: 빠진 각 반은 출발지(취소선), 새로 들어간 각 반은 도착지(보라색)
        removedClasses.forEach(c => {
          const fromId = classNameToId[c];
          if (fromId) {
            if (!moveFromMap.has(fromId)) moveFromMap.set(fromId, new Set());
            moveFromMap.get(fromId)!.add(id);
          }
        });
        addedClasses.forEach(c => {
          const toId = classNameToId[c];
          if (toId) {
            if (!moveToMap.has(toId)) moveToMap.set(toId, new Set());
            moveToMap.get(toId)!.add(id);
          }
        });
      } else if (removedClasses.length > 0) {
        // 순수 삭제 (어느 반에도 새로 추가 안 됨)
        removedClasses.forEach(c => {
          const fromId = classNameToId[c];
          if (fromId) {
            if (!removedFromClassIds.has(fromId)) removedFromClassIds.set(fromId, new Set());
            removedFromClassIds.get(fromId)!.add(id);
          }
        });
      } else if (addedClasses.length > 0) {
        // 순수 추가
        addedIds.add(id);
      }
    });

    return { addedIds, moveFromMap, moveToMap, removedFromClassIds };
  }, [initialEnrollments, state.scenarioEnrollments, state.scenarioClasses]);

  const value = useMemo<MathSimulationContextValue>(() => ({
    ...state,
    enterScenarioMode,
    exitScenarioMode,
    getClassStudents,
    getScenarioClass,
    getScenarioClassByName,
    updateScenarioClass,
    addStudentToClass,
    removeStudentFromClass,
    moveStudent,
    undo,
    undoAll,
    canUndo,
    historyDepth,
    batchEdit,
    scenarioDiff,
    loadFromLive,
    saveToScenario,
    updateScenario,
    loadFromScenario,
    publishToLive,
    setCurrentScenarioName,
  }), [
    state,
    enterScenarioMode,
    exitScenarioMode,
    getClassStudents,
    getScenarioClass,
    getScenarioClassByName,
    updateScenarioClass,
    addStudentToClass,
    removeStudentFromClass,
    moveStudent,
    undo,
    undoAll,
    canUndo,
    historyDepth,
    batchEdit,
    scenarioDiff,
    loadFromLive,
    saveToScenario,
    updateScenario,
    loadFromScenario,
    publishToLive,
    setCurrentScenarioName,
  ]);

  return (
    <MathSimulationContext.Provider value={value}>
      {children}
    </MathSimulationContext.Provider>
  );
};

export default MathSimulationContext;
