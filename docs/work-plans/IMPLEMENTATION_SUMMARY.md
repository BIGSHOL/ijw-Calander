# 학생 데이터 시뮬레이션 모드 - 구현 요약

> 작성일: 2026-01-01
> 상태: ✅ 구현 완료
> 구현일: 2026-01-01
> 관련 문서: [student_data_simulation_mode.md](./student_data_simulation_mode.md)

---

## 📊 개요

### 목표
시간표 시뮬레이션 모드와 동일하게 학생 데이터도 Draft 컬렉션으로 분리하여, 시뮬레이션 작업이 실제 데이터에 영향을 주지 않도록 합니다.

### 예상 작업 시간
**총 6시간 30분** (테스트 포함 시 8-9시간)

---

## 🎯 핵심 변경 사항

### 1. 새 Firestore 컬렉션
- `수업목록_draft`: 시뮬레이션 모드용 학생 데이터

### 2. 수정 파일 (총 6개)
| 파일 | 변경 라인 | 난이도 | 시간 |
|------|---------|--------|------|
| `englishUtils.ts` | +2 | ⭐ 쉬움 | 5분 |
| `StudentModal.tsx` | ~80 | ⭐⭐⭐ 어려움 | 1.5시간 |
| `EnglishTimetable.tsx` | ~120 | ⭐⭐⭐ 어려움 | 2시간 |
| `EnglishClassTab.tsx` | ~15 | ⭐ 쉬움 | 30분 |
| `BackupHistoryModal.tsx` | ~60 | ⭐⭐ 중간 | 1.5시간 |
| `firestore.rules` | +10 | ⭐ 쉬움 | 30분 |

---

## 📝 단계별 구현 가이드

### Phase 1: Constants 추가 (5분)

**파일**: `components/Timetable/English/englishUtils.ts`

**Line 42-43에 추가**:
```typescript
export const CLASS_COLLECTION = '수업목록';
export const CLASS_DRAFT_COLLECTION = '수업목록_draft';
```

---

### Phase 2: StudentModal 수정 (1.5시간)

**파일**: `components/Timetable/English/StudentModal.tsx`

#### 1) Props 추가 (Line 9-16)
```typescript
interface StudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    className: string;
    teacher?: string;
    currentUser: any;
    readOnly?: boolean;
    isSimulationMode?: boolean;  // 추가
}
```

#### 2) Import 추가 (Line 4)
```typescript
import { CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
```

#### 3) 컴포넌트 시그니처 수정 (Line 18)
```typescript
const StudentModal: React.FC<StudentModalProps> = ({
    isOpen,
    onClose,
    className,
    teacher,
    currentUser,
    readOnly = false,
    isSimulationMode = false  // 추가
}) => {
```

