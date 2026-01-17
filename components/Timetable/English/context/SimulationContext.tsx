/**
 * SimulationContext - 영어 시간표 시뮬레이션 모드 상태 관리
 *
 * PURPOSE: 시뮬레이션 모드에서 메모리 기반 Draft 상태를 관리하여
 * Firebase 실시간 데이터와 분리된 편집 환경을 제공합니다.
 *
 * DATA STRUCTURE (새 구조 호환):
 * - draftClasses: classes collection 스냅샷 (subject='english')
 * - draftEnrollments: enrollments 데이터 (className -> studentId -> enrollment data)
 *
 * WORKFLOW:
 * 1. 시뮬레이션 모드 진입 시 실시간 데이터를 draftClasses/draftEnrollments에 복사
 * 2. 편집은 draft 상태에서만 수행
 * 3. 시나리오 저장: draft 상태를 scenarios collection에 저장
 * 4. 시나리오 로드: scenarios에서 draft 상태로 복원
 * 5. 실제 반영: draft 상태를 live classes + enrollments에 적용
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { collection, collectionGroup, query, where, getDocs, writeBatch, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';

// ============ TYPES ============

export interface DraftClass {
  id: string;
  className: string;
  subject: 'english';
  teacher: string;
  room?: string;
  schedule: { day: string; periodId: string; room?: string }[];
  slotTeachers?: Record<string, string>;  // "월-5" -> "Teacher"
  slotRooms?: Record<string, string>;     // "월-5" -> "Room"
  underline?: boolean;
  mainTeacher?: string;
  // ... 기타 필드
}

export interface DraftEnrollment {
  studentId: string;
  className: string;
  subject: 'english';
  underline?: boolean;
  enrollmentDate?: string;
  withdrawalDate?: string;
  onHold?: boolean;
  attendanceDays?: string[];
}

export interface SimulationStudent extends TimetableStudent {
  isSimulationAdded?: boolean;  // 시뮬레이션에서 추가된 학생
  isSimulationRemoved?: boolean; // 시뮬레이션에서 제거된 학생
}

export interface SimulationState {
  isSimulationMode: boolean;
  draftClasses: Record<string, DraftClass>;  // classId -> DraftClass
  draftEnrollments: Record<string, Record<string, DraftEnrollment>>;  // className -> studentId -> enrollment
  isDirty: boolean;  // 변경 사항 있는지
  currentScenarioName: string | null;
}

export interface SimulationContextValue extends SimulationState {
  // Mode control
  enterSimulationMode: () => Promise<void>;
  exitSimulationMode: () => void;

  // Data access (for hooks)
  getClassStudents: (classNames: string[], studentMap: Record<string, any>) => Record<string, {
    studentList: SimulationStudent[];
    studentIds: string[];
  }>;
  getDraftClass: (classId: string) => DraftClass | undefined;
  getDraftClassByName: (className: string) => DraftClass | undefined;

  // Edit operations
  updateDraftClass: (classId: string, updates: Partial<DraftClass>) => void;
  addStudentToClass: (className: string, studentId: string, enrollmentData?: Partial<DraftEnrollment>) => void;
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

const SimulationContext = createContext<SimulationContextValue | null>(null);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};

// Optional hook that doesn't throw if outside provider
export const useSimulationOptional = () => {
  return useContext(SimulationContext);
};

// ============ PROVIDER ============

interface SimulationProviderProps {
  children: React.ReactNode;
}

export const SimulationProvider: React.FC<SimulationProviderProps> = ({ children }) => {
  const [state, setState] = useState<SimulationState>({
    isSimulationMode: false,
    draftClasses: {},
    draftEnrollments: {},
    isDirty: false,
    currentScenarioName: null,
  });

  // Ref for stable access in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // ============ MODE CONTROL ============

  const enterSimulationMode = useCallback(async () => {
    // Load current live data into draft
    await loadFromLiveInternal();
    setState(prev => ({
      ...prev,
      isSimulationMode: true,
      isDirty: false,
      currentScenarioName: null,
    }));
  }, []);

  const exitSimulationMode = useCallback(() => {
    if (stateRef.current.isDirty) {
      if (!confirm('저장하지 않은 변경 사항이 있습니다. 정말 나가시겠습니까?')) {
        return;
      }
    }
    setState({
      isSimulationMode: false,
      draftClasses: {},
      draftEnrollments: {},
      isDirty: false,
      currentScenarioName: null,
    });
  }, []);

  // ============ INTERNAL LOAD FROM LIVE ============

  const loadFromLiveInternal = async () => {
    // 1. Load classes (english only)
    const classesSnapshot = await getDocs(
      query(collection(db, 'classes'), where('subject', '==', 'english'))
    );

    const draftClasses: Record<string, DraftClass> = {};
    classesSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      draftClasses[docSnap.id] = {
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

    // 2. Load enrollments (english only)
    const enrollmentsSnapshot = await getDocs(
      query(collectionGroup(db, 'enrollments'), where('subject', '==', 'english'))
    );

    const draftEnrollments: Record<string, Record<string, DraftEnrollment>> = {};
    enrollmentsSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const className = data.className as string;
      const studentId = docSnap.ref.parent.parent?.id;

      if (!studentId || !className) return;
      if (data.withdrawalDate || data.onHold) return;  // Skip withdrawn/on-hold

      if (!draftEnrollments[className]) {
        draftEnrollments[className] = {};
      }

      draftEnrollments[className][studentId] = {
        studentId,
        className,
        subject: 'english',
        underline: data.underline,
        enrollmentDate: data.enrollmentDate || data.startDate,
        withdrawalDate: data.withdrawalDate,
        onHold: data.onHold,
        attendanceDays: data.attendanceDays || [],
      };
    });

    setState(prev => ({
      ...prev,
      draftClasses,
      draftEnrollments,
    }));

    return { draftClasses, draftEnrollments };
  };

  // ============ DATA ACCESS ============

  const getClassStudents = useCallback((
    classNames: string[],
    studentMap: Record<string, any>
  ) => {
    const { isSimulationMode, draftEnrollments } = stateRef.current;
    const result: Record<string, { studentList: SimulationStudent[]; studentIds: string[] }> = {};

    classNames.forEach(className => {
      if (!isSimulationMode) {
        // Not in simulation mode - return empty, let useClassStudents handle it
        result[className] = { studentList: [], studentIds: [] };
        return;
      }

      const enrollments = draftEnrollments[className] || {};
      const studentIds = Object.keys(enrollments);

      const studentList: SimulationStudent[] = studentIds
        .map(id => {
          const baseStudent = studentMap[id];
          const enrollment = enrollments[id];

          if (!baseStudent || baseStudent.status !== 'active') return null;

          return {
            id,
            name: baseStudent.name || '',
            englishName: baseStudent.englishName || '',
            school: baseStudent.school || '',
            grade: baseStudent.grade || '',
            underline: enrollment?.underline ?? baseStudent.underline ?? false,
            enrollmentDate: enrollment?.enrollmentDate,
            withdrawalDate: enrollment?.withdrawalDate,
            onHold: enrollment?.onHold,
            isMoved: false,
            attendanceDays: enrollment?.attendanceDays || [],
            isSimulationAdded: enrollment?.studentId ? false : true,
          } as SimulationStudent;
        })
        .filter(Boolean) as SimulationStudent[];

      studentList.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

      result[className] = { studentList, studentIds };
    });

    return result;
  }, []);

  const getDraftClass = useCallback((classId: string) => {
    return stateRef.current.draftClasses[classId];
  }, []);

  const getDraftClassByName = useCallback((className: string) => {
    return Object.values(stateRef.current.draftClasses).find(c => c.className === className);
  }, []);

  // ============ EDIT OPERATIONS ============

  const updateDraftClass = useCallback((classId: string, updates: Partial<DraftClass>) => {
    setState(prev => ({
      ...prev,
      draftClasses: {
        ...prev.draftClasses,
        [classId]: {
          ...prev.draftClasses[classId],
          ...updates,
        },
      },
      isDirty: true,
    }));
  }, []);

  const addStudentToClass = useCallback((
    className: string,
    studentId: string,
    enrollmentData?: Partial<DraftEnrollment>
  ) => {
    setState(prev => {
      const classEnrollments = prev.draftEnrollments[className] || {};

      return {
        ...prev,
        draftEnrollments: {
          ...prev.draftEnrollments,
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

  const removeStudentFromClass = useCallback((className: string, studentId: string) => {
    setState(prev => {
      const classEnrollments = { ...prev.draftEnrollments[className] };
      delete classEnrollments[studentId];

      return {
        ...prev,
        draftEnrollments: {
          ...prev.draftEnrollments,
          [className]: classEnrollments,
        },
        isDirty: true,
      };
    });
  }, []);

  const moveStudent = useCallback((fromClass: string, toClass: string, studentId: string) => {
    setState(prev => {
      const fromEnrollments = { ...prev.draftEnrollments[fromClass] };
      const toEnrollments = prev.draftEnrollments[toClass] || {};

      const enrollment = fromEnrollments[studentId];
      if (!enrollment) return prev;

      delete fromEnrollments[studentId];

      return {
        ...prev,
        draftEnrollments: {
          ...prev.draftEnrollments,
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
    const { draftClasses, draftEnrollments } = stateRef.current;

    const scenarioId = `scenario_${Date.now()}`;

    // Calculate stats
    const classCount = Object.keys(draftClasses).length;
    const studentCount = Object.values(draftEnrollments)
      .reduce((acc, enrollments) => acc + Object.keys(enrollments).length, 0);

    const scenarioData = {
      id: scenarioId,
      name,
      description,
      // 새 구조 데이터
      classes: draftClasses,
      enrollments: draftEnrollments,
      // 메타데이터
      createdAt: new Date().toISOString(),
      createdBy: userName,
      createdByUid: userId,
      stats: {
        classCount,
        studentCount,
        timetableDocCount: classCount,  // 호환성
      },
      version: 2,  // 새 구조 버전 표시
    };

    await setDoc(doc(db, 'english_scenarios', scenarioId), scenarioData);

    setState(prev => ({
      ...prev,
      isDirty: false,
      currentScenarioName: name,
    }));

    return scenarioId;
  }, []);

  const loadFromScenario = useCallback(async (scenarioId: string) => {
    const docSnap = await getDocs(query(collection(db, 'english_scenarios')));
    const scenario = docSnap.docs.find(d => d.id === scenarioId)?.data();

    if (!scenario) {
      throw new Error('시나리오를 찾을 수 없습니다.');
    }

    // 버전 체크
    if (scenario.version === 2) {
      // 새 구조
      setState(prev => ({
        ...prev,
        draftClasses: scenario.classes || {},
        draftEnrollments: scenario.enrollments || {},
        isDirty: false,
        currentScenarioName: scenario.name,
      }));
    } else {
      // 레거시 구조 - 변환 필요
      // TODO: 레거시 시나리오 마이그레이션 로직
      throw new Error('레거시 시나리오는 아직 지원되지 않습니다. 새로운 시나리오를 생성해주세요.');
    }
  }, []);

  const publishToLive = useCallback(async (userId: string, userName: string) => {
    const { draftClasses, draftEnrollments } = stateRef.current;

    if (!confirm('⚠️ 정말로 실제 시간표에 반영하시겠습니까?\n이 작업은 모든 사용자에게 즉시 반영됩니다.')) {
      return;
    }

    // 1. 백업 생성 (현재 실시간 데이터)
    const backupId = `backup_${Date.now()}`;
    const { draftClasses: liveClasses, draftEnrollments: liveEnrollments } = await loadFromLiveInternal();

    await setDoc(doc(db, 'english_scenarios', backupId), {
      id: backupId,
      name: `백업_${new Date().toLocaleString()}`,
      description: '[자동백업] 실제 반영 전 자동 생성',
      classes: liveClasses,
      enrollments: liveEnrollments,
      createdAt: new Date().toISOString(),
      createdBy: `${userName} (자동)`,
      createdByUid: userId,
      version: 2,
    });

    // 2. classes 업데이트
    const classBatch = writeBatch(db);
    Object.entries(draftClasses).forEach(([classId, classData]) => {
      classBatch.set(doc(db, 'classes', classId), classData);
    });
    await classBatch.commit();

    // 3. enrollments 업데이트 (복잡 - 학생별 subcollection)
    // 기존 enrollments 삭제 후 새로 생성
    const existingEnrollmentsSnapshot = await getDocs(
      query(collectionGroup(db, 'enrollments'), where('subject', '==', 'english'))
    );

    // 삭제 배치
    const deleteBatch = writeBatch(db);
    let deleteCount = 0;
    existingEnrollmentsSnapshot.docs.forEach(docSnap => {
      deleteBatch.delete(docSnap.ref);
      deleteCount++;
      if (deleteCount >= 500) {
        // Firestore 배치 제한
        console.warn('Enrollment 삭제 500개 제한 도달');
      }
    });
    if (deleteCount > 0) {
      await deleteBatch.commit();
    }

    // 생성 배치
    const createBatch = writeBatch(db);
    let createCount = 0;
    Object.entries(draftEnrollments).forEach(([className, students]) => {
      Object.entries(students).forEach(([studentId, enrollment]) => {
        const enrollmentRef = doc(db, 'students', studentId, 'enrollments', `english_${className}`);
        createBatch.set(enrollmentRef, {
          ...enrollment,
          subject: 'english',
          className,
        });
        createCount++;
      });
    });
    if (createCount > 0) {
      await createBatch.commit();
    }

    setState(prev => ({
      ...prev,
      isDirty: false,
    }));

    alert(`✅ 성공적으로 반영되었습니다.\n(백업 ID: ${backupId})`);
  }, []);

  const setCurrentScenarioName = useCallback((name: string | null) => {
    setState(prev => ({
      ...prev,
      currentScenarioName: name,
    }));
  }, []);

  // ============ CONTEXT VALUE ============

  const value = useMemo<SimulationContextValue>(() => ({
    ...state,
    enterSimulationMode,
    exitSimulationMode,
    getClassStudents,
    getDraftClass,
    getDraftClassByName,
    updateDraftClass,
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
    enterSimulationMode,
    exitSimulationMode,
    getClassStudents,
    getDraftClass,
    getDraftClassByName,
    updateDraftClass,
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
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};

export default SimulationContext;
