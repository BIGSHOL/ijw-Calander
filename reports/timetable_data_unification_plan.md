# 시간표 데이터 통합 구현 계획서

> **문서 버전**: 2.2
> **작성일**: 2026-01-14
> **최종 수정**: 2026-01-14
> **작성자**: Antigravity AI Assistant
> **상태**: ✅ **Phase 2 구현 완료** (EnglishTeacherTab 통합)

---

## 📋 개요

### 목표
**수업관리 탭**의 `classes` 컬렉션을 **수학 시간표**와 **영어 시간표** 모두에서 단일 데이터 소스로 사용하면서, **기존 UI는 완전히 유지**합니다.

### 현재 상태

| 구분 | 데이터 소스 | 컬렉션 | 문서 구조 |
|------|-------------|--------|----------|
| 수학 시간표 | ✅ 통합됨 | `classes` | 수업별 문서 |
| 영어 시간표 | ❌ 분리됨 | `english_schedules` | 강사별 문서 (셀 기반) |
| 수업관리 탭 | ✅ 기준 | `classes` | 수업별 문서 |

### 최종 목표 상태

```
┌──────────────────────────────────────────────────────────────┐
│                    classes 컬렉션 (통합)                       │
│  • subject: 'math' | 'english'                               │
│  • schedule: [{ day, periodId }, ...]                        │
│  • studentIds: [...]                                         │
└──────────────────────────────────────────────────────────────┘
            │                             │
            ▼                             ▼
   ┌─────────────────┐          ┌───────────────────┐
   │  수학 시간표 뷰   │          │   영어 시간표 뷰    │
   │ (Teacher/Room)  │          │ (Teacher/Cell)    │
   │   변경 없음       │          │   변경 없음         │
   └─────────────────┘          └───────────────────┘
```

---

## 🔄 데이터 구조 변환

### AS-IS: english_schedules 컬렉션

```javascript
// english_schedules/{teacherName}
{
  "Teacher1-1-월": {
    className: "DP3",
    room: "영어실1",
    teacher: "Teacher1",
    underline: false,
    merged: []
  },
  "Teacher1-2-월": {
    className: "RTT4",
    room: "영어실2"
  },
  "Teacher1-1-화": {
    className: "DP3",
    room: "영어실1"
  }
}
```

**특징:**
- 강사별로 하나의 문서
- 셀 키 형식: `{강사}-{교시}-{요일}`
- 같은 수업이 여러 셀에 분산 저장

### TO-BE: classes 컬렉션

```javascript
// classes/{classId}
{
  className: "DP3",
  teacher: "Teacher1",
  subject: "english",
  room: "영어실1",
  isActive: true,
  schedule: [
    { day: "월", periodId: "1" },
    { day: "화", periodId: "1" }
  ],
  slotRooms: {
    "월-1": "영어실1",
    "화-1": "영어실1"
  },
  slotTeachers: {
    "월-1": "Teacher1",
    "화-1": "Teacher1"
  },
  studentIds: ["student1", "student2"],
  createdAt: "2026-01-14T...",
  updatedAt: "2026-01-14T..."
}
```

**특징:**
- 수업별로 하나의 문서
- `schedule` 배열에 모든 시간 슬롯 포함
- `slotRooms`/`slotTeachers`로 슬롯별 세부 정보 관리

---

## 📁 파일별 변경 계획

### Phase 1: 읽기(Read) 통합 ✅ 완료

| 파일 | 변경 내용 | 상태 |
|------|----------|------|
| `EnglishTimetable.tsx` | `useNewStructure` 기본값 `true`로 변경 | ✅ 완료 |

---

### Phase 2: 쓰기(Write) 통합 ✅ 완료

#### 2-1. `hooks/useEnglishClassUpdater.ts` ✅ v2.0 구현 완료

**목적**: 셀 기반 편집 → classes 문서 업데이트 변환

**제공 함수 (v2.0):**
```typescript
// 셀에 수업 배치 (새 수업 생성 또는 기존 수업 스케줄 추가) - merged 지원
assignCellToClass(cellKey: string, cellData: ScheduleCell): Promise<void>

// 셀에서 수업 제거 (스케줄에서 슬롯 삭제) - 합반 그룹도 함께 제거
removeCellFromClass(cellKey: string, className: string): Promise<void>

// 셀의 모든 수업 제거 (메인 + 합반 전체)
removeAllClassesFromCell(cellKey: string): Promise<void>

// 일괄 셀 편집
batchUpdateCells(updates: { key: string; data: ScheduleCell | null }[], currentScheduleData?: ScheduleData): Promise<void>

// 수업 이동 (소스 → 타겟) - merged 지원
moveClass(sourceKey: string, targetKey: string, className: string, room?: string, merged?: MergedClass[]): Promise<void>

// 선택적 수업 이동 (합반 수업 중 일부만 이동)
moveSelectedClasses(sourceKey: string, targetKey: string, classesToMove: ClassInfo[], classesToKeep: ClassInfo[]): Promise<void>
```

