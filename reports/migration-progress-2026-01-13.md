# 데이터 구조 통일 마이그레이션 진행 보고서

**작성일**: 2026-01-13
**커밋 해시**: 92e3f5d

---

## 📋 요약

영어와 수학 시간표의 데이터 구조를 통일하고, 교시별 강사/강의실 설정 기능을 완성했습니다.

---

## ✅ 완료된 작업

### 1. 교시별 강사/강의실 데이터 구조 완성

#### 수정된 파일:
- `hooks/useClasses.ts`
- `hooks/useClassMutations.ts`
- `components/ClassManagement/AddClassModal.tsx`
- `components/ClassManagement/EditClassModal.tsx`
- `components/ClassManagement/ClassDetailModal.tsx`
- `components/Timetable/English/EnglishTimetable.tsx`

#### 주요 변경사항:

**1) ClassInfo 인터페이스 확장** (`useClasses.ts`)
```typescript
export interface ClassInfo {
    id: string;
    className: string;
    teacher: string;
    subject: SubjectType;
    schedule?: string[];
    studentCount?: number;
    assistants?: string[];
    room?: string;
    slotTeachers?: Record<string, string>;  // 추가
    slotRooms?: Record<string, string>;     // 추가
}
```

**2) Firestore 읽기/쓰기 로직 수정**

`useClasses.ts` - `fetchClassesFromUnifiedCollection`:
```typescript
return {
    id: doc.id,
    className: data.className || '',
    teacher: data.teacher || '',
    subject: data.subject || 'math',
    schedule: scheduleStrings,
    studentCount: data.studentIds?.length || 0,
    assistants: data.assistants,
    room: data.room,
    slotTeachers: data.slotTeachers,  // 추가
    slotRooms: data.slotRooms,        // 추가
};
```

`useClassMutations.ts` - `useCreateClass`:
```typescript
const classDoc: any = {
    className,
    teacher,
    subject,
    schedule: scheduleSlots,
    legacySchedule: schedule,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

if (room) classDoc.room = room;
if (slotTeachers && Object.keys(slotTeachers).length > 0)
    classDoc.slotTeachers = slotTeachers;
if (slotRooms && Object.keys(slotRooms).length > 0)
    classDoc.slotRooms = slotRooms;

await addDoc(collection(db, COL_CLASSES), classDoc);
```

`useClassMutations.ts` - `useUpdateClass`:
```typescript
// slotTeachers와 slotRooms는 항상 업데이트 (빈 객체도 저장하여 기존 데이터 삭제 가능)
if (slotTeachers !== undefined) {
    updatePayload.slotTeachers = slotTeachers;
}
if (slotRooms !== undefined) {
    updatePayload.slotRooms = slotRooms;
}
```

**3) EditClassModal에서 기존 데이터 로딩**

```typescript
useEffect(() => {
    if (classInfo.schedule && classInfo.schedule.length > 0) {
        const slots = new Set<string>();
        classInfo.schedule.forEach(item => {
            const parts = item.split(' ');
            if (parts.length >= 2) {
                const day = parts[0];
                const periodId = parts[1];
                slots.add(`${day}-${periodId}`);
            }
        });
        setSelectedSlots(slots);
    }

    // 기존 slotTeachers 데이터 로드
    if (classInfo.slotTeachers) {
        setSlotTeachers(classInfo.slotTeachers);
    }

    // 기존 slotRooms 데이터 로드
    if (classInfo.slotRooms) {
        setSlotRooms(classInfo.slotRooms);
    }
}, [classInfo.schedule, classInfo.slotTeachers, classInfo.slotRooms]);
```

**4) 강사 색상 반영**

`AddClassModal.tsx`, `EditClassModal.tsx`, `ClassDetailModal.tsx`에 추가:
```typescript
const { data: teachersData } = useTeachers();

const getTeacherColor = (teacherName: string) => {
    const teacherInfo = teachersData?.find(t => t.name === teacherName);
    return {
        bgColor: teacherInfo?.bgColor || '#fdb813',
        textColor: teacherInfo?.textColor || '#081429'
    };
};

// 스케줄 그리드에서 사용
const slotTeacher = slotTeachers[key];
const displayTeacher = slotTeacher || teacher;
const colors = displayTeacher ? getTeacherColor(displayTeacher) :
    { bgColor: '#fdb813', textColor: '#081429' };

<button
    style={isSelected ? {
        backgroundColor: colors.bgColor,
        color: colors.textColor
    } : undefined}
>
    {isSelected ? (slotTeacher || teacher || '✓') : ''}
</button>
```