#### 4) useEffect 수정 (Line 55-102)
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
                // 자동 생성 로직 (시뮬레이션 vs 실시간 모드 분기)
                if (isSimulationMode) {
                    // 시뮬레이션: 자동 생성
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
                    // 실시간: 사용자 확인
                    const confirmed = confirm(
                        `⚠️ "${className}" 수업이 수업목록에 없습니다.\n\n` +
                        `새로 생성하시겠습니까?\n(취소 시 모달이 닫힙니다)`
                    );
                    if (!confirmed) {
                        onClose();
                        return;
                    }
                    // 생성 로직 (동일)
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

#### 5) 리스너 수정 (Line 113-124)
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
        if (error.code === 'permission-denied') {
            alert('데이터 접근 권한이 없습니다.');
        } else if (error.code === 'unavailable') {
            alert('네트워크 연결을 확인해주세요.');
        }
    });

    return () => unsub();
}, [classDocId, isSimulationMode]);
```

#### 6) 저장 로직 수정 (Line 128-155)
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

---

### Phase 3: EnglishTimetable 수정 (2시간)

**파일**: `components/Timetable/English/EnglishTimetable.tsx`

#### 1) Import 추가 (Line 4)
```typescript
import { EN_COLLECTION, EN_DRAFT_COLLECTION, CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from './englishUtils';
```

#### 2) handleCopyLiveToDraft 수정 (Line 148-169)
**기존 코드를 다음으로 교체**:
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

#### 3) handlePublishDraftToLive 수정 (Line 171-258)
**기존 백업 생성 부분 (Line 180-201)을 다음으로 교체**:
```typescript
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
```

**Draft → Live 복사 부분 (Line 209-221) 다음에 추가**:
```typescript
// Step 3: Draft → Live 복사 (학생 데이터) - 신규 추가
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
```

---

### Phase 4: EnglishClassTab 수정 (30분)

**파일**: `components/Timetable/English/EnglishClassTab.tsx`

#### 1) Props 인터페이스 수정 (Line 26-32)
```typescript
interface EnglishClassTabProps {
    teachers: string[];
    scheduleData: ScheduleData;
    teachersData?: Teacher[];
    classKeywords?: ClassKeywordColor[];
    currentUser: any;
    isSimulationMode?: boolean;  // 추가
}
```

#### 2) 컴포넌트 시그니처 수정 (Line 50)
```typescript
const EnglishClassTab: React.FC<EnglishClassTabProps> = ({
    teachers,
    scheduleData,
    teachersData = [],
    classKeywords = [],
    currentUser,
    isSimulationMode = false  // 추가
}) => {
```

#### 3) StudentModal 호출 수정 (하단 부분)
**기존 StudentModal 렌더링을 찾아서 수정**:
```typescript
<StudentModal
    isOpen={isStudentModalOpen}
    onClose={() => setIsStudentModalOpen(false)}
    className={selectedClass}
    teacher={selectedTeacher}
    currentUser={currentUser}
    readOnly={!canEditEnglish || (isSimulationMode && currentUser?.role !== 'master')}
    isSimulationMode={isSimulationMode}  // 추가
/>
```

---

### Phase 5: EnglishTimetable → EnglishClassTab Props 전달 (10분)

**파일**: `components/Timetable/English/EnglishTimetable.tsx`

**EnglishClassTab 렌더링 부분을 찾아서 수정** (Line 300-350 추정):
```typescript
<EnglishClassTab
    teachers={sortedTeachers}
    scheduleData={scheduleData}
    teachersData={teachersData}
    classKeywords={classKeywords}
    currentUser={currentUser}
    isSimulationMode={isSimulationMode}  // 추가
/>
```

---

### Phase 6: BackupHistoryModal 수정 (1.5시간)

**파일**: `components/Timetable/English/BackupHistoryModal.tsx`

#### 1) Import 추가 (Line 4)
```typescript
import { EN_COLLECTION, CLASS_COLLECTION } from './englishUtils';
```

#### 2) 인터페이스 수정 (Line 7-15)
```typescript
interface BackupEntry {
    id: string;
    createdAt: string;
    createdBy: string;
    createdByUid: string;
    data: Record<string, any>;
    studentData?: Record<string, any>;  // 추가 (Optional for backward compatibility)
    isPreRestoreBackup?: boolean;
    restoringTo?: string;
}
```

#### 3) handleRestore 함수 찾아서 수정 (Line 120-180 추정)
**복원 로직 전체를 다음으로 교체**:
```typescript
const handleRestore = async (backup: BackupEntry) => {
    const validation = validateBackupData(backup);
    if (!validation.isValid) {
        alert(`⚠️ 백업 데이터 오류\n\n${validation.error}\n\n복원할 수 없습니다.`);
        return;
    }

    if (!canRestore) {
        alert('복원 권한이 없습니다. Master 또는 Admin 계정으로 로그인하세요.');
        return;
    }

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

---

### Phase 7: Firestore Security Rules 업데이트 (30분)

**파일**: `firestore.rules` (프로젝트 루트)

**기존 규칙에 추가**:
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

**배포 명령**:
```bash
firebase deploy --only firestore:rules
```

---

## ✅ 테스트 시나리오 (필수)

### Test 1: 시뮬레이션 진입
1. 시뮬레이션 모드 토글 ON
2. [현재 시간표 가져오기] 클릭
3. ✅ Firestore에서 `수업목록_draft` 생성 확인

### Test 2: StudentModal 시뮬레이션
1. 시뮬레이션 모드에서 수업 셀 클릭
2. 학생 추가 → 저장
3. ✅ `수업목록_draft`에만 저장됨
4. 실시간 모드로 전환 → 학생 없음 확인

### Test 3: 실제 반영
1. 시뮬레이션 모드에서 학생 추가
2. [실제 반영] 클릭
3. ✅ `english_backups`에 `studentData` 포함 확인
4. ✅ `수업목록`에 학생 반영 확인

### Test 4: 백업 복원
1. 백업 기록 모달 열기
2. `studentData` 있는 백업 선택 → 복원
3. ✅ 시간표 + 학생 데이터 모두 복원 확인

---

## ⚠️ 주의사항

### 배포 전 필수 작업
1. **Firestore 백업 생성** (안전장치)
   - Firestore 콘솔 → 데이터 내보내기
   - 컬렉션: `english_schedules`, `수업목록`, `english_backups`

2. **팀원 공지**
   - 배포 시간 알림
   - 시뮬레이션 모드 사용 중단 요청 (10분간)

### 롤백 계획
문제 발생 시:
```bash
git revert HEAD~6..HEAD
git push
firebase deploy --only firestore:rules
```

---

## 📚 참고 문서

- 전체 상세 문서: [student_data_simulation_mode.md](./student_data_simulation_mode.md)
- 백업 시스템: [english_timetable_backup_system.md](./english_timetable_backup_system.md)

---

**✅ 구현 완료 체크리스트**

- [x] 문서 검토 완료
- [x] Phase 1: Constants 추가 (`englishUtils.ts`)
- [x] Phase 2: StudentModal 수정
- [x] Phase 3: EnglishTimetable 수정
- [x] Phase 4: EnglishClassTab 수정
- [x] Phase 5: Props 전달 연결
- [x] Phase 6: BackupHistoryModal 수정
- [ ] Phase 7: Firestore Security Rules (수동 배포 필요)
- [ ] 테스트 실행

**구현 완료!** 🎉