---

#### 2-2. `EnglishTeacherTab.tsx` ✅ 통합 완료

**실제 작업 시간**: 약 2시간

| 함수 | 현재 동작 | 변경 후 동작 | 상태 |
|------|----------|-------------|------|
| `handleBatchSave` | Feature Flag 분기 추가 | 새 구조: `assignCellToClass` / 레거시: 기존 로직 | ✅ 완료 |
| `handleBatchDelete` | Feature Flag 분기 추가 | 새 구조: `removeAllClassesFromCell` / 레거시: 기존 로직 | ✅ 완료 |
| `saveSplitDataToFirebase` | 레거시 전용으로 유지 | Feature Flag OFF 시에만 사용 | ✅ 유지 |
| `performMove` | Feature Flag 분기 추가 | 새 구조: `moveSelectedClasses` / 레거시: 기존 로직 | ✅ 완료 |
| `saveMoveChanges` | Feature Flag 분기 추가 | 새 구조: 상태만 리셋 / 레거시: 기존 저장 | ✅ 완료 |

##### 2-2-1. handleBatchSave 구현 예시

**Before:**
```typescript
const handleBatchSave = async () => {
  const updates: Record<string, Record<string, ScheduleCell>> = {};

  selectedCells.forEach(key => {
    const parsed = parseCellKey(key);
    if (!parsed) return;
    const { teacher } = parsed;
    if (!updates[teacher]) updates[teacher] = {};
    updates[teacher][key] = {
      className: inputData.className,
      room: inputData.room,
      note: inputData.note
    };
  });

  await saveSplitDataToFirebase(updates);
  setSelectedCells(new Set());
  setMode('view');
};
```

**After:**
```typescript
import { useEnglishClassUpdater } from '../../../hooks/useEnglishClassUpdater';

// 컴포넌트 내부
const { assignCellToClass } = useEnglishClassUpdater();

const handleBatchSave = async () => {
  try {
    // 순차 처리로 batch 충돌 방지
    for (const key of selectedCells) {
      await assignCellToClass(key, {
        className: inputData.className,
        room: inputData.room,
        note: inputData.note
      });
    }

    toast.success(`${selectedCells.size}개 셀 저장 완료`);
    setSelectedCells(new Set());
    setMode('view');

    // React Query가 자동으로 캐시 무효화 및 리렌더링 처리
  } catch (error) {
    console.error('셀 저장 실패:', error);
    toast.error('저장 중 오류가 발생했습니다');
  }
};
```

##### 2-2-2. handleBatchDelete 구현 예시

**Before:**
```typescript
const handleBatchDelete = async () => {
  const updates: Record<string, string[]> = {};

  selectedCells.forEach(key => {
    const parsed = parseCellKey(key);
    if (!parsed) return;
    const { teacher } = parsed;
    if (!updates[teacher]) updates[teacher] = [];
    updates[teacher].push(key);
  });

  // 각 강사 문서에서 셀 키 삭제
  for (const [teacher, keys] of Object.entries(updates)) {
    const docRef = doc(db, EN_COLLECTION, teacher);
    const deleteUpdates: Record<string, any> = {};
    keys.forEach(k => deleteUpdates[k] = deleteField());
    await updateDoc(docRef, deleteUpdates);
  }
};
```

**After:**
```typescript
const { removeCellFromClass } = useEnglishClassUpdater();

const handleBatchDelete = async () => {
  if (!confirm(`${selectedCells.size}개 셀을 삭제하시겠습니까?`)) return;

  try {
    for (const key of selectedCells) {
      // 현재 셀의 className 가져오기
      const cellData = scheduleData[key];
      if (cellData?.className) {
        await removeCellFromClass(key, cellData.className);
      }
    }

    toast.success(`${selectedCells.size}개 셀 삭제 완료`);
    setSelectedCells(new Set());
    setMode('view');
  } catch (error) {
    console.error('셀 삭제 실패:', error);
    toast.error('삭제 중 오류가 발생했습니다');
  }
};
```

##### 2-2-3. performMove 구현 예시

