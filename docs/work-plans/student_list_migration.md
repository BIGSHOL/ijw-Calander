# Student List Migration Plan (Academy App -> IJW Calendar)

## 1. 개요 (Overview)
`academy-app`에서 사용 중인 '수업별 학생 명단(Student List)' 데이터를 `ijw-calander`로 이관하고, UI 상에 표시하는 기능에 대한 문서입니다.

**현재 상태**:
- ✅ 타입 정의 및 UI 컴포넌트 구현 완료
- ⏳ 데이터 마이그레이션 UI 구현 대기 중 (Section 7.3 참조)

## 2. 데이터 구조 분석 (Data Analysis)

### Academy App (Source)
- 위치: `matchedClassInfo._matchedStudents` (in `ClassColumn.jsx`)
- 구조:
  ```json
  [
    {
      "id": "student_123",
      "studentName": "홍길동",
      "school": "A초등학교",
      "grade": "초5"
    }
  ]
  ```
- 렌더링: `ClassColumn.jsx`에서 `viewMode`('hide'/'view')에 따라 학생 목록을 리스트 형태로 표시.

### IJW Calendar (Target)
- 위치: `TimetableClass` 인터페이스 내 `studentList` 속성 (in `types.ts`)
- 구조 (`TimetableStudent`):
  ```typescript
  export interface TimetableStudent {
    id: string;
    name: string;
    grade?: string;       // 학년
    school?: string;      // 학교
    personalSchedule?: { day: string; period: string }[];
  }
  ```

**분석 결과**: `academy-app`의 핵심 데이터(`studentName`, `school`, `grade`)가 `ijw-calander`의 `TimetableStudent` 구조와 완벽히 호환됩니다.

## 3. 구현 상태 (Implementation Status)