**5) EnglishTimetable 데이터 로딩 수정**

```typescript
cls.schedule.forEach((slot: any) => {
    const slotKey = `${slot.day}-${slot.periodId}`;
    const slotTeacher = cls.slotTeachers?.[slotKey] || cls.teacher;
    const slotRoom = cls.slotRooms?.[slotKey] || cls.room || slot.room;

    const key = `${slotTeacher}-${slot.periodId}-${slot.day}`;
    scheduleData[key] = {
        className: cls.className,
        room: slotRoom,
        teacher: slotTeacher
    };
});
```

---

## 🐛 해결된 버그

### 1. 교시별 강사 설정이 저장되지 않는 문제
- **원인**: `useCreateClass`에서 `slotTeachers` 데이터를 Firestore에 저장하지 않음
- **해결**: `classDoc` 객체에 `slotTeachers`, `slotRooms` 추가

### 2. 수업 편집 시 기존 교시별 데이터가 로드되지 않는 문제
- **원인**:
  - `ClassInfo` 인터페이스에 `slotTeachers`, `slotRooms` 필드 없음
  - `EditClassModal`에서 기존 데이터를 state에 로드하지 않음
- **해결**:
  - `ClassInfo` 인터페이스에 필드 추가
  - `useEffect`에서 `classInfo.slotTeachers`, `classInfo.slotRooms` 로드

### 3. 수업이 시간표에 표시되지 않는 문제
- **원인**: `useCreateClass`가 `classes` 컬렉션에 문서를 생성하지 않음 (enrollments만 생성)
- **해결**: `addDoc(collection(db, COL_CLASSES), classDoc)` 추가

### 4. 학생 수 요구사항으로 인한 저장 실패
- **해결**: 학생 수 검증 제거, 교시 선택만 필수로 변경

### 5. 강사 색상이 반영되지 않는 문제
- **해결**: `useTeachers` 훅과 `getTeacherColor` 함수 추가

---

## ⚠️ 발견된 문제

### 1. 레거시 수업이 `classes` 컬렉션에 없음

**증상**:
```
[useUpdateClass] Found 0 classes in unified collection
[useUpdateClass] Found 1 enrollments to update
```

**원인**:
- 이전 버전 코드로 생성된 수업들은 `enrollments`만 있고 `classes` 컬렉션에 문서가 없음
- 수업 편집 시 `slotTeachers`, `slotRooms` 데이터를 저장할 곳이 없음

**영향**:
- 교시별 강사/강의실 설정이 저장되지 않음
- 새로운 데이터 구조의 이점을 활용할 수 없음

**해결 방안**:
1. **임시 방안**: 수업을 삭제하고 "수업 추가" 모달로 다시 생성
2. **영구 방안**: 마이그레이션 스크립트 작성 (권장)

---

## 🔄 다음 단계: 마이그레이션 필요

### 작업 내용

`enrollments`에만 존재하는 레거시 수업들을 `classes` 컬렉션으로 마이그레이션하는 스크립트 작성

### 마이그레이션 로직 (의사코드)

```typescript
// 1. enrollments에서 모든 수업 추출 (className + subject로 그룹화)
const enrollmentsSnapshot = await getDocs(collectionGroup(db, 'enrollments'));
const classMap = new Map<string, ClassData>();

enrollmentsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const key = `${data.subject}_${data.className}`;

    if (!classMap.has(key)) {
        classMap.set(key, {
            className: data.className,
            teacher: data.teacher || data.teacherId,
            subject: data.subject,
            schedule: data.schedule,
            studentIds: []
        });
    }

    const studentId = doc.ref.parent.parent?.id;
    if (studentId) {
        classMap.get(key).studentIds.push(studentId);
    }
});

// 2. classes 컬렉션에서 이미 존재하는 수업 확인
const classesSnapshot = await getDocs(collection(db, 'classes'));
const existingClasses = new Set<string>();

classesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const key = `${data.subject}_${data.className}`;
    existingClasses.add(key);
});

// 3. 없는 수업만 classes 컬렉션에 추가
for (const [key, classData] of classMap.entries()) {
    if (!existingClasses.has(key)) {
        const scheduleSlots = classData.schedule.map(s => {
            const [day, periodId] = s.split(' ');
            return { day, periodId };
        });

        await addDoc(collection(db, 'classes'), {
            className: classData.className,
            teacher: classData.teacher,
            subject: classData.subject,
            schedule: scheduleSlots,
            legacySchedule: classData.schedule,
            studentIds: classData.studentIds,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        console.log(`✅ Migrated: ${classData.className} (${classData.subject})`);
    }
}
```