**Before:**
```typescript
const performMove = async (sourceKey: string, targetKey: string) => {
  const sourceData = scheduleData[sourceKey];
  if (!sourceData) return;

  // 로컬 상태 업데이트
  setScheduleData(prev => {
    const next = { ...prev };
    next[targetKey] = { ...sourceData };
    delete next[sourceKey];
    return next;
  });

  // 나중에 saveMoveChanges로 저장
  setPendingMoves(prev => [...prev, { source: sourceKey, target: targetKey }]);
};
```

**After:**
```typescript
const { moveClass } = useEnglishClassUpdater();

const performMove = async (sourceKey: string, targetKey: string) => {
  const sourceData = scheduleData[sourceKey];
  if (!sourceData?.className) return;

  try {
    // 즉시 Firestore에 반영 (React Query가 UI 자동 업데이트)
    await moveClass(
      sourceKey,
      targetKey,
      sourceData.className,
      sourceData.room
    );

    toast.success('수업 이동 완료');
    setMode('view');
  } catch (error) {
    console.error('수업 이동 실패:', error);
    toast.error('이동 중 오류가 발생했습니다');
  }
};
```

**변경 전략:**
1. `useEnglishClassUpdater` 훅 import
2. `targetCollection` prop 대신 훅 함수 사용
3. 로컬 상태 업데이트는 React Query 캐시 무효화로 자동 처리
4. `saveSplitDataToFirebase`, `saveMoveChanges` 함수 완전 제거

---

#### 2-3. `LevelUpConfirmModal.tsx`

**예상 작업 시간**: 1시간

| 현재 | 변경 후 |
|------|--------|
| `english_schedules`의 className 필드 수정 | `classes` 문서의 className 필드 수정 |

**변경 사항:**
```typescript
// 현재
const schedulesRef = collection(db, EN_COLLECTION);
batch.update(doc(db, EN_COLLECTION, docSnap.id), updates);

// 변경 후
const classesRef = query(
  collection(db, 'classes'),
  where('subject', '==', 'english'),
  where('className', '==', oldClassName)
);
// 해당 문서의 className 업데이트
```

---

#### 2-4. `BackupHistoryModal.tsx`

**예상 작업 시간**: 1시간

| 현재 | 변경 후 |
|------|--------|
| `english_schedules` 전체 백업/복원 | `classes` 컬렉션의 영어 수업만 백업/복원 |

**필터 조건:**
```typescript
const englishClasses = query(
  collection(db, 'classes'),
  where('subject', '==', 'english'),
  where('isActive', '==', true)
);
```

---

#### 2-5. `EnglishTimetable.tsx` (시뮬레이션 관련)

**예상 작업 시간**: 2시간

| 함수 | 현재 | 변경 |
|------|------|------|
| `handleCopyLiveToDraft` | `english_schedules` → `english_schedules_draft` | `classes`에서 영어 수업 복사 → 별도 드래프트 필드 또는 컬렉션 |
| `handlePublishDraft` | `english_schedules_draft` → `english_schedules` | 드래프트 → `classes` 반영 |

> [!WARNING]
> 시뮬레이션 모드는 별도 설계 검토 필요. 현재 draft 컬렉션 방식을 유지할지, classes 문서 내 draft 필드로 변경할지 결정 필요.

---

### Phase 3: 마이그레이션 스크립트

**예상 작업 시간**: 2시간

**파일**: `scripts/migrate_english_schedules_to_classes.ts`

```typescript
// 마이그레이션 로직 개요
1. english_schedules 컬렉션의 모든 문서 조회
2. 셀 데이터를 className별로 그룹화
3. 각 그룹에 대해:
   a. classes 컬렉션에 새 문서 생성
   b. schedule 배열 구성
   c. slotRooms/slotTeachers 맵 구성
4. 검증: 변환 전후 셀 수 일치 확인
```

---

## 🔀 합반(Merged) 수업 처리 전략

### 현재 상태

영어 시간표에서 한 셀에 여러 수업이 합반될 수 있음:

```javascript
// english_schedules에서 합반 수업
"Teacher1-1-월": {
  className: "DP3",           // 메인 수업
  room: "영어실1",
  merged: [                   // 합반 수업 목록
    { className: "RTT4", room: "영어실2" },
    { className: "LT1a", room: "영어실3" }
  ]
}
```

### 변환 전략: 독립 문서 + classGroupId

합반 수업은 각각 별도 classes 문서로 생성하고, `classGroupId`로 그룹 관계를 표현합니다.