### ✅ Step 1: 타입 정의 (완료)
`TimetableStudent` 및 `TimetableClass` 인터페이스가 [types.ts:191-209](types.ts#L191-L209)에 정의되어 있습니다.

```typescript
export interface TimetableStudent {
  id: string;
  name: string;
  grade?: string;       // 학년
  school?: string;      // 학교
  personalSchedule?: { day: string; period: string }[];
}

export interface TimetableClass {
  id: string;
  className: string;
  teacher: string;
  room?: string;
  subject: string;
  schedule: string[];
  studentList: TimetableStudent[];  // ✅ 학생 목록
  color?: string;
  order?: number;
}
```

### ✅ Step 2: UI 컴포넌트 구현 (완료)
[StudentModal.tsx](components/Timetable/English/StudentModal.tsx)가 구현되어 다음 기능을 제공합니다:

- **주요 기능**:
  - 학생 목록 리스트 렌더링
  - 학생 추가/삭제 기능
  - 전체 삭제 기능
  - Firestore 실시간 동기화
  - 수업 자동 생성 (수업이 없는 경우)

### ✅ Step 3: 시간표 연동 (완료)
[EnglishClassTab.tsx](components/Timetable/English/EnglishClassTab.tsx)의 `ClassCard` 컴포넌트에서 학생 관리 UI가 연동되어 있습니다:

- 학생 수 실시간 표시
- "학생 관리" 버튼 클릭 시 `StudentModal` 오픈
- Firestore `수업목록` 컬렉션과 연동

## 4. 마이그레이션 전략 (Migration Strategy)

**계획된 방식**: `ijw-calander`에서 버튼 클릭을 통해 `academy-app`의 Firebase에 직접 접근하여 데이터를 가져옵니다.

### 구현 단계
1. **Connect**: `academy-app` Firebase 프로젝트 설정 정보 추가
2. **Extract**: `academy-app` Firestore에서 수업별 학생 데이터 읽기
3. **Transform**: 필드명 매핑 (`studentName` → `name`)
   ```javascript
   // 변환 예시
   {
     id: src.id,
     name: src.studentName,
     school: src.school,
     grade: src.grade,
   }
   ```
4. **Load**: `ijw-calander` Firestore `수업목록` 컬렉션의 `studentList` 필드에 업데이트

자세한 구현 방법은 **Section 7.3 (데이터 마이그레이션 UI 구현 필요)** 참조.

## 5. 검증 상태 (Verification Status)
- [x] `types.ts` 타입 정의 완료 - 빌드 에러 없음
- [x] `StudentModal` 컴포넌트 렌더링 검증 완료 (실제 구현됨)
- [ ] 학생 데이터 마이그레이션 테스트 (미완료 - Section 7.3 참조)
- [ ] 다른 과목(수학, 기타)에서의 재사용성 테스트 (미완료)

---

## 6. 코드 검증 결과 (Code Review Results)

### 6.1 타입 정의 검증 ✅
**파일**: [types.ts:191-197](d:\ijw-calander\types.ts#L191-L197)

현재 `TimetableStudent` 인터페이스는 다음과 같이 정의되어 있습니다:

```typescript
export interface TimetableStudent {
  id: string;
  name: string;
  grade?: string;       // 학년
  school?: string;      // 학교
  personalSchedule?: { day: string; period: string }[];
}
```

**검증 결과**:
- ✅ 기본 필드(`id`, `name`, `grade`, `school`)는 문서의 요구사항과 일치합니다.
- ⚠️ **문서에서 제안한 `isHidden` 필드가 아직 추가되지 않았습니다.**

**현재 `TimetableClass` 인터페이스**: [types.ts:199-209](d:\ijw-calander\types.ts#L199-L209)
```typescript
export interface TimetableClass {
  id: string;
  className: string;
  teacher: string;
  room?: string;
  subject: string;
  schedule: string[];
  studentList: TimetableStudent[];
  color?: string;
  order?: number;
}
```

- ✅ `studentList: TimetableStudent[]` 속성이 이미 정의되어 있습니다.

### 6.2 UI 컴포넌트 검증 ✅
**파일**: [StudentModal.tsx](d:\ijw-calander\components\Timetable\English\StudentModal.tsx)

**발견사항**:
- ✅ `StudentModal` 컴포넌트가 **이미 구현되어 있습니다**.
- ✅ 문서에서 제안한 기능들이 모두 구현됨:
  - 학생 목록 리스트 렌더링 (214-236줄)
  - 학생 추가 기능 (89-114줄)
  - 학생 삭제 기능 (117-128줄)
  - 전체 삭제 기능 (131-141줄)
  - Firestore 실시간 동기화 (74-86줄)

**구현 방식**:
- Firestore 컬렉션 `수업목록`에서 `className`으로 쿼리하여 해당 수업의 학생 목록을 가져옵니다.
- 수업이 없으면 자동으로 생성하는 로직이 포함되어 있습니다 (30-70줄).

### 6.3 시간표 연동 검증 ✅
**파일**: [EnglishClassTab.tsx](d:\ijw-calander\components\Timetable\English\EnglishClassTab.tsx)

**발견사항**:
- ✅ `ClassCard` 컴포넌트에서 학생 관리 UI가 이미 구현되어 있습니다 (649-669줄):
  - 학생 수 실시간 표시 (566-577줄)
  - "학생 관리" 버튼 클릭 시 `StudentModal` 오픈 (653-668줄)
  - `StudentModal` 컴포넌트 렌더링 (673-677줄)

**구현 코드**:
```typescript
// 실시간 학생 수 구독 (EnglishClassTab.tsx:566-577)
useEffect(() => {
    const q = query(collection(db, '수업목록'), where('className', '==', classInfo.name));
    const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            setStudentCount(snapshot.docs[0].data().studentList?.length || 0);
        }
    });
    return () => unsub();
}, [classInfo.name]);
```

### 6.4 Firestore 스키마 검증 ✅
**컬렉션 이름**: `수업목록` (한글)

**사용 파일**:
- [TimetableManager.tsx:238](d:\ijw-calander\components\Timetable\TimetableManager.tsx#L238)
- [EnglishClassTab.tsx:568](d:\ijw-calander\components\Timetable\English\EnglishClassTab.tsx#L568)
- [StudentModal.tsx:33](d:\ijw-calander\components\Timetable\English\StudentModal.tsx#L33)

**구조**:
```typescript
{
  id: string,
  className: string,
  teacher: string,
  subject: string,
  room: string,
  schedule: string[],
  studentList: TimetableStudent[],  // ← 학생 데이터 저장 위치
  order: number
}
```

- ✅ `studentList` 필드가 이미 Firestore 스키마에 포함되어 있습니다.
- ✅ 실시간 동기화(`onSnapshot`)가 구현되어 있습니다.

---

## 7. 보완사항 (Recommendations)

### 7.1 타입 정의 보완 (중요도: 중)
**파일**: [types.ts:191-197](d:\ijw-calander\types.ts#L191-L197)

문서에서 제안한 `isHidden` 필드가 아직 `TimetableStudent` 인터페이스에 추가되지 않았습니다. 하지만 **현재 구현된 `StudentModal`에서는 숨김 기능이 사용되지 않고 있습니다**.

**권장사항**:
- 향후 학생별 개인정보 보호 기능이 필요한 경우에만 추가하는 것을 권장합니다.
- 현재로서는 **선택적 구현 사항**입니다.

**적용 시 수정안**:
```typescript
export interface TimetableStudent {
  id: string;
  name: string;
  grade?: string;
  school?: string;
  isHidden?: boolean; // [New] 학생 명단 숨김 처리용
  personalSchedule?: { day: string; period: string }[];
}
```

### 7.2 StudentModal UI 개선 제안 (중요도: 하)

**현재 구현**: `StudentModal`은 영어 시간표(`EnglishClassTab`)에서만 사용되고 있습니다.

**제안사항**:
1. **재사용성 향상**: `StudentModal`을 `components/Timetable/components/` 폴더로 이동하여 다른 과목(수학, 기타)에서도 사용할 수 있도록 합니다.
2. **에러 핸들링 강화**: Firestore 쿼리 실패 시 사용자에게 명확한 피드백을 제공합니다.
3. **학생 정렬 기능**: 이름순, 학년순 정렬 옵션을 추가합니다.

### 7.3 데이터 마이그레이션 UI 구현 필요 (중요도: 높)

**구현 계획**: `ijw-calander`에서 **버튼 클릭**을 통해 `academy-app`의 Firebase에서 학생 데이터를 직접 가져오는 방식으로 이관합니다.

**구현 방향**:
1. **Firebase 연결**: `academy-app`이 사용하는 Firebase 프로젝트에 접근 권한 설정
2. **마이그레이션 UI**: 관리자 페이지 또는 설정 페이지에 "학생 데이터 가져오기" 버튼 추가
3. **데이터 변환 로직**:
   - `academy-app` Firestore에서 수업별 학생 데이터 읽기
   - 필드명 변환 (`studentName` → `name`)
   - `ijw-calander` Firestore `수업목록` 컬렉션에 `studentList` 업데이트

**예시 구현 구조**:
```typescript
// components/Admin/MigrationPanel.tsx
const handleMigrateStudents = async () => {
  try {
    // 1. academy-app Firebase에서 데이터 읽기
    const academyDb = getFirestore(academyApp); // 별도 Firebase 인스턴스
    const academyClassesSnapshot = await getDocs(collection(academyDb, 'classes'));

    // 2. 데이터 변환 및 이관
    for (const academyDoc of academyClassesSnapshot.docs) {
      const academyData = academyDoc.data();
      const transformedStudents = (academyData._matchedStudents || []).map(s => ({
        id: s.id,
        name: s.studentName,
        school: s.school,
        grade: s.grade,
      }));

      // 3. ijw-calander Firestore에 저장
      const q = query(collection(db, '수업목록'), where('className', '==', academyData.className));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, { studentList: transformedStudents });
        console.log(`✅ ${academyData.className} 학생 ${transformedStudents.length}명 이관 완료`);
      }
    }

    alert('학생 데이터 이관이 완료되었습니다.');
  } catch (error) {
    console.error('마이그레이션 실패:', error);
    alert('데이터 이관 중 오류가 발생했습니다.');
  }
};
```

**필요 작업**:
1. `academy-app` Firebase 프로젝트 설정 정보 추가 (`firebaseConfig`)
2. 마이그레이션 UI 컴포넌트 생성 (관리자 전용)
3. 진행 상황 표시 (로딩 바, 성공/실패 카운트)
4. 중복 방지 로직 (이미 이관된 데이터 덮어쓰기 여부 확인)

### 7.4 테스트 커버리지 부족 (중요도: 중)

**현재 상황**:
- 문서의 Section 5 "검증 계획"에 명시된 테스트들이 수행되지 않았습니다.
- 더미 데이터 테스트, 빌드 에러 확인 등이 필요합니다.

**권장사항**:
1. `StudentModal` 컴포넌트에 대한 유닛 테스트 작성
2. Firestore 연동 통합 테스트 작성
3. 에지 케이스 테스트 (수업이 없는 경우, 학생이 0명인 경우 등)

### 7.5 접근 권한 제어 (중요도: 낮 - 향후 검토)

**현재 구현**: 모든 사용자가 `StudentModal`을 통해 학생을 추가/삭제할 수 있습니다.

**현재 방침**: 당장은 권한 제어를 구현하지 않고, 향후 필요 시 추가합니다.

**향후 구현 시 참고사항**:
```typescript
// StudentModal.tsx에서 권한 체크 추가 (예시)
const { userRole } = useAuth();
const canEditStudents = ['master', 'admin', 'manager'].includes(userRole);

{canEditStudents && (
  <button onClick={handleAddStudent}>학생 추가</button>
)}
```

**Firestore Security Rules (예시)**:
```javascript
match /수업목록/{classId} {
  allow read: if true;
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'admin', 'manager'];
}
```

### 7.6 academy-app 원본 코드와의 비교 필요 (중요도: 중)

**현재 상황**:
- 문서에서 `ClassColumn.jsx`의 `viewMode` ('hide'/'view') 기능을 언급했으나, 현재 구현에서는 이 기능이 누락되었습니다.
- `academy-app`의 원본 코드를 직접 확인하지 못한 상태입니다.

**권장사항**:
- `academy-app/ClassColumn.jsx` 파일을 검토하여 누락된 기능이 있는지 확인
- 특히 학생 개인정보 보호 관련 `viewMode` 로직을 검증

---

## 8. 결론 (Conclusion)

### ✅ 구현 완료 사항
1. `TimetableStudent`, `TimetableClass` 타입 정의 완료
2. `StudentModal` 컴포넌트 구현 완료 (추가/삭제/전체삭제 기능)
3. `EnglishClassTab`에 학생 관리 UI 연동 완료
4. Firestore `수업목록` 컬렉션에 `studentList` 필드 적용 완료
5. 실시간 학생 수 표시 기능 구현 완료

### ⚠️ 보완 필요 사항
1. **데이터 마이그레이션 UI 미구현** (중요 - 우선 작업)
2. **`isHidden` 필드 미구현** (선택 사항)
3. **테스트 커버리지 부족**
4. **`StudentModal` 재사용성 개선 필요**
5. **academy-app 원본 코드와의 기능 비교 필요**
6. **접근 권한 제어 미흡** (향후 검토 - 당장 불필요)

### 우선순위 권장
1. **높음**: 데이터 마이그레이션 UI 구현 (버튼 클릭으로 academy-app Firebase에서 데이터 가져오기)
2. **중**: 테스트 코드 작성
3. **중**: academy-app 원본 코드 비교 검증
4. **하**: `StudentModal` 컴포넌트 위치 재조정 (재사용성 향상)
5. **하**: `isHidden` 필드 추가 (필요 시)
6. **보류**: 접근 권한 제어 (향후 필요 시 구현)

### 9.4 1�� ����� (2025-12-30) 
- **�̽�**: �̰� �� '0�� ����'���� ǥ�õǴ� ���� �߻�
- **����**: _matchedStudents �ʵ�� cademy-app���� Ŭ���̾�Ʈ ���̵�(useProcessedClasses hook)���� �����Ǵ� ������, Firestore ���� �����Ϳ��� �������� ����.
- **�ذ�**: MigrationPanel���� classes �÷��ǻӸ� �ƴ϶� students �÷��ǵ� �Բ� ��ȸ�Ͽ�, Ŭ���̾�Ʈ ���̵忡�� ����(Join)�ϵ��� ���� ���� �Ϸ�.