---

## 📊 현재 데이터 구조

### classes 컬렉션 (통일된 구조)

```typescript
{
    className: string;           // "DP2"
    teacher: string;             // "정유진"
    subject: 'math' | 'english'; // "english"
    schedule: ScheduleSlot[];    // [{ day: "월", periodId: "4" }, ...]
    legacySchedule: string[];    // ["월 4", "월 5", ...]
    room?: string;               // "301"
    slotTeachers?: {             // { "월-4": "Kristine", "금-4": "Kristine" }
        [key: string]: string;
    };
    slotRooms?: {                // { "월-4": "302", "금-4": "301" }
        [key: string]: string;
    };
    studentIds: string[];        // ["student_id_1", "student_id_2"]
    isActive: boolean;           // true
    createdAt: string;           // ISO timestamp
    updatedAt: string;           // ISO timestamp
}
```

### enrollments 서브컬렉션 (레거시 호환용)

```
students/{studentId}/enrollments/{enrollmentId}
{
    className: string;
    teacher: string;
    subject: 'math' | 'english';
    schedule: string[];
    updatedAt: string;
}
```

---

## 🧪 테스트 체크리스트

- [x] 수업 추가 시 `classes` 컬렉션에 문서 생성 확인
- [x] 교시별 강사 설정이 Firestore에 저장 확인
- [x] 교시별 강의실 설정이 Firestore에 저장 확인
- [x] 수업 편집 시 기존 교시별 데이터 로드 확인
- [x] 강사 색상이 시간표 그리드에 반영 확인
- [ ] 레거시 수업 마이그레이션 스크립트 작성 및 실행
- [ ] 마이그레이션 후 모든 수업이 정상 표시되는지 확인
- [ ] 학생 등록/이동 기능 정상 작동 확인

---

## 📝 작업 이력

| 날짜 | 작업 | 커밋 |
|------|------|------|
| 2026-01-13 | 교시별 강사/강의실 데이터 구조 완성 | 92e3f5d |
| 2026-01-13 | 수업 추가/편집 모달에 강사 색상 반영 | 92e3f5d |
| 2026-01-13 | EditClassModal 데이터 로딩 수정 | 92e3f5d |

---

## 🔧 다른 컴퓨터에서 작업 재개 시

### 1. 코드 동기화
```bash
git pull origin main
npm install  # 혹시 모를 의존성 업데이트
```

### 2. 현재 상태 확인
```bash
# Firestore 데이터 확인 (브라우저에서)
# - classes 컬렉션에 수업이 몇 개나 있는지
# - enrollments에만 있는 수업이 있는지
```

### 3. 다음 작업
- [ ] 마이그레이션 스크립트 작성 (`scripts/migrateEnrollmentsToClasses.ts`)
- [ ] Firestore 백업
- [ ] 마이그레이션 실행
- [ ] 시간표에서 모든 수업 정상 표시 확인
- [ ] 교시별 강사/강의실 편집 테스트

---

## 🚨 주의사항

1. **마이그레이션 전 반드시 Firestore 백업**
2. **로컬에서 먼저 테스트** (개발 Firestore 프로젝트 사용)
3. **MigrationTab의 토글 상태 확인** (useNewDataStructure가 true인지)
4. **마이그레이션 스크립트는 멱등성 보장** (여러 번 실행해도 안전하게)

---

## 💡 참고 링크

- 계획 파일: `C:\Users\user\.claude\plans\polymorphic-crafting-penguin.md`
- 기존 문서: `reports/classes-collection-migration-plan-v2.md`
- Firestore 구조: 위 "현재 데이터 구조" 섹션 참조