```javascript
// classes 컬렉션에서 합반 수업 (3개 문서)

// 메인 수업 (리더)
{
  id: "class_001",
  className: "DP3",
  teacher: "Teacher1",
  subject: "english",
  schedule: [{ day: "월", periodId: "1" }],
  classGroupId: "group_Teacher1-1-월",  // 그룹 식별자
  isGroupLeader: true,
  groupMembers: ["class_002", "class_003"],
  room: "영어실1"
}

// 합반 멤버 1
{
  id: "class_002",
  className: "RTT4",
  teacher: "Teacher1",
  subject: "english",
  schedule: [{ day: "월", periodId: "1" }],
  classGroupId: "group_Teacher1-1-월",
  isGroupLeader: false,
  room: "영어실2"
}

// 합반 멤버 2
{
  id: "class_003",
  className: "LT1a",
  teacher: "Teacher1",
  subject: "english",
  schedule: [{ day: "월", periodId: "1" }],
  classGroupId: "group_Teacher1-1-월",
  isGroupLeader: false,
  room: "영어실3"
}
```

### useEnglishClassUpdater.ts 확장

```typescript
/**
 * 합반 수업 포함 셀 배치
 */
const assignCellToClass = async (cellKey: string, cellData: ScheduleCell) => {
  const parsed = parseCellKey(cellKey);
  if (!parsed || !cellData.className) return;

  const { teacher, periodId, day } = parsed;
  const slotKey = `${day}-${periodId}`;
  const groupId = `group_${cellKey}`;

  // 1. 메인 수업 생성/업데이트
  const mainClassId = await upsertClass(cellData.className, teacher, slotKey, cellData.room);

  // 2. 합반 수업 처리
  if (cellData.merged && cellData.merged.length > 0) {
    const memberIds: string[] = [];

    for (const mergedClass of cellData.merged) {
      const memberId = await upsertClass(
        mergedClass.className,
        teacher,
        slotKey,
        mergedClass.room,
        { classGroupId: groupId, isGroupLeader: false }
      );
      memberIds.push(memberId);
    }

    // 메인 수업에 그룹 정보 업데이트
    await updateDoc(doc(db, COL_CLASSES, mainClassId), {
      classGroupId: groupId,
      isGroupLeader: true,
      groupMembers: memberIds,
      updatedAt: new Date().toISOString()
    });
  }

  queryClient.invalidateQueries({ queryKey: ['classes'] });
};
```

### UI 표시 로직

```typescript
// EnglishTeacherTab.tsx에서 합반 셀 렌더링
const renderCell = (cellKey: string, cellData: ScheduleCell) => {
  // classes에서 해당 셀의 그룹 수업 조회
  const groupClasses = classes.filter(c =>
    c.classGroupId === `group_${cellKey}`
  );

  if (groupClasses.length > 1) {
    const leader = groupClasses.find(c => c.isGroupLeader);
    const members = groupClasses.filter(c => !c.isGroupLeader);

    return (
      <div className="merged-cell">
        <div className="leader font-bold">{leader?.className}</div>
        {members.map(c => (
          <div key={c.id} className="member text-xs text-gray-500">
            + {c.className}
          </div>
        ))}
      </div>
    );
  }

  return <div>{cellData.className}</div>;
};
```

---

## 🔄 마이그레이션 및 롤백 전략

### Phase 3-1: 마이그레이션 준비

#### 사전 백업 (필수)

```bash
# 1. Firebase Console에서 Firestore 백업 생성
# Firestore > 데이터 > 내보내기

# 2. 로컬 JSON 백업 (스크립트)
npm run backup:create -- --collections english_schedules,classes --output ./backups/pre-migration-$(date +%Y%m%d).json
```

#### 검증 환경 구축

1. Firebase 프로젝트 복제 (Dev 환경)
2. Dev 환경에서 먼저 마이그레이션 실행
3. 검증 체크리스트 통과 후 Production 실행

### Phase 3-2: 마이그레이션 스크립트 상세

**파일**: `scripts/migrate_english_schedules_to_classes.ts`

