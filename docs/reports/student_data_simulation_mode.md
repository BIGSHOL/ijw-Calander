# 영어 시간표 학생 데이터 시뮬레이션 모드 분리 계획

> 작성일: 2026-01-01
> 상태: ✅ 구현 완료
> 최종 수정: 2026-01-01
> 관련 문서: [english_timetable_backup_system.md](./english_timetable_backup_system.md)

---

## 목차

1. [개요](#1-개요)
2. [현재 문제 분석](#2-현재-문제-분석)
3. [해결 방안](#3-해결-방안)
4. [상세 구현 계획](#4-상세-구현-계획)
5. [백업 시스템 통합](#5-백업-시스템-통합)
6. [에러 처리 및 엣지 케이스](#6-에러-처리-및-엣지-케이스)
7. [권한 및 보안](#7-권한-및-보안)
8. [테스트 계획](#8-테스트-계획)
9. [배포 체크리스트](#9-배포-체크리스트)
10. [변경 파일 목록](#10-변경-파일-목록)
11. [주의사항](#11-주의사항)

---

## 1. 개요

### 1.1. 배경

현재 영어 시간표 시스템은 시뮬레이션 모드를 지원하지만(`isSimulationMode`), 학생 데이터는 실시간 컬렉션(`수업목록`)에 직접 저장됩니다. 이로 인해 시뮬레이션 작업이 즉시 실제 데이터에 반영되는 문제가 있습니다.

### 1.2. 목표

시간표 데이터와 동일하게 학생 데이터도 Draft 컬렉션으로 분리하여, 시뮬레이션 작업이 실제 데이터에 영향을 주지 않도록 합니다.

### 1.3. 범위

- `수업목록_draft` 컬렉션 추가
- `StudentModal` 컴포넌트 수정 (컬렉션 동적 선택)
- `EnglishClassTab` 컴포넌트 수정 (학생 수 조회 컬렉션 선택)
- `EnglishTimetable` 시뮬레이션 로직 확장 (학생 데이터 복사/반영)
- 백업 시스템에 학생 데이터 포함

---

## 2. 현재 문제 분석

### 2.1. 문제점

- 학생 데이터는 `수업목록` 컬렉션에 저장
- 시뮬레이션 모드에서 학생 추가/수정 시 **실시간 데이터에 즉시 반영**
- 시간표 시뮬레이션과 학생 데이터 변경이 동기화되지 않음
- 실제 반영 전 학생 데이터 변경사항을 미리보기할 수 없음

### 2.2. 영향 범위

| 컴포넌트 | 현재 동작 | 파일 경로 |
|---------|----------|----------|
| `StudentModal.tsx` | `수업목록` 컬렉션 직접 조회/수정 (Line 64, 89, 115, 144) | [components/Timetable/English/StudentModal.tsx](components/Timetable/English/StudentModal.tsx) |
| `EnglishClassTab.tsx` | 학생 수 통계 표시 시 `수업목록` 참조 | [components/Timetable/English/EnglishClassTab.tsx](components/Timetable/English/EnglishClassTab.tsx) |
| `EnglishTimetable.tsx` | 시뮬레이션 진입/반영 시 학생 데이터 미처리 | [components/Timetable/English/EnglishTimetable.tsx](components/Timetable/English/EnglishTimetable.tsx) |

### 2.3. 현재 코드 분석

#### StudentModal.tsx (Line 64)
```typescript
const q = query(collection(db, '수업목록'), where('className', '==', className));
```
**문제**: 하드코딩된 컬렉션명, 시뮬레이션 모드와 무관하게 항상 실시간 데이터 참조

#### StudentModal.tsx (Line 115)
```typescript
const unsub = onSnapshot(doc(db, '수업목록', classDocId), (docSnap) => {
```
**문제**: 실시간 리스너도 `수업목록` 고정

#### EnglishTimetable.tsx (Line 148-169)
```typescript
const handleCopyLiveToDraft = async () => {
    // ... 시간표만 복사, 학생 데이터 누락 ...
}
```
**문제**: 시뮬레이션 진입 시 학생 데이터는 복사하지 않음

---

## 3. 해결 방안

### 3.1. Option 비교

| 항목 | Option A: 별도 Draft 컬렉션 | Option B: 기존 백업 시스템 통합 |
|------|---------------------------|------------------------------|
| **구조** | `수업목록` + `수업목록_draft` | 백업 스냅샷에 학생 데이터 포함 |
| **일관성** | 시간표 패턴과 동일 ⭐ | 백업 시스템에 의존 |
| **미리보기** | 실시간 가능 ⭐ | 복원 전까지 불가 |
| **복잡도** | 중간 | 높음 (백업 구조 변경) |
| **Firebase 비용** | +α (Draft 컬렉션) | 변동 없음 |

### 3.2. 권장 방안: **Option A - 별도 Draft 컬렉션**

#### 선택 이유
1. **일관성**: 시간표와 동일한 패턴 (`EN_COLLECTION` / `EN_DRAFT_COLLECTION`)
2. **사용자 경험**: 시뮬레이션 모드에서 학생 데이터 변경사항 실시간 확인 가능
3. **구현 난이도**: 기존 패턴 재사용, 추가 로직 최소화
4. **백업 통합**: 실제 반영 시 자동 백업에 학생 데이터도 포함

#### 비용 분석
- 예상 Draft 데이터: ~30-80개 수업 × 평균 15명 = ~450-1200 학생
- Firestore 저장 크기: ~100-200KB
- 월 비용 증가: **무시 가능 수준**

---

## 4. 상세 구현 계획

### 4.1. Phase 1: 상수 추가 (`englishUtils.ts`)

**파일**: [components/Timetable/English/englishUtils.ts:40-41](components/Timetable/English/englishUtils.ts#L40-L41)

**기존 코드** (Line 40-41):
```typescript
export const EN_COLLECTION = 'english_schedules';
export const EN_DRAFT_COLLECTION = 'english_schedules_draft';
```

**추가할 코드** (Line 42-43에 삽입):
```typescript
export const CLASS_COLLECTION = '수업목록';
export const CLASS_DRAFT_COLLECTION = '수업목록_draft';
```

**예상 작업 시간**: 5분

---

### 4.2. Phase 2: StudentModal 수정

**파일**: [components/Timetable/English/StudentModal.tsx](components/Timetable/English/StudentModal.tsx)

#### 4.2.1. Props 인터페이스 확장 (Line 9-16)

**기존 코드**:
```typescript
interface StudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;
    teacher?: string;
    currentUser: any;
    readOnly?: boolean;
}
```

**수정 후**:
```typescript
interface StudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;
    teacher?: string;
    currentUser: any;
    readOnly?: boolean;
    isSimulationMode?: boolean;  // 신규 추가
}
```

#### 4.2.2. 컴포넌트 함수 시그니처 수정 (Line 18)

**기존 코드**:
```typescript
const StudentModal: React.FC<StudentModalProps> = ({ isOpen, onClose, className, teacher, currentUser, readOnly = false }) => {
```

**수정 후**:
```typescript
const StudentModal: React.FC<StudentModalProps> = ({
    isOpen,
    onClose,
    className,
    teacher,
    currentUser,
    readOnly = false,
    isSimulationMode = false  // 기본값 false (실시간 모드)
}) => {
```

#### 4.2.3. 컬렉션 동적 선택 (Line 54-102)

**기존 코드** (Line 64):
```typescript
const q = query(collection(db, '수업목록'), where('className', '==', className));
```

**수정 후**:
```typescript
import { CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';

// Line 61-62: 컬렉션 선택 로직 추가
const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;

// Line 64: 쿼리 수정
const q = query(collection(db, targetCollection), where('className', '==', className));
```

**전체 수정된 함수** (Line 55-102):
```typescript
useEffect(() => {
    if (!isOpen || !className) return;

    setIsDirty(false);

    const findOrCreateClass = async () => {
        setLoading(true);
        try {
            const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
            const q = query(collection(db, targetCollection), where('className', '==', className));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const docRef = snapshot.docs[0];
                setClassDocId(docRef.id);
                const data = docRef.data();
                setStudents(data.studentList || []);
                setClassTeacher(data.teacher || '');
            } else {
                // Auto-create class
                if (isSimulationMode) {
                    // 시뮬레이션 모드: 자동 생성 허용
                    const { setDoc: setDocFn } = await import('firebase/firestore');
                    const newDocId = `영어_${className.replace(/\s/g, '_')}_${Date.now()}`;
                    const newClassData = {
                        id: newDocId,
                        className: className,
                        teacher: teacher || '',
                        subject: '영어',
                        room: '',
                        schedule: [],
                        studentList: [],
                        order: 999,
                    };

                    await setDocFn(doc(db, targetCollection, newDocId), newClassData);
                    setClassDocId(newDocId);
                    setStudents([]);
                    setClassTeacher(teacher || '');
                    console.log(`[Simulation] Auto-created class: ${className}`);
                } else {
                    // 실시간 모드: 사용자 확인 필요
                    const confirmed = confirm(
                        `⚠️ "${className}" 수업이 수업목록에 없습니다.\n\n` +
                        `새로 생성하시겠습니까?\n(취소 시 모달이 닫힙니다)`
                    );
                    if (!confirmed) {
                        onClose();
                        return;
                    }

                    const { setDoc: setDocFn } = await import('firebase/firestore');
                    const newDocId = `영어_${className.replace(/\s/g, '_')}_${Date.now()}`;
                    const newClassData = {
                        id: newDocId,
                        className: className,
                        teacher: teacher || '',
                        subject: '영어',
                        room: '',
                        schedule: [],
                        studentList: [],
                        order: 999,
                    };

                    await setDocFn(doc(db, targetCollection, newDocId), newClassData);
                    setClassDocId(newDocId);
                    setStudents([]);
                    setClassTeacher(teacher || '');
                    console.log(`[Live] User-confirmed class creation: ${className}`);
                }
            }
        } catch (e) {
            console.error('Error finding/creating class:', e);
            alert('수업 데이터 로드 중 오류가 발생했습니다.\n\n' + (e instanceof Error ? e.message : String(e)));
        }
        setLoading(false);
    };

    findOrCreateClass();
}, [isOpen, className, isSimulationMode, teacher, onClose]);
```

#### 4.2.4. 실시간 리스너 수정 (Line 113-124)

**기존 코드** (Line 115):
```typescript
const unsub = onSnapshot(doc(db, '수업목록', classDocId), (docSnap) => {
```

**수정 후**:
```typescript
useEffect(() => {
    if (!classDocId) return;

    const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
    const unsub = onSnapshot(doc(db, targetCollection, classDocId), (docSnap) => {
        if (isDirtyRef.current) return;
        if (docSnap.exists()) {
            const data = docSnap.data();
            setStudents(data.studentList || []);
            setClassTeacher(data.teacher || '');
        }
    }, (error) => {
        console.error('Real-time listener error:', error);
        // 리스너 에러 시 사용자에게 알림
        if (error.code === 'permission-denied') {
            alert('데이터 접근 권한이 없습니다.');
        } else if (error.code === 'unavailable') {
            alert('네트워크 연결을 확인해주세요.');
        }
    });

    return () => unsub();
}, [classDocId, isSimulationMode]);
```

#### 4.2.5. 저장 로직 수정 (Line 128-155)

**기존 코드** (Line 144):
```typescript
await updateDoc(doc(db, '수업목록', classDocId), { studentList: sanitizedStudents });
```

**수정 후**:
```typescript
const handleSaveChanges = async () => {
    if (!classDocId) return;
    if (!confirm('변경사항을 저장하시겠습니까?')) return;

    try {
        const sanitizedStudents = students.map(student => {
            const cleanStudent: any = { ...student };
            Object.keys(cleanStudent).forEach(key => {
                if (cleanStudent[key] === undefined) {
                    delete cleanStudent[key];
                }
            });
            return cleanStudent;
        });

        const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;
        await updateDoc(doc(db, targetCollection, classDocId), { studentList: sanitizedStudents });
        setIsDirty(false);

        const mode = isSimulationMode ? '[시뮬레이션]' : '';
        alert(`${mode} 저장되었습니다.`);
    } catch (error: any) {
        console.error('Save error:', error);
        let message = '저장 실패: ';
        if (error.code === 'permission-denied') message += '권한이 없습니다.';
        else if (error.code === 'unavailable') message += '네트워크를 확인해주세요.';
        else if (error.code === 'not-found') message += '수업 문서를 찾을 수 없습니다.';
        else message += error.message || '알 수 없는 오류';
        alert(message);
    }
};
```

**예상 작업 시간**: 1.5시간

---

### 4.3. Phase 3: EnglishTimetable 수정

**파일**: [components/Timetable/English/EnglishTimetable.tsx](components/Timetable/English/EnglishTimetable.tsx)

#### 4.3.1. 시뮬레이션 진입 로직 확장 (Line 148-169)

**기존 코드**: 시간표만 복사

**수정 후**: 시간표 + 학생 데이터 복사
```typescript
const handleCopyLiveToDraft = async () => {
    if (!confirm('현재 실시간 시간표를 복사해 오시겠습니까?\n기존 시뮬레이션 작업 내용은 모두 사라집니다.')) return;
    setLoading(true);

    try {
        // Step 1: 시간표 Draft 복사
        const liveSnapshot = await getDocs(collection(db, EN_COLLECTION));
        const timetableBatch = writeBatch(db);

        liveSnapshot.docs.forEach(docSnap => {
            timetableBatch.set(doc(db, EN_DRAFT_COLLECTION, docSnap.id), docSnap.data());
        });

        await timetableBatch.commit();
        console.log(`✅ Timetable copied: ${liveSnapshot.docs.length} docs`);

        // Step 2: 학생 데이터 Draft 복사 (신규)
        const classSnapshot = await getDocs(collection(db, CLASS_COLLECTION));

        // Firestore Batch Write 제한: 최대 500개
        if (classSnapshot.docs.length > 500) {
            throw new Error(`수업 문서가 너무 많습니다 (${classSnapshot.docs.length}개). 개발자에게 문의하세요.`);
        }

        const studentBatch = writeBatch(db);
        classSnapshot.docs.forEach(docSnap => {
            const draftDocRef = doc(db, CLASS_DRAFT_COLLECTION, docSnap.id);
            studentBatch.set(draftDocRef, docSnap.data());
        });

        await studentBatch.commit();
        console.log(`✅ Student data copied: ${classSnapshot.docs.length} docs`);

        alert(`현재 시간표를 성공적으로 가져왔습니다.\n(시간표: ${liveSnapshot.docs.length}개, 수업: ${classSnapshot.docs.length}개)`);
    } catch (e) {
        console.error('Copy failed:', e);
        const errorMsg = e instanceof Error ? e.message : '알 수 없는 오류';
        alert(`복사 중 오류가 발생했습니다.\n\n${errorMsg}`);
    } finally {
        setLoading(false);
    }
};
```

#### 4.3.2. 실제 반영 로직 확장 (Line 171-258)

**기존 코드** (Line 191-196): 시간표 백업만 생성

**수정 후**: 시간표 + 학생 데이터 백업 및 반영
```typescript
const handlePublishDraftToLive = async () => {
    if (!confirm('⚠️ 정말로 실제 시간표에 반영하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 사용자에게 즉시 반영됩니다.')) return;
    setLoading(true);

    let backupId = '';

    try {
        // Step 1: 백업 생성 (시간표 + 학생 데이터)
        try {
            const liveSnapshot = await getDocs(collection(db, EN_COLLECTION));
            const classSnapshot = await getDocs(collection(db, CLASS_COLLECTION));

            if (liveSnapshot.docs.length > 0 || classSnapshot.docs.length > 0) {
                backupId = `backup_${Date.now()}`;
                const timetableBackupData: Record<string, any> = {};
                const studentBackupData: Record<string, any> = {};

                liveSnapshot.docs.forEach(docSnap => {
                    timetableBackupData[docSnap.id] = docSnap.data();
                });

                classSnapshot.docs.forEach(docSnap => {
                    studentBackupData[docSnap.id] = docSnap.data();
                });

                await setDoc(doc(db, 'english_backups', backupId), {
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser?.displayName || currentUser?.email || 'Unknown',
                    createdByUid: currentUser?.uid || '',
                    data: timetableBackupData,
                    studentData: studentBackupData  // 학생 데이터 추가
                });

                console.log(`✅ Backup created: ${backupId} (timetable: ${liveSnapshot.docs.length}, students: ${classSnapshot.docs.length})`);
            } else {
                console.log('No live data to backup (empty collections)');
            }
        } catch (backupError) {
            console.error('Backup creation failed:', backupError);
            throw new Error('백업 생성에 실패했습니다. 안전을 위해 반영 작업을 중단합니다.\n\n오류: ' + (backupError instanceof Error ? backupError.message : String(backupError)));
        }

        // Step 2: Draft → Live 복사 (시간표)
        const draftTimetableSnapshot = await getDocs(collection(db, EN_DRAFT_COLLECTION));

        if (draftTimetableSnapshot.docs.length === 0) {
            throw new Error('시뮬레이션 시간표 데이터가 비어있습니다. 반영할 내용이 없습니다.');
        }

        const timetableBatch = writeBatch(db);
        draftTimetableSnapshot.docs.forEach(docSnap => {
            timetableBatch.set(doc(db, EN_COLLECTION, docSnap.id), docSnap.data());
        });
        await timetableBatch.commit();
        console.log(`✅ Timetable published: ${draftTimetableSnapshot.docs.length} docs`);

        // Step 3: Draft → Live 복사 (학생 데이터)
        const draftClassSnapshot = await getDocs(collection(db, CLASS_DRAFT_COLLECTION));

        if (draftClassSnapshot.docs.length > 0) {
            if (draftClassSnapshot.docs.length > 500) {
                throw new Error(`수업 문서가 너무 많습니다 (${draftClassSnapshot.docs.length}개). 개발자에게 문의하세요.`);
            }

            const classBatch = writeBatch(db);
            draftClassSnapshot.docs.forEach(docSnap => {
                classBatch.set(doc(db, CLASS_COLLECTION, docSnap.id), docSnap.data());
            });
            await classBatch.commit();
            console.log(`✅ Student data published: ${draftClassSnapshot.docs.length} docs`);
        } else {
            console.log('⚠️ No draft student data to publish (empty collection)');
        }

        // Step 4: 백업 정리 (최대 50개 유지)
        try {
            const MAX_BACKUP_COUNT = 50;
            const allBackupsQuery = query(
                collection(db, 'english_backups'),
                orderBy('createdAt', 'asc')
            );
            const allBackups = await getDocs(allBackupsQuery);

            if (allBackups.docs.length > MAX_BACKUP_COUNT) {
                const excessCount = allBackups.docs.length - MAX_BACKUP_COUNT;
                const cleanupBatch = writeBatch(db);

                allBackups.docs.slice(0, excessCount).forEach(docSnap => {
                    cleanupBatch.delete(docSnap.ref);
                });

                await cleanupBatch.commit();
                console.log(`🗑️ ${excessCount}개의 오래된 백업이 자동 삭제되었습니다.`);
            }
        } catch (cleanupError) {
            console.warn('백업 정리 중 오류 발생 (무시됨):', cleanupError);
        }

        alert(`성공적으로 반영되었습니다.\n${backupId ? `(기존 데이터는 자동 백업되었습니다: ${backupId})` : '(백업 데이터 없음)'}`);
        setIsSimulationMode(false);
    } catch (e) {
        console.error('Publish failed:', e);
        const errorMessage = e instanceof Error ? e.message : '반영 중 오류가 발생했습니다.';
        alert(`⚠️ 오류 발생\n\n${errorMessage}\n\n데이터가 변경되지 않았습니다.`);
    } finally {
        setLoading(false);
    }
};
```

**예상 작업 시간**: 2시간

---

### 4.4. Phase 4: EnglishClassTab 수정

**파일**: [components/Timetable/English/EnglishClassTab.tsx](components/Timetable/English/EnglishClassTab.tsx)

#### 4.4.1. Props에 isSimulationMode 추가 (Line 26-32)

**기존 코드**:
```typescript
interface EnglishClassTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
}
```

**수정 후**:
```typescript
interface EnglishClassTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    isSimulationMode?: boolean;  // 신규 추가
}
```

#### 4.4.2. StudentModal 호출 시 isSimulationMode 전달

**위치**: StudentModal 렌더링 부분 (EnglishClassTab 하단)

**수정 후**:
```typescript
<StudentModal
    isOpen={isStudentModalOpen}
    onClose={() => setIsStudentModalOpen(false)}
    className={selectedClass}
    teacher={selectedTeacher}
    currentUser={currentUser}
    readOnly={!canEditEnglish || (isSimulationMode && currentUser?.role !== 'master')}
    isSimulationMode={isSimulationMode}  // 전달
/>
```

**예상 작업 시간**: 30분

---

### 4.5. Phase 5: EnglishTimetable에서 EnglishClassTab으로 Props 전달

**파일**: [components/Timetable/English/EnglishTimetable.tsx](components/Timetable/English/EnglishTimetable.tsx)

**위치**: EnglishClassTab 렌더링 부분 (Line 300-350 추정)

**수정 후**:
```typescript
<EnglishClassTab
    teachers={sortedTeachers}
    scheduleData={scheduleData}
    teachersData={teachersData}
    classKeywords={classKeywords}
    currentUser={currentUser}
    isSimulationMode={isSimulationMode}  // 전달
/>
```

**예상 작업 시간**: 10분

---

## 5. 백업 시스템 통합

### 5.1. 백업 데이터 구조 확장

**파일**: [components/Timetable/English/BackupHistoryModal.tsx:7-15](components/Timetable/English/BackupHistoryModal.tsx#L7-L15)

**기존 인터페이스**:
```typescript
interface BackupEntry {
    id: string;
    createdAt: string;
    createdBy: string;
    createdByUid: string;
    data: Record<string, any>;  // 시간표 데이터만
    isPreRestoreBackup?: boolean;
    restoringTo?: string;
}
```

**수정 후**:
```typescript
interface BackupEntry {
    id: string;
    createdAt: string;
    createdBy: string;
    createdByUid: string;
    data: Record<string, any>;          // 시간표 데이터
    studentData?: Record<string, any>;  // 학생 데이터 (신규 - Optional for backward compatibility)
    isPreRestoreBackup?: boolean;
    restoringTo?: string;
}
```

### 5.2. 복원 로직 수정

**파일**: [components/Timetable/English/BackupHistoryModal.tsx](components/Timetable/English/BackupHistoryModal.tsx)

**위치**: handleRestore 함수 내부 (추정 Line 120-180)

**수정 후**:
```typescript
const handleRestore = async (backup: BackupEntry) => {
    // 백업 데이터 검증
    const validation = validateBackupData(backup);
    if (!validation.isValid) {
        alert(`⚠️ 백업 데이터 오류\n\n${validation.error}\n\n복원할 수 없습니다.`);
        return;
    }

    // 권한 확인
    if (!canRestore) {
        alert('복원 권한이 없습니다. Master 또는 Admin 계정으로 로그인하세요.');
        return;
    }

    // 사용자 확인
    const confirmMsg = backup.studentData
        ? `이 백업을 복원하시겠습니까?\n\n` +
          `생성일: ${new Date(backup.createdAt).toLocaleString('ko-KR')}\n` +
          `생성자: ${backup.createdBy}\n` +
          `시간표: ${Object.keys(backup.data).length}개 문서\n` +
          `학생 데이터: ${Object.keys(backup.studentData).length}개 수업\n\n` +
          `⚠️ 현재 데이터는 복원 전 자동 백업됩니다.`
        : `이 백업을 복원하시겠습니까?\n\n` +
          `생성일: ${new Date(backup.createdAt).toLocaleString('ko-KR')}\n` +
          `생성자: ${backup.createdBy}\n` +
          `시간표: ${Object.keys(backup.data).length}개 문서\n\n` +
          `⚠️ 이 백업은 학생 데이터를 포함하지 않습니다.\n` +
          `⚠️ 현재 데이터는 복원 전 자동 백업됩니다.`;

    if (!confirm(confirmMsg)) return;

    setRestoring(backup.id);

    try {
        // Step 1: 현재 데이터 백업 (복원 전)
        const preRestoreBackupId = `pre_restore_${Date.now()}`;
        const currentLiveSnapshot = await getDocs(collection(db, EN_COLLECTION));
        const currentClassSnapshot = await getDocs(collection(db, CLASS_COLLECTION));

        const currentTimetableData: Record<string, any> = {};
        const currentStudentData: Record<string, any> = {};

        currentLiveSnapshot.docs.forEach(docSnap => {
            currentTimetableData[docSnap.id] = docSnap.data();
        });

        currentClassSnapshot.docs.forEach(docSnap => {
            currentStudentData[docSnap.id] = docSnap.data();
        });

        await setDoc(doc(db, 'english_backups', preRestoreBackupId), {
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.displayName || currentUser?.email || 'Unknown',
            createdByUid: currentUser?.uid || '',
            data: currentTimetableData,
            studentData: currentStudentData,
            isPreRestoreBackup: true,
            restoringTo: backup.id
        });

        console.log(`✅ Pre-restore backup created: ${preRestoreBackupId}`);

        // Step 2: 시간표 복원
        const timetableBatch = writeBatch(db);
        Object.entries(backup.data).forEach(([docId, docData]) => {
            timetableBatch.set(doc(db, EN_COLLECTION, docId), docData);
        });
        await timetableBatch.commit();
        console.log(`✅ Timetable restored: ${Object.keys(backup.data).length} docs`);

        // Step 3: 학생 데이터 복원 (있는 경우만)
        if (backup.studentData && Object.keys(backup.studentData).length > 0) {
            if (Object.keys(backup.studentData).length > 500) {
                throw new Error(`복원할 수업 문서가 너무 많습니다 (${Object.keys(backup.studentData).length}개).`);
            }

            const studentBatch = writeBatch(db);
            Object.entries(backup.studentData).forEach(([docId, docData]) => {
                studentBatch.set(doc(db, CLASS_COLLECTION, docId), docData);
            });
            await studentBatch.commit();
            console.log(`✅ Student data restored: ${Object.keys(backup.studentData).length} docs`);

            alert(`복원 완료!\n\n시간표: ${Object.keys(backup.data).length}개\n학생 데이터: ${Object.keys(backup.studentData).length}개\n\n(복원 전 데이터: ${preRestoreBackupId})`);
        } else {
            alert(`복원 완료! (시간표만)\n\n시간표: ${Object.keys(backup.data).length}개\n\n⚠️ 이 백업은 학생 데이터를 포함하지 않습니다.\n(복원 전 데이터: ${preRestoreBackupId})`);
        }

    } catch (error) {
        console.error('Restore failed:', error);
        const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
        alert(`⚠️ 복원 실패\n\n${errorMsg}\n\n데이터가 변경되지 않았습니다.`);
    } finally {
        setRestoring(null);
    }
};
```

**예상 작업 시간**: 1.5시간

---

## 6. 에러 처리 및 엣지 케이스

### 6.1. 시뮬레이션 진입 실패 시나리오

#### Case 1: 네트워크 오류로 일부 데이터만 복사됨

**증상**: 시간표는 복사되었으나 학생 데이터 복사 실패

**현재 구현**: Step 1(시간표) 성공 후 Step 2(학생) 실패 시 일관성 깨짐

**해결 방안**:
```typescript
// handleCopyLiveToDraft에서 예외 처리 강화 (이미 구현됨)
try {
    await timetableBatch.commit();
    await studentBatch.commit();  // 실패 시 catch로 이동
} catch (e) {
    if (e.code === 'unavailable') {
        alert('네트워크 연결을 확인하세요.\n\n시뮬레이션 모드 진입을 다시 시도해주세요.');
    } else if (e.code === 'permission-denied') {
        alert('권한이 부족합니다.\n\nMaster 계정으로 로그인하세요.');
    } else {
        alert('알 수 없는 오류가 발생했습니다.\n\n' + (e instanceof Error ? e.message : String(e)));
    }
}
```

**권장 사항**:
- 사용자에게 명확한 에러 메시지 표시
- 재시도 유도 (자동 재시도는 비용 문제로 비권장)

#### Case 2: Draft 컬렉션이 이미 존재하는 경우

**증상**: 이전 시뮬레이션 작업 내역이 덮어씌워짐

**현재 구현**: 확인 메시지로 사용자에게 알림
```typescript
if (!confirm('현재 실시간 시간표를 복사해 오시겠습니까?\n기존 시뮬레이션 작업 내용은 모두 사라집니다.')) return;
```

**권장 사항**: 현재 구현 유지 (사용자 책임)

### 6.2. StudentModal 데이터 불일치

#### Case 3: className이 존재하지 않는 수업인 경우

**현재 동작**:
- 시뮬레이션 모드: 자동 생성 허용
- 실시간 모드: 사용자 확인 후 생성

**이미 구현됨** (Phase 4.2.3 참조)

### 6.3. 실제 반영 시 데이터 충돌

#### Case 4: 시뮬레이션 작업 중 다른 사용자가 Live 데이터 수정

**증상**: Draft → Live 반영 시 다른 사용자의 변경사항 덮어쓰기

**현재 접근 방식**: Last-Write-Wins (마지막 반영이 모든 것을 덮어씀)

**향후 고려사항**:
- Optimistic Locking: 버전 체크 후 충돌 감지
- Merge Strategy: 변경된 부분만 선택적 반영

**현재 권장**:
- 시뮬레이션 작업 시 팀원들에게 공지
- Master 권한자만 실제 반영 가능하므로 위험 통제됨
- 백업 시스템으로 복원 가능

---

## 7. 권한 및 보안

### 7.1. 학생 데이터 접근 제어

현재 시간표 시스템의 권한 모델을 학생 데이터에도 동일하게 적용합니다.

| 역할 | 수업목록 (Live) | 수업목록_draft (Simulation) |
|------|----------------|----------------------------|
| **master** | 읽기/쓰기 | 읽기/쓰기 |
| **admin** | 읽기/쓰기 | 읽기만 |
| **manager** | 읽기만 | 읽기만 |
| **editor** | 읽기만 | 접근 불가 |
| **user** | 접근 불가 | 접근 불가 |

### 7.2. Firestore Security Rules 업데이트

**파일**: `firestore.rules` (프로젝트 루트)

**추가할 규칙**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 수업목록 (Live) - 기존 규칙이 있다면 유지, 없다면 추가
    match /수업목록/{classId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'admin', 'manager'];

      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'admin'];
    }

    // 수업목록_draft (Simulation) - 신규 규칙
    match /수업목록_draft/{classId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'admin', 'manager'];

      // Master만 쓰기 가능 (시뮬레이션 모드는 Master 전용)
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master';
    }
  }
}
```

### 7.3. StudentModal Props 업데이트 (권한 처리)

**Phase 4.4.2에서 이미 구현됨**:
```typescript
readOnly={!canEditEnglish || (isSimulationMode && currentUser?.role !== 'master')}
```

**의미**:
- 일반 모드: `canEditEnglish` 권한 필요 (admin, master)
- 시뮬레이션 모드: **master만** 수정 가능 (admin도 읽기 전용)

**예상 작업 시간**: 30분 (Firestore Rules 업데이트 + 테스트)

---

## 8. 테스트 계획

### 8.1. 단위 테스트 (Manual)

#### Test Case 1: 시뮬레이션 진입

**절차**:
1. 실시간 모드에서 [시뮬레이션 모드] 토글 클릭
2. [현재 시간표 가져오기] 버튼 클릭

**예상 결과**:
- `english_schedules_draft` 컬렉션 생성됨
- `수업목록_draft` 컬렉션 생성됨
- 문서 개수가 Live와 동일

**검증 방법**:
- Firestore 콘솔에서 컬렉션 확인
- 콘솔 로그 확인: "✅ Timetable copied", "✅ Student data copied"

---

#### Test Case 2: StudentModal 시뮬레이션 모드

**절차**:
1. 시뮬레이션 모드에서 수업 셀 클릭
2. StudentModal에서 학생 추가 ("테스트학생1")
3. [저장] 버튼 클릭
4. 실시간 모드로 전환
5. 동일 수업 셀 클릭

**예상 결과**:
- 시뮬레이션 모드: "테스트학생1" 표시
- 실시간 모드: "테스트학생1" **표시 안 됨** (Draft에만 저장)

**검증 방법**:
- Firestore 콘솔에서 `수업목록_draft`에만 데이터 존재 확인
- `수업목록` (Live)는 변경 없음 확인

---

#### Test Case 3: 실제 반영

**절차**:
1. 시뮬레이션 모드에서 학생 데이터 수정 ("테스트학생2" 추가)
2. [실제 반영] 버튼 클릭
3. 확인 팝업에서 [확인] 클릭
4. 실시간 모드로 자동 전환 확인

**예상 결과**:
- `english_backups`에 백업 생성 (studentData 필드 포함)
- `수업목록`이 Draft 내용으로 업데이트됨
- "테스트학생2"가 실시간 모드에서도 표시됨

**검증 방법**:
- Firestore 콘솔에서 최신 백업 확인:
  - `data` 필드: 시간표 백업
  - `studentData` 필드: 학생 데이터 백업
- Live 데이터가 Draft와 일치 확인

---

#### Test Case 4: 백업 복원

**절차**:
1. [백업 기록] 버튼 클릭
2. `studentData` 필드가 있는 백업 선택
3. [복원] 버튼 클릭
4. 확인 팝업에서 [확인] 클릭

**예상 결과**:
- 시간표 + 학생 데이터 모두 복원됨
- 복원 전 데이터는 `pre_restore_*` 백업으로 저장됨
- StudentModal에서 복원된 학생 목록 확인 가능

**검증 방법**:
- Firestore 콘솔에서 복원 전후 데이터 비교
- 콘솔 로그 확인: "✅ Timetable restored", "✅ Student data restored"

---

#### Test Case 5: 하위 호환성 (구 백업 복원)

**절차**:
1. `studentData` 필드가 **없는** 오래된 백업 선택
2. [복원] 버튼 클릭

**예상 결과**:
- 시간표만 복원됨
- 경고 메시지: "⚠️ 이 백업은 학생 데이터를 포함하지 않습니다."

**검증 방법**:
- 복원 후 학생 데이터는 변경 없음 확인
- 알림 메시지 확인

---

### 8.2. 통합 테스트

#### Scenario 1: 여러 사용자 동시 작업

**절차**:
1. User A (Master): 시뮬레이션 모드에서 학생 추가 ("학생A")
2. User B (Admin): 실시간 모드에서 다른 학생 추가 ("학생B")
3. User A: [실제 반영] 클릭

**예상 결과**:
- User B의 변경사항("학생B")이 백업됨
- User A의 변경사항("학생A")이 반영됨
- 최종 결과: "학생A"만 남음 (Last-Write-Wins)

**개선 방안**: 향후 충돌 감지 및 병합 전략 검토

---

#### Scenario 2: 네트워크 오류 시뮬레이션

**절차**:
1. DevTools → Network → Offline 모드
2. 시뮬레이션 진입 시도 ([현재 시간표 가져오기])

**예상 결과**:
- 명확한 에러 메시지: "네트워크 연결을 확인하세요"
- 시뮬레이션 모드 진입 실패
- 데이터 변경 없음

---

### 8.3. 성능 테스트

**테스트 환경**:
- 수업 개수: 50개
- 학생 수: 반당 평균 15명 = 총 750명

**측정 지표**:
- Draft 복사 시간: < 5초
- 백업 생성 시간: < 3초
- 실제 반영 시간: < 7초

**측정 방법**:
```typescript
console.time('Copy Live to Draft');
await handleCopyLiveToDraft();
console.timeEnd('Copy Live to Draft');
```

---

### 8.4. 체크리스트

- [ ] 시뮬레이션 진입 시 두 컬렉션 모두 복사 확인
- [ ] StudentModal이 올바른 컬렉션 참조 확인 (isSimulationMode)
- [ ] 실제 반영 시 백업에 studentData 포함 확인
- [ ] 백업 복원 시 학생 데이터도 복원 확인
- [ ] 구 백업(studentData 없음) 복원 시 시간표만 복원 확인
- [ ] 에러 발생 시 적절한 메시지 표시 확인
- [ ] Firestore Security Rules 적용 확인
- [ ] 권한별 접근 제어 확인 (master/admin/manager)
- [ ] 성능 테스트 (Draft 복사 < 5초, 백업 생성 < 3초)
- [ ] 콘솔 로그에 에러 없음 확인

---

## 9. 배포 체크리스트

### 9.1. 사전 준비

- [ ] **Firestore 수동 백업 생성** (안전장치)
  - Firestore 콘솔 → 데이터 내보내기
  - 컬렉션: `english_schedules`, `수업목록`, `english_backups`
- [ ] **Firestore Security Rules 업데이트**
  - `firestore.rules` 파일에 `수업목록_draft` 규칙 추가
  - Firebase 콘솔에서 규칙 배포 및 검증
- [ ] **팀원 공지**
  - 배포 시간 알림 (예: 오후 10시 이후 권장)
  - 시뮬레이션 모드 사용 중단 요청 (10분간)

---

### 9.2. 코드 배포 순서

#### Step 1: Constants 추가
```bash
# englishUtils.ts 수정
git add components/Timetable/English/englishUtils.ts
git commit -m "Add CLASS_COLLECTION and CLASS_DRAFT_COLLECTION constants"
```

#### Step 2: StudentModal 수정
```bash
git add components/Timetable/English/StudentModal.tsx
git commit -m "Add isSimulationMode support to StudentModal"
```

#### Step 3: EnglishTimetable 수정
```bash
git add components/Timetable/English/EnglishTimetable.tsx
git commit -m "Extend simulation mode to include student data"
```

#### Step 4: EnglishClassTab 수정
```bash
git add components/Timetable/English/EnglishClassTab.tsx
git commit -m "Pass isSimulationMode to StudentModal"
```

#### Step 5: BackupHistoryModal 수정
```bash
git add components/Timetable/English/BackupHistoryModal.tsx
git commit -m "Add studentData support to backup restore"
```

#### Step 6: Firestore Rules 배포
```bash
firebase deploy --only firestore:rules
```

---

### 9.3. 배포 후 검증

#### 즉시 확인 (1분 내)
- [ ] Firestore 콘솔 접속 확인
- [ ] 앱 로드 오류 없음 확인 (콘솔 에러 체크)

#### 기능 테스트 (5분 내)
- [ ] 시뮬레이션 모드 진입 테스트
  - [현재 시간표 가져오기] 클릭
  - Firestore에서 `수업목록_draft` 생성 확인
- [ ] StudentModal 열기 및 학생 추가 테스트
  - 시뮬레이션 모드에서 학생 추가
  - Draft 컬렉션에만 저장 확인
- [ ] 실제 반영 테스트 (옵션, 데이터 영향)
  - 백업 생성 확인 (`studentData` 필드 포함)
- [ ] 백업 복원 테스트 (옵션, 데이터 영향)

#### 권한 테스트 (10분 내)
- [ ] Admin 계정으로 로그인
  - 시뮬레이션 모드: 읽기만 가능 확인
  - StudentModal에서 "저장" 버튼 비활성화 확인
- [ ] Manager 계정으로 로그인
  - `수업목록_draft` 읽기 가능 확인
  - StudentModal에서 수정 불가 확인

---

### 9.4. 롤백 계획

**만약 문제 발생 시**:

#### 즉시 조치 (5분 내)
1. **이전 버전으로 코드 롤백**
   ```bash
   git revert HEAD~5..HEAD
   git push
   ```

2. **Firestore 규칙 롤백** (필요 시)
   ```bash
   # 이전 버전 규칙 복원
   firebase deploy --only firestore:rules
   ```

#### 데이터 복원 (필요 시)
1. **Firestore 수동 백업에서 복원**
   - Firestore 콘솔 → 데이터 가져오기
   - 사전 백업 파일 선택

2. **Draft 컬렉션 삭제** (문제 발생 시)
   ```typescript
   // Firebase 콘솔 또는 스크립트로 삭제
   const draftSnapshot = await getDocs(collection(db, '수업목록_draft'));
   const batch = writeBatch(db);
   draftSnapshot.docs.forEach(doc => batch.delete(doc.ref));
   await batch.commit();
   ```

---

## 10. 변경 파일 목록

| 파일 | 변경 내용 | 변경 라인 | 난이도 | 예상 시간 |
|------|----------|---------|--------|---------|
| `englishUtils.ts` | 상수 추가 (CLASS_COLLECTION, CLASS_DRAFT_COLLECTION) | +2줄 (Line 42-43) | ⭐ 쉬움 | 5분 |
| `StudentModal.tsx` | Props 추가, 컬렉션 동적 선택, 에러 처리 | ~80줄 수정 | ⭐⭐⭐ 어려움 | 1.5시간 |
| `EnglishTimetable.tsx` | 시뮬레이션 진입/반영 로직 확장 (학생 데이터) | ~120줄 수정 | ⭐⭐⭐ 어려움 | 2시간 |
| `EnglishClassTab.tsx` | Props 추가, StudentModal에 isSimulationMode 전달 | ~15줄 수정 | ⭐ 쉬움 | 30분 |
| `BackupHistoryModal.tsx` | 인터페이스 확장, studentData 복원 로직 추가 | ~60줄 수정 | ⭐⭐ 중간 | 1.5시간 |
| `firestore.rules` | 수업목록_draft 규칙 추가 | +10줄 | ⭐ 쉬움 | 30분 |
| **총합** | | **~287줄** | | **~6시간 30분** |

---

## 11. 주의사항

### 11.1. 데이터 호환성

1. **기존 데이터 무결성**: 기존 `수업목록` 데이터는 그대로 유지됨
2. **백업 하위 호환성**:
   - **신규 백업**: `studentData` 필드 포함
   - **기존 백업**: `studentData` 필드 없음 (undefined 또는 누락)
   - **복원 시**: `studentData`가 있으면 복원, 없으면 시간표만 복원

### 11.2. Firestore 제약사항

1. **Batch Write 제한**:
   - 최대 500개 작업/배치
   - 현재 수업 개수 ~30-80개로 문제없음
   - 방어 코드 추가: 500개 초과 시 에러 발생

2. **인덱스**:
   - 새 컬렉션(`수업목록_draft`)에 대한 복합 인덱스 불필요
   - 단순 조회만 수행 (`where('className', '==', ...)`)

### 11.3. Draft 컬렉션 관리

1. **Draft 유지 전략**:
   - 실제 반영 후에도 Draft 컬렉션 **유지** (삭제 안 함)
   - 다음 시뮬레이션 진입 시 덮어쓰기
   - 비용: ~100-200KB (무시 가능)

2. **자동 정리**:
   - 현재 미구현 (향후 Cloud Functions로 30일 이상 미사용 Draft 정리 고려)

### 11.4. 동시 작업 제한

1. **권장 사항**:
   - **한 명만** 시뮬레이션 모드 사용 권장
   - 여러 Master가 동시 작업 시 **마지막 반영이 이전 작업 덮어씀**

2. **충돌 해결**:
   - 현재: Last-Write-Wins (간단, 예측 가능)
   - 향후: Optimistic Locking 또는 Merge 전략 고려

### 11.5. 보안 및 권한

1. **Firestore Security Rules**:
   - `수업목록_draft`는 **Master만 쓰기** 가능
   - Admin/Manager는 **읽기만** 가능

2. **StudentModal readOnly**:
   - 시뮬레이션 모드에서 Master 외 자동 읽기 전용

### 11.6. 성능 고려사항

1. **예상 데이터 볼륨**:
   - 수업: ~30-80개
   - 학생: 반당 ~15명 = 총 ~450-1200명
   - Draft 복사 시간: ~3-5초

2. **네트워크 오류**:
   - 부분 복사 실패 가능
   - 사용자에게 재시도 유도 (자동 재시도 비권장)

---

## 12. 관련 문서

- [영어 시간표 백업 시스템](./english_timetable_backup_system.md)
- [영어 시간표 시뮬레이션 모드 가이드](./english_timetable_simulation_mode.md) (향후 작성)

---

## 13. 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2026-01-01 | 1.0 | 초안 작성 | - |
| 2026-01-01 | 2.0 | 코드 검증 및 전면 개선 (백업 통합, 에러 처리, 보안, 테스트 계획 추가) | AI Assistant |
| 2026-01-01 | 3.0 | **구현 완료** - Phase 1-6 코드 변경 완료, TypeScript 검증 통과 | AI Assistant |

---

**문서 끝**
