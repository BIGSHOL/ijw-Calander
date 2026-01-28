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

const SCENARIO_COLLECTION = 'math_scenarios';

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
  subject: 'math';
  teacher: string;
  room?: string;
  schedule: { day: string; periodId: string; room?: string }[];
  slotTeachers?: Record<string, string>;  // "월-5" -> "Teacher"
  slotRooms?: Record<string, string>;     // "월-5" -> "Room"
  underline?: boolean;
  mainTeacher?: string;
  // ... 기타 필드
}

export interface ScenarioEnrollment {
  studentId: string;
  className: string;
  subject: 'math';
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

  // Scenario operations
  loadFromLive: () => Promise<void>;
  saveToScenario: (name: string, description: string, userId: string, userName: string) => Promise<string>;
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

  // Ref for stable access in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // ============ INTERNAL LOAD FROM LIVE ============

  const loadFromLiveInternal = useCallback(async () => {
    // [async-parallel] Load classes and enrollments in parallel
    const [classesSnapshot, enrollmentsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'classes'), where('subject', '==', 'math'))),
      getDocs(query(collectionGroup(db, 'enrollments'), where('subject', '==', 'math')))
    ]);

    // 1. Process classes
    const scenarioClasses: Record<string, ScenarioClass> = {};
    classesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      scenarioClasses[docSnap.id] = {
        id: docSnap.id,
        className: data.className,
        subject: 'math',
        teacher: data.teacher,
        room: data.room,
        schedule: data.schedule || [],
        slotTeachers: data.slotTeachers || {},
        slotRooms: data.slotRooms || {},
        underline: data.underline,
        mainTeacher: data.mainTeacher,
      };
    });

    // 2. Process enrollments

    const scenarioEnrollments: Record<string, Record<string, ScenarioEnrollment>> = {};
    enrollmentsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const className = data.className as string;
      const studentId = docSnap.ref.parent.parent?.id;

      if (!studentId || !className) return;
      if (data.withdrawalDate) return;  // Skip withdrawn only (onHold는 포함)

      if (!scenarioEnrollments[className]) {
        scenarioEnrollments[className] = {};
      }

      // Convert Firestore Timestamp to YYYY-MM-DD string
      const convertTimestampToDate = (timestamp: any): string | undefined => {
        if (!timestamp) return undefined;
        if (typeof timestamp === 'string') return timestamp;
        if (timestamp?.toDate) {
          const date = timestamp.toDate();
          return date.toISOString().split('T')[0];
        }
        return undefined;
      };

      scenarioEnrollments[className][studentId] = {
        studentId,
        className,
        subject: 'math',
        underline: data.underline,
        enrollmentDate: convertTimestampToDate(data.enrollmentDate || data.startDate),
        withdrawalDate: convertTimestampToDate(data.withdrawalDate),
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
  }, []);

  // ============ MODE CONTROL ============

  const enterScenarioMode = useCallback(async () => {
    // Load current live data into draft
    await loadFromLiveInternal();
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
    const result: Record<string, { studentList: ScenarioStudent[]; studentIds: string[] }> = {};

    classNames.forEach(className => {
      if (!isScenarioMode) {
        // Not in simulation mode - return empty, let hooks handle it
        result[className] = { studentList: [], studentIds: [] };
        return;
      }

      const enrollments = scenarioEnrollments[className] || {};
      const studentIds = Object.keys(enrollments);

      const studentList: ScenarioStudent[] = studentIds
        .map(id => {
          const baseStudent = studentMap[id];
          const enrollment = enrollments[id];

          if (!baseStudent || baseStudent.status !== 'active') return null;

          const studentEnrollmentDate = enrollment?.enrollmentDate || baseStudent.startDate;

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
            isScenarioAdded: false,
          } as ScenarioStudent;
        })
        .filter(Boolean) as ScenarioStudent[];

      studentList.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

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

  const addStudentToClass = useCallback((
    className: string,
    studentId: string,
    enrollmentData?: Partial<ScenarioEnrollment>
  ) => {
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
              subject: 'math',
              ...enrollmentData,
            },
          },
        },
        isDirty: true,
      };
    });
  }, []);

  const removeStudentFromClass = useCallback((className: string, studentId: string) => {
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
  }, []);

  const moveStudent = useCallback((fromClass: string, toClass: string, studentId: string) => {
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

  const loadFromScenario = useCallback(async (scenarioId: string) => {
    // Direct document read instead of full collection scan
    const docRef = doc(db, SCENARIO_COLLECTION, scenarioId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('시나리오를 찾을 수 없습니다.');
    }

    const scenario = docSnap.data();

    if (scenario.version === 2) {
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

      // 2. classes 업데이트
      const classBatch = writeBatch(db);
      Object.entries(scenarioClasses).forEach(([classId, classData]) => {
        classBatch.set(doc(db, 'classes', classId), sanitizeForFirestore(classData));
      });
      await classBatch.commit();

      // 3. enrollments 업데이트
      const existingEnrollmentsSnapshot = await getDocs(
        query(collectionGroup(db, 'enrollments'), where('subject', '==', 'math'))
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
        console.log(`✅ Deleted enrollments batch: ${i + chunk.length}/${docsToDelete.length}`);
      }

      // 생성 배치
      const enrollmentsToCreate: { ref: any; data: any }[] = [];
      Object.entries(scenarioEnrollments).forEach(([className, students]) => {
        Object.entries(students).forEach(([studentId, enrollment]) => {
          const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `math_${className}`);
          enrollmentsToCreate.push({
            ref: enrollmentRef,
            data: sanitizeForFirestore({
              ...enrollment,
              subject: 'math',
              className,
            }),
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
        console.log(`✅ Created enrollments batch: ${i + chunk.length}/${enrollmentsToCreate.length}`);
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
    loadFromLive,
    saveToScenario,
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
    loadFromLive,
    saveToScenario,
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