```typescript
import {
  collection, getDocs, doc, setDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface MigrationTransaction {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed' | 'rolled_back';
  changes: ChangeRecord[];
  stats: {
    sourceDocCount: number;
    sourceCellCount: number;
    targetDocCount: number;
    targetSlotCount: number;
  };
}

interface ChangeRecord {
  type: 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  before?: any;
  after?: any;
}

async function migrate(options: {
  dryRun: boolean;
  rollbackOnError: boolean;
  verbose: boolean;
}) {
  const transaction: MigrationTransaction = {
    id: `migration_${Date.now()}`,
    startTime: new Date(),
    status: 'running',
    changes: [],
    stats: { sourceDocCount: 0, sourceCellCount: 0, targetDocCount: 0, targetSlotCount: 0 }
  };

  console.log(`[${transaction.id}] 마이그레이션 시작...`);

  try {
    // 1. 소스 데이터 스냅샷 저장
    const sourceSnapshot = await saveSnapshot('pre-migration', transaction.id);
    transaction.stats.sourceDocCount = sourceSnapshot.docCount;
    transaction.stats.sourceCellCount = sourceSnapshot.cellCount;

    console.log(`  - 소스: ${sourceSnapshot.docCount}개 문서, ${sourceSnapshot.cellCount}개 셀`);

    // 2. 셀 데이터를 className별로 그룹화
    const classGroups = groupCellsByClassName(sourceSnapshot.data);
    console.log(`  - ${Object.keys(classGroups).length}개 수업 그룹 생성`);

    // 3. classes 컬렉션에 문서 생성
    const batch = writeBatch(db);
    let docCount = 0;
    let slotCount = 0;

    for (const [className, cells] of Object.entries(classGroups)) {
      const classDoc = convertToClassDocument(className, cells);

      if (options.dryRun) {
        console.log(`  [DRY RUN] 생성 예정: ${className}`);
        if (options.verbose) console.log(JSON.stringify(classDoc, null, 2));
      } else {
        const docRef = doc(collection(db, 'classes'));
        batch.set(docRef, classDoc);

        transaction.changes.push({
          type: 'create',
          collection: 'classes',
          docId: docRef.id,
          after: classDoc
        });
      }

      docCount++;
      slotCount += classDoc.schedule.length;
    }

    transaction.stats.targetDocCount = docCount;
    transaction.stats.targetSlotCount = slotCount;

    // 4. Batch 커밋
    if (!options.dryRun) {
      await batch.commit();
      console.log(`  - ${docCount}개 문서 생성 완료`);
    }

    // 5. 검증
    const validation = await validateMigration(transaction);

    if (!validation.success) {
      throw new Error(`검증 실패: ${validation.errors.join(', ')}`);
    }

    // 6. 완료
    transaction.status = 'success';
    transaction.endTime = new Date();

    await saveTransactionLog(transaction);

    console.log(`[${transaction.id}] 마이그레이션 성공!`);
    console.log(`  - 소스: ${transaction.stats.sourceCellCount}개 셀`);
    console.log(`  - 타겟: ${transaction.stats.targetDocCount}개 문서, ${transaction.stats.targetSlotCount}개 슬롯`);

    return transaction;

  } catch (error) {
    console.error(`[${transaction.id}] 마이그레이션 실패:`, error);
    transaction.status = 'failed';
    transaction.endTime = new Date();

    if (options.rollbackOnError && !options.dryRun) {
      console.log(`  - 자동 롤백 시작...`);
      await rollback(transaction);
      transaction.status = 'rolled_back';
    }

    await saveTransactionLog(transaction);
    throw error;
  }
}

// 검증 함수
async function validateMigration(transaction: MigrationTransaction): Promise<{
  success: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // 1. 셀 수 일치 검증
  if (transaction.stats.sourceCellCount !== transaction.stats.targetSlotCount) {
    errors.push(
      `셀 수 불일치: 소스 ${transaction.stats.sourceCellCount} ≠ 타겟 ${transaction.stats.targetSlotCount}`
    );
  }

  // 2. 각 수업별 데이터 무결성 검증
  // (추가 검증 로직...)

  return {
    success: errors.length === 0,
    errors
  };
}
```

### Phase 3-3: 롤백 절차

#### ✅ UI 기반 즉시 롤백 (이미 구현됨)

**설정 > 마이그레이션 탭**에 이미 롤백 UI가 구현되어 있습니다.

**파일**: `components/Settings/MigrationTab.tsx`

```
롤백 방법:
1. 설정 > 마이그레이션 탭 이동
2. "데이터 구조 전환" 토글 OFF
3. 페이지 새로고침 확인 팝업에서 "확인"
→ 즉시 기존 english_schedules 데이터로 복원
```

**UI 롤백의 장점:**
- ⚡ **즉시 복원**: 토글 1번으로 기존 데이터 구조로 전환
- 🔒 **데이터 보존**: 기존 데이터(`english_schedules`, `수업목록`)는 삭제되지 않고 보존
- 🔄 **캐시 자동 무효화**: `classes`, `students`, `enrollments` 캐시 자동 리프레시
- 👤 **비개발자도 가능**: 스크립트 실행 없이 UI에서 직접 롤백

> [!TIP]
> **리스크 재평가**: UI 롤백이 이미 있으므로 실제 마이그레이션 리스크는 기존 평가보다 **낮습니다**.
>
> | 리스크 | 기존 평가 | 실제 |
> |--------|----------|------|
> | 데이터 손실 | 높음 | **낮음** (기존 데이터 보존) |
> | 롤백 복잡도 | 중간 | **매우 낮음** (토글 1번) |

---

#### 자동 롤백 조건 (마이그레이션 스크립트용)

- 변환 후 검증 실패
- 데이터 무결성 체크 실패
- 셀 수 불일치 (소스 셀 수 ≠ 타겟 슬롯 수)

#### 롤백 스크립트 (스크립트 마이그레이션 시)

```typescript
async function rollback(transaction: MigrationTransaction) {
  console.log(`[Rollback] 트랜잭션 ${transaction.id} 롤백 시작...`);

  const batch = writeBatch(db);

  // 생성된 문서 삭제 (역순)
  for (const change of [...transaction.changes].reverse()) {
    if (change.type === 'create') {
      batch.delete(doc(db, change.collection, change.docId));
      console.log(`  - 삭제: ${change.collection}/${change.docId}`);
    }
  }

  await batch.commit();
  console.log(`[Rollback] 완료`);
}
```

#### 수동 롤백 방법 (긴급)

```bash
# 1. 긴급 Feature Flag OFF
# 브라우저 콘솔에서:
localStorage.setItem('ijw_use_new_data_structure', 'false');

# 2. 마이그레이션 롤백 스크립트 실행
npm run rollback:migration -- --transaction-id migration_1705200000000

# 3. Firebase Console에서 백업 복원 (최후 수단)
# Firestore > 가져오기/내보내기 > 가져오기

# 4. 검증
npm run verify:rollback
```

#### 롤백 검증 체크리스트

- [ ] `english_schedules` 문서 수 원복 확인
- [ ] 모든 셀 키 존재 확인
- [ ] UI에서 시간표 정상 표시 확인
- [ ] 편집 기능 정상 동작 확인

---

## 🚀 Feature Flag 기반 점진적 롤아웃 전략

### 현재 구현 상태 ✅

```typescript
// utils/localStorage.ts (이미 구현됨)
export const STORAGE_KEYS = {
  USE_NEW_DATA_STRUCTURE: 'ijw_use_new_data_structure',
};

// EnglishTimetable.tsx (이미 구현됨)
const useNewStructure = storage.getBoolean(
  STORAGE_KEYS.USE_NEW_DATA_STRUCTURE,
  true  // 현재 기본값: true
);
```

### 롤아웃 단계

#### Stage 1: 개발자 테스트 (1-2일)

**대상**: 개발팀
**설정**: localStorage에서 수동 토글

```javascript
// 브라우저 콘솔에서 활성화
localStorage.setItem('ijw_use_new_data_structure', 'true');

// 비활성화 (구 버전)
localStorage.setItem('ijw_use_new_data_structure', 'false');
```

**검증**: Phase 4 체크리스트 전체 통과

#### Stage 2: 내부 사용자 (3-5일)

**대상**: 관리자 계정 (role: 'master')
**설정**: 역할 기반 자동 활성화

```typescript
// EnglishTimetable.tsx 수정
const useNewStructure = currentUser?.role === 'master'
  ? true
  : storage.getBoolean(STORAGE_KEYS.USE_NEW_DATA_STRUCTURE, false);
```

**모니터링**:
- 콘솔 에러 추적
- 사용자 피드백 수집
- Firestore 읽기/쓰기 비용 모니터링

#### Stage 3: 점진적 전체 롤아웃 (1주)

**대상**: 모든 사용자
**방법**: 기본값을 `true`로 변경

```typescript
// 현재 이미 true로 설정됨
const useNewStructure = storage.getBoolean(
  STORAGE_KEYS.USE_NEW_DATA_STRUCTURE,
  true  // 기본값 true
);
```

**모니터링**:
- 페이지 로딩 시간 변화
- 사용자 오류 보고
- Firestore 비용 증가율

#### Stage 4: 레거시 제거

**조건**: 2주 동안 오류 없음
**작업**:
1. `english_schedules` 컬렉션 아카이브
2. Feature Flag 관련 코드 제거
3. 레거시 컴포넌트/함수 삭제

### 긴급 롤백 플래그

```javascript
// 전체 사용자 즉시 구 버전으로 복귀 (브라우저 콘솔)
localStorage.setItem('ijw_use_new_data_structure', 'false');
```

---

## ✅ Phase별 검증 체크리스트

### Phase 2 Exit Criteria (EnglishTeacherTab 통합 완료 기준)

#### 기능 검증 (100% 통과 필수)

- [ ] 셀 선택 → 배치 → Firestore 저장 → UI 반영 (2초 이내)
- [ ] 10개 셀 동시 편집 → 저장 완료 (5초 이내)
- [ ] 수업 이동 → 소스 삭제 + 타겟 생성 확인
- [ ] 합반 수업 배치 → 그룹 문서 생성 확인
- [ ] 셀 삭제 → classes 스케줄에서 슬롯 제거 확인

#### 성능 검증

- [ ] 시간표 초기 로딩: 3초 이내 (강사 10명, 수업 50개 기준)
- [ ] 셀 저장 응답 시간: 1초 이내
- [ ] Firestore 읽기 비용: 기존 대비 150% 이하

#### 회귀 테스트

- [ ] 수학 시간표 기능 100% 정상
- [ ] 수업관리 탭 CRUD 정상
- [ ] 학생-수업 연결 정상

#### 코드 품질

- [ ] TypeScript 에러 0개
- [ ] ESLint 경고 0개

**통과 조건**: 모든 항목 ✅
**실패 시**: Phase 2 재작업, Phase 3 진행 불가

---

### Phase 3 Exit Criteria (마이그레이션 완료 기준)

#### 데이터 검증 (100% 통과 필수)

- [ ] 소스 셀 수 = 타겟 슬롯 수
- [ ] 모든 className 존재 확인
- [ ] 합반 수업 그룹 관계 정상

#### 기능 검증

- [ ] 수업관리 탭에서 영어 수업 조회 정상
- [ ] 영어 시간표에서 모든 셀 표시 정상
- [ ] 편집/삭제/이동 정상 동작

---

### Phase 4: 최종 검증 체크리스트

#### 기능 테스트

- [ ] 수업관리 탭에서 영어 수업 추가 → 영어 시간표에 즉시 반영
- [ ] 영어 시간표에서 셀에 수업 배치 → 수업관리 탭에 반영
- [ ] 영어 시간표에서 셀 삭제 → 수업관리 탭에서 스케줄 업데이트
- [ ] 영어 시간표에서 수업 이동 → 양쪽 탭 동기화
- [ ] 레벨업 기능 정상 동작
- [ ] 백업/복원 정상 동작
- [ ] 합반 수업 표시 및 편집 정상

#### 성능 테스트

- [ ] 시간표 로딩 시간 (기존 대비 비교)
- [ ] 셀 편집 저장 시간
- [ ] 대량 셀 편집 시 성능

#### 회귀 테스트

- [ ] 수학 시간표 기존 기능 정상 동작
- [ ] 학생 관리 탭 연동 유지

---

## ⚠️ 리스크 및 대응

| 리스크 | 영향 | 대응 방안 |
|--------|------|----------|
| merged 수업 처리 복잡성 | 중 | `classGroupId` 기반 그룹화, UI에서 리더/멤버 구분 표시 |
| 마이그레이션 중 데이터 손실 | **낮음** ✅ | 기존 데이터 보존 + UI 토글로 즉시 롤백 가능 (`MigrationTab.tsx`) |
| 실시간 리스너 성능 저하 | 중 | `subject` 필터링으로 쿼리 최적화 |
| 기존 코드와의 충돌 | 낮음 | Feature Flag로 점진적 롤아웃 (Stage 1-4) |
| 롤백 시 데이터 불일치 | **낮음** ✅ | UI 토글 OFF → 기존 `english_schedules` 즉시 사용 |

> [!NOTE]
> **리스크 재평가**: `설정 > 마이그레이션 탭`의 토글 기능으로 인해 데이터 손실 및 롤백 리스크가 **대폭 감소**했습니다. 기존 데이터는 삭제되지 않고 보존되며, 문제 발생 시 토글 1번으로 즉시 기존 구조로 복원할 수 있습니다.

---

## 📊 모니터링 및 알림 전략

### 마이그레이션 중 모니터링

#### 실시간 메트릭

1. **진행률 표시**
   - 처리된 문서 수 / 전체 문서 수
   - 예상 완료 시간

2. **오류율**
   - 정상: 0%
   - 경고: 1% 이상 → 즉시 중단

3. **성능 지표**
   - 문서당 처리 시간
   - Firestore 쓰기 횟수

#### 알림 설정

```typescript
// 마이그레이션 스크립트에 진행률 알림 추가
const notifyProgress = (stage: string, progress: number, total: number) => {
  const percent = Math.round((progress / total) * 100);

  if (percent % 25 === 0) {
    console.log(`[Migration] ${stage}: ${percent}% 완료 (${progress}/${total})`);
  }
};

const notifyError = (error: Error, context: string) => {
  console.error(`🚨 [Migration ERROR] ${context}`);
  console.error(error.message);
  console.error(error.stack);
};
```

### 마이그레이션 후 모니터링 (1주일)

#### 일일 체크

- [ ] Firestore 비용 확인 (Firebase Console > 사용량)
- [ ] 콘솔 에러 확인 (브라우저 개발자 도구)
- [ ] 사용자 피드백 수집

#### 주간 리뷰

- [ ] 데이터 무결성 재검증
- [ ] 성능 메트릭 추이 분석
- [ ] 레거시 시스템 제거 가능 여부 판단

---

## 📅 구현 일정 (예상)

| 단계 | 작업 | 예상 시간 | 누적 |
|------|------|----------|------|
| 1 | 읽기 통합 | ✅ 완료 | - |
| 2 | useEnglishClassUpdater 개선 (merged 처리) | 2시간 | 2시간 |
| 3 | EnglishTeacherTab 통합 | 4시간 | 6시간 |
| 4 | LevelUpConfirmModal 수정 | 1시간 | 7시간 |
| 5 | 마이그레이션 스크립트 (롤백 포함) | 3시간 | 10시간 |
| 6 | BackupHistoryModal 수정 | 1시간 | 11시간 |
| 7 | 시뮬레이션 모드 수정 | 2시간 | 13시간 |
| 8 | 통합 테스트 및 검증 | 2시간 | 15시간 |

**총 예상 작업 시간**: 약 15시간 (3-4일)

> [!NOTE]
> 기존 12시간 추정에서 3시간 추가됨:
> - merged 수업 처리 로직 (+2시간)
> - 롤백 메커니즘 구현 (+1시간)

---

## 🎯 권장 실행 순서

1. **사전 준비**
   - [ ] Firestore 백업 생성
   - [ ] Dev 환경 구축

2. **Phase 2: EnglishTeacherTab 통합**
   - [ ] useEnglishClassUpdater merged 처리 확장
   - [ ] handleBatchSave 변경
   - [ ] handleBatchDelete 변경
   - [ ] performMove 변경
   - [ ] Phase 2 Exit Criteria 검증

3. **Phase 3: 마이그레이션**
   - [ ] Dev 환경에서 Dry Run 3회
   - [ ] Production 마이그레이션 실행
   - [ ] Phase 3 Exit Criteria 검증

4. **부가 기능 수정**
   - [ ] LevelUpConfirmModal 수정
   - [ ] BackupHistoryModal 수정
   - [ ] 시뮬레이션 모드 수정

5. **최종 검증 및 롤아웃**
   - [ ] Phase 4 체크리스트 전체 통과
   - [ ] Stage 1-4 롤아웃 진행

6. **레거시 제거** (안정화 후 2주)
   - [ ] english_schedules 컬렉션 아카이브
   - [ ] Feature Flag 코드 제거

---

## 📚 참조 파일

| 파일 경로 | 설명 |
|----------|------|
| `hooks/useEnglishClassUpdater.ts` | 새로 생성된 어댑터 훅 |
| `hooks/useClasses.ts` | 수업 데이터 조회 훅 |
| `components/Timetable/English/EnglishTimetable.tsx` | 영어 시간표 메인 컴포넌트 |
| `components/Timetable/English/EnglishTeacherTab.tsx` | 강사별 시간표 탭 |
| `components/Timetable/Math/hooks/useTimetableClasses.ts` | 수학 시간표 데이터 훅 |
| `components/Settings/MigrationTab.tsx` | **UI 롤백 토글** (설정 > 마이그레이션) |
| `scripts/migrateToUnifiedClasses_v2.ts` | 기존 마이그레이션 참조 |
| `utils/localStorage.ts` | Feature Flag 스토리지 |

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2026-01-14 | 초안 작성 |
| 2.0 | 2026-01-14 | 세부사항 보완: 롤백 전략, Before/After 코드 예시, merged 처리, Feature Flag 롤아웃, Exit Criteria 추가 |
| 2.1 | 2026-01-14 | UI 롤백 메커니즘 추가: `MigrationTab.tsx` 토글 기반 즉시 롤백, 리스크 재평가 (데이터 손실/롤백 → 낮음) |
| 2.2 | 2026-01-14 | **Phase 2 구현 완료**: `useEnglishClassUpdater.ts` v2.0 (merged 처리, moveSelectedClasses 추가), `EnglishTeacherTab.tsx` Feature Flag 기반 분기 구현 (handleBatchSave, handleBatchDelete, performMove, saveMoveChanges 통합) |
