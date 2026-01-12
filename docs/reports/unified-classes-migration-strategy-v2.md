# 통합 Classes 컬렉션 재마이그레이션 전략 v2

## 문서 정보
- 작성일: 2026-01-13
- 버전: 2.0
- 상태: 계획 단계
- 이전 시도: v1 실패 (합반 수업 키 충돌)

---

## 1. 문제 분석

### 1.1 이전 마이그레이션 실패 원인

**핵심 문제**: 합반 수업(Merged Classes)의 키 충돌

```
[CONFLICT] LT1b is overwriting LT1a key: Ellen-2-화
[CONFLICT] PL6 is overwriting LT1a key: LAB-3-목
```

#### 원인 상세 분석

**기존 english_schedules 구조** (정상 작동):
```json
{
  "Ellen-2-화": {
    "className": "LT1a",
    "room": "302",
    "teacher": "Ellen",
    "merged": [
      {
        "className": "LT1b",
        "room": "302"
      }
    ]
  }
}
```

**v1 마이그레이션 후 classes 컬렉션**:
```json
// Document 1
{
  "id": "english_LT1a_Ellen",
  "className": "LT1a",
  "schedule": [
    {"day": "화", "periodId": "2", "teacher": "Ellen"}
  ]
}

// Document 2 (별도 문서로 분리)
{
  "id": "english_LT1b_Ellen",
  "className": "LT1b",
  "schedule": [
    {"day": "화", "periodId": "2", "teacher": "Ellen"}  // 동일한 시간!
  ]
}
```

**scheduleData 생성 시 문제**:
```typescript
// useEnglishClasses.ts에서 scheduleData 생성
scheduleData["Ellen-2-화"] = { className: "LT1a", ... }  // 먼저 저장
scheduleData["Ellen-2-화"] = { className: "LT1b", ... }  // 덮어씀! ❌
```

**결과**: LT1a가 시간표에서 사라짐

### 1.2 합반 수업의 특성

1. **동일 시간, 동일 강사**: 여러 클래스가 같은 시간에 같은 강사와 수업
2. **정상적인 비즈니스 로직**: 버그가 아닌 학원의 실제 운영 방식
3. **빈도**: 영어 시간표에 다수 존재 (LT1a+LT1b, PL6+LT1a 등)

---

## 2. 해결 방안 비교

### 방안 A: Composite Key 전략 (강사-교시-요일-클래스명)

**개념**: 키에 클래스명까지 포함시켜 고유성 보장

```typescript
scheduleData["Ellen-2-화-LT1a"] = { className: "LT1a", ... }
scheduleData["Ellen-2-화-LT1b"] = { className: "LT1b", ... }
```

**장점**:
- ✅ 구현 간단
- ✅ 키 충돌 완전 해결

**단점**:
- ❌ 기존 `english_schedules`의 `merged` 배열 개념과 불일치
- ❌ 합반 관계를 추론하기 어려움 (단순 키만으로는 LT1a와 LT1b가 합반인지 알 수 없음)
- ❌ 시간표 UI에서 합반 표시 로직 복잡

**평가**: 2/5 ⭐⭐

---

### 방안 B: Class Group Field (classGroupId) ⭐ **권장**

**개념**: 합반 수업을 명시적으로 그룹화

```typescript
interface UnifiedClass {
  id: string;
  className: string;
  subject: string;
  teacher: string;
  room: string;
  schedule: ScheduleSlot[];

  // 합반 수업 필드 추가
  classGroupId?: string;        // 합반 식별자 (예: "Ellen-2")
  isGroupLeader?: boolean;      // 대표 클래스 여부
  groupMembers?: string[];      // 합반 클래스 ID 배열 (선택)
}
```

**예시 데이터**:
```json
// LT1a (대표 클래스)
{
  "id": "english_LT1a_Ellen",
  "className": "LT1a",
  "subject": "english",
  "teacher": "Ellen",
  "room": "302",
  "schedule": [
    {"day": "화", "periodId": "2"}
  ],
  "classGroupId": "Ellen-2",
  "isGroupLeader": true,
  "groupMembers": ["english_LT1a_Ellen", "english_LT1b_Ellen"]
}

// LT1b (멤버 클래스)
{
  "id": "english_LT1b_Ellen",
  "className": "LT1b",
  "subject": "english",
  "teacher": "Ellen",
  "room": "302",
  "schedule": [
    {"day": "화", "periodId": "2"}
  ],
  "classGroupId": "Ellen-2",
  "isGroupLeader": false
}
```

**scheduleData 생성 로직 수정**:
```typescript
// useEnglishClasses.ts
const scheduleData: Record<string, ScheduleCell> = {};

allClasses.forEach(cls => {
  cls.schedule?.forEach(slot => {
    const key = `${cls.teacher}-${slot.periodId}-${slot.day}`;

    if (cls.classGroupId && !cls.isGroupLeader) {
      // 멤버 클래스는 merged 배열에 추가
      if (scheduleData[key]) {
        if (!scheduleData[key].merged) {
          scheduleData[key].merged = [];
        }
        scheduleData[key].merged.push({
          className: cls.className,
          room: cls.room
        });
      }
    } else {
      // 대표 클래스 또는 단독 클래스
      scheduleData[key] = {
        className: cls.className,
        room: cls.room,
        teacher: cls.teacher,
        merged: []
      };
    }
  });
});
```

**장점**:
- ✅ 합반 관계 명시적 표현
- ✅ 기존 `merged` 배열 개념과 호환
- ✅ UI 로직 변경 최소화
- ✅ 쿼리 효율적 (classGroupId 인덱스)
- ✅ 미래 확장성 (그룹별 통계, 출석 등)

**단점**:
- ⚠️ 마이그레이션 스크립트 복잡도 증가
- ⚠️ 필드 추가로 인한 데이터 크기 소폭 증가

**평가**: 5/5 ⭐⭐⭐⭐⭐

---

### 방안 C: Virtual Class with References

**개념**: 합반 수업은 가상 클래스로 관리하고 실제 클래스는 참조

```typescript
// 가상 합반 클래스
{
  "id": "virtual_Ellen-2-화",
  "isVirtual": true,
  "classGroupId": "Ellen-2",
  "realClassIds": ["english_LT1a_Ellen", "english_LT1b_Ellen"],
  "schedule": [{"day": "화", "periodId": "2"}]
}

// 실제 클래스들
{
  "id": "english_LT1a_Ellen",
  "className": "LT1a",
  "virtualClassId": "virtual_Ellen-2-화"
}
```

**장점**:
- ✅ 관심사 분리 (스케줄 vs 클래스 정보)
- ✅ 데이터 중복 최소화

**단점**:
- ❌ 복잡도 높음 (조인 필요)
- ❌ 쿼리 성능 저하 (여러 문서 읽기)
- ❌ 기존 코드와 패러다임 불일치

**평가**: 3/5 ⭐⭐⭐

---

## 3. 권장 방안: Class Group Field (방안 B)

### 3.1 Schema 설계

#### types.ts 수정
```typescript
export interface ScheduleSlot {
  day: string;
  periodId: string;
  startTime?: string;
  endTime?: string;
  teacher?: string;  // 부담임 강사
}

export interface UnifiedClass {
  id: string;
  className: string;
  subject: 'math' | 'english';
  teacher: string;
  room: string;
  schedule: ScheduleSlot[];
  color: string;

  // 합반 수업 필드
  classGroupId?: string;
  isGroupLeader?: boolean;
  groupMembers?: string[];  // 선택적 (조회 최적화용)

  // 기존 필드
  studentIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}
```

### 3.2 마이그레이션 로직

#### scripts/migrateToUnifiedClasses_v2.ts

```typescript
async function migrateEnglishClasses() {
  const schedulesRef = doc(db, 'schedules', 'english');
  const schedulesSnap = await getDoc(schedulesRef);
  const englishSchedules = schedulesSnap.data() as Record<string, EnglishScheduleCell>;

  // 1단계: 합반 그룹 식별
  const groupMap = new Map<string, string[]>(); // key → [classNames]

  for (const [key, cell] of Object.entries(englishSchedules)) {
    const classNames = [cell.className];
    if (cell.merged) {
      classNames.push(...cell.merged.map(m => m.className));
    }
    groupMap.set(key, classNames);
  }

  // 2단계: classGroupId 생성 및 클래스 문서 생성
  const batch = writeBatch(db);
  const processedClasses = new Set<string>();

  for (const [key, classNames] of groupMap.entries()) {
    const [teacher, periodId, day] = key.split('-');
    const isGroup = classNames.length > 1;
    const classGroupId = isGroup ? `${teacher}-${periodId}` : undefined;

    classNames.forEach((className, index) => {
      if (processedClasses.has(className)) return;

      const classId = `english_${className}_${teacher}`;
      const cell = englishSchedules[key];
      const room = index === 0 ? cell.room : cell.merged?.[index - 1]?.room;

      const classDoc: UnifiedClass = {
        id: classId,
        className,
        subject: 'english',
        teacher,
        room: room || '',
        schedule: [{day, periodId}],
        color: generateColor(className),
        classGroupId,
        isGroupLeader: index === 0,
        groupMembers: isGroup ? classNames.map(cn => `english_${cn}_${teacher}`) : undefined
      };

      batch.set(doc(db, 'classes', classId), classDoc);
      processedClasses.add(className);
    });
  }

  await batch.commit();
}
```

### 3.3 UI 로직 수정

#### hooks/useEnglishClasses.ts
```typescript
const scheduleData: Record<string, ScheduleCell> = {};

allClasses.forEach(cls => {
  cls.schedule?.forEach(slot => {
    const key = `${cls.teacher}-${slot.periodId}-${slot.day}`;

    if (cls.classGroupId) {
      // 합반 수업 처리
      if (cls.isGroupLeader) {
        // 대표 클래스: 메인 셀 생성
        scheduleData[key] = {
          className: cls.className,
          room: cls.room,
          teacher: cls.teacher,
          merged: []
        };
      } else {
        // 멤버 클래스: merged 배열에 추가
        if (scheduleData[key]) {
          scheduleData[key].merged = scheduleData[key].merged || [];
          scheduleData[key].merged.push({
            className: cls.className,
            room: cls.room
          });
        } else {
          console.warn(`Group leader not found for ${cls.className} in group ${cls.classGroupId}`);
        }
      }
    } else {
      // 단독 수업
      scheduleData[key] = {
        className: cls.className,
        room: cls.room,
        teacher: cls.teacher
      };
    }
  });
});
```

---

## 4. 구현 단계

### Phase 1: 타입 및 인터페이스 정의 (30분)

**파일**:
- `types.ts`: `UnifiedClass`에 `classGroupId`, `isGroupLeader`, `groupMembers` 추가
- `components/Timetable/constants.ts`: 필요시 상수 추가

**검증**:
- TypeScript 컴파일 에러 없음
- 기존 코드 영향 없음 (선택적 필드)

---

### Phase 2: 마이그레이션 스크립트 작성 (2시간)

**파일**:
- `scripts/migrateToUnifiedClasses_v2.ts`

**주요 기능**:
1. `english_schedules` → `classes` 변환 (합반 그룹 인식)
2. `수업목록` → `classes` 변환
3. `enrollments` → `classes`의 `studentIds` 매핑
4. 백업 생성 (`classes_backup_{timestamp}`)

**검증**:
- 드라이런 모드로 콘솔 출력만 확인
- 합반 그룹 정확히 식별 (LT1a+LT1b, PL6+LT1a 등)
- 모든 클래스 누락 없이 변환

---

### Phase 3: UI 로직 수정 (2시간)

**파일**:
- `hooks/useEnglishClasses.ts`: scheduleData 생성 로직 수정
- `components/Timetable/English/EnglishTimetable.tsx`: `classes` 컬렉션 읽기
- `hooks/useClasses.ts`: 필요시 필터 추가

**주요 변경**:
1. `useEnglishClasses`에서 `classGroupId` 기반 merged 배열 생성
2. 대표 클래스만 메인 셀에 표시
3. 멤버 클래스는 merged 배열에 추가

**검증**:
- 기존 시간표 UI 정상 표시
- 합반 수업 정확히 표시 (LT1a + LT1b)
- 드래그 앤 드롭 정상 작동

---

### Phase 4: 기능 검증 (2시간)

**검증 항목**:
1. **시간표 표시**:
   - [ ] 영어 강사별 뷰: 모든 수업 표시
   - [ ] 영어 수업별 뷰: 합반 정보 정확
   - [ ] 영어 강의실별 뷰: 정상 작동
   - [ ] 수학 시간표: 기존 기능 유지

2. **수업 관리**:
   - [ ] EditClassModal: 합반 수업 편집
   - [ ] AddClassModal: 새 합반 수업 생성
   - [ ] ClassDetailModal: 합반 정보 표시

3. **학생 관리**:
   - [ ] 학생 등록/이동: 정상 작동
   - [ ] enrollments 조회: 정상

4. **드래그 앤 드롭**:
   - [ ] 합반 수업 이동 시 그룹 유지
   - [ ] 충돌 감지 정상

**버그 발견 시**:
- 즉시 수정 또는 Phase 3으로 회귀
- 심각한 경우 롤백 실행

---

### Phase 5: 데이터 클린업 및 최적화 (1.5시간)

**작업**:
1. `english_schedules` 컬렉션 백업 후 삭제 (선택)
2. `수업목록` 컬렉션 백업 후 삭제 (선택)
3. Firestore 인덱스 생성:
   - `classes` 컬렉션에 `classGroupId` 복합 인덱스
   - `(subject, teacher)` 복합 인덱스

**검증**:
- 쿼리 성능 측정 (Chrome DevTools Network)
- Firestore 비용 추정 (예상: 읽기 50% 감소)

---

## 5. 롤백 계획

### 언제 롤백하나?

1. Phase 3-4에서 치명적 버그 발견 (시간표 미표시, 데이터 손실)
2. 성능 저하 심각 (응답 시간 2초 초과)
3. 사용자 피드백 부정적

### 롤백 절차 (15분)

```bash
# 1. classes 컬렉션 삭제
firebase firestore:delete classes --recursive --force

# 2. 코드 되돌리기
git checkout main -- components/Timetable/English/
git checkout main -- hooks/useEnglishClasses.ts
git checkout main -- hooks/useClasses.ts

# 3. 개발 서버 재시작
npm run dev
```

**롤백 후 상태**:
- `english_schedules`, `수업목록` 컬렉션으로 정상 작동
- 사용자 영향 없음

---

## 6. 체크리스트

### 마이그레이션 전
- [ ] 전체 Firestore 백업 완료
- [ ] `migrateToUnifiedClasses_v2.ts` 드라이런 성공
- [ ] 합반 그룹 식별 정확성 검증 (콘솔 로그)
- [ ] 타입 정의 완료 및 컴파일 성공

### 마이그레이션 중
- [ ] Phase 1 완료: 타입 정의
- [ ] Phase 2 완료: 마이그레이션 스크립트
- [ ] Phase 3 완료: UI 로직 수정
- [ ] Phase 4 완료: 기능 검증 (모든 항목 통과)

### 마이그레이션 후
- [ ] 영어 시간표 정상 표시 (LT1a + LT1b 합반 확인)
- [ ] 수학 시간표 정상 작동
- [ ] EditClassModal 정상 작동
- [ ] 학생 등록/이동 정상
- [ ] 드래그 앤 드롭 정상
- [ ] 성능 측정 완료 (읽기/쓰기 비용)

---

## 7. 타임라인

| Phase | 작업 | 소요 시간 | 누적 시간 |
|-------|------|-----------|-----------|
| 1 | 타입 정의 | 30분 | 0.5시간 |
| 2 | 마이그레이션 스크립트 | 2시간 | 2.5시간 |
| 3 | UI 로직 수정 | 2시간 | 4.5시간 |
| 4 | 기능 검증 | 2시간 | 6.5시간 |
| 5 | 데이터 클린업 | 1.5시간 | 8시간 |
| **총계** | | **8시간** | |

**권장 일정**:
- 1일차: Phase 1-2 (타입 정의 + 마이그레이션 스크립트)
- 2일차: Phase 3-4 (UI 수정 + 검증)
- 3일차: Phase 5 (최적화) + 예비일

---

## 8. 성공 기준

### 필수 (Must Have)
1. ✅ 모든 영어 수업 시간표에 정확히 표시
2. ✅ 합반 수업 정보 정확 (LT1a + LT1b 함께 표시)
3. ✅ 수학 시간표 기존 기능 100% 유지
4. ✅ EditClassModal 정상 작동 (string 배열 schedule 지원)
5. ✅ 데이터 손실 0건

### 선호 (Should Have)
1. 🎯 Firestore 읽기 비용 50% 감소
2. 🎯 시간표 로딩 시간 1초 이내
3. 🎯 코드 복잡도 증가 최소화

### 차선 (Nice to Have)
1. 💡 `english_schedules`, `수업목록` 컬렉션 완전 제거
2. 💡 합반 그룹별 통계 기능 (미래 확장)

---

## 9. 위험 요소 및 대응

| 위험 | 확률 | 영향 | 완화 방안 |
|------|------|------|-----------|
| 합반 식별 실패 | 중 | 높음 | 드라이런으로 사전 검증, 수동 확인 |
| scheduleData 생성 로직 버그 | 중 | 높음 | Phase 4에서 철저한 UI 테스트 |
| 부담임(slotTeachers) 처리 누락 | 낮 | 중 | 기존 코드 유지, 별도 처리 |
| 성능 저하 | 낮 | 중 | 인덱스 생성, 쿼리 최적화 |
| EditClassModal 호환성 문제 | 중 | 중 | string 배열 schedule 계속 지원 |

---

## 10. 미래 개선 사항

1. **합반 그룹 자동 추천**:
   - 동일 시간대 클래스 감지 시 자동으로 `classGroupId` 제안

2. **합반 그룹 통계**:
   - 그룹별 출석률, 평균 성적 등

3. **시각적 합반 표시**:
   - 시간표에서 합반 수업 시각적 구분 (테두리, 배경색 등)

4. **합반 수업 일괄 관리**:
   - 그룹 전체 시간 이동, 강사 변경 등

---

## 11. 결론

**권장 사항**: Class Group Field (방안 B) 채택

**이유**:
1. ✅ 합반 관계 명시적 표현으로 데이터 의미 명확
2. ✅ 기존 `merged` 배열 개념과 호환되어 UI 변경 최소화
3. ✅ 쿼리 효율적이며 미래 확장성 우수
4. ✅ 롤백 계획 명확하여 위험 관리 가능

**다음 단계**:
1. 사용자 승인 후 Phase 1부터 순차 진행
2. 각 Phase 완료 시 git commit으로 체크포인트 생성
3. Phase 4 검증 통과 후 프로덕션 배포

---

## 참고 자료

- 이전 마이그레이션 실패 분석: 콘솔 로그 (2026-01-13)
- 기존 데이터 구조: `english_schedules`, `수업목록` 컬렉션
- 관련 파일:
  - [components/ClassManagement/ClassDetailModal.tsx](../components/ClassManagement/ClassDetailModal.tsx)
  - [hooks/useEnglishClasses.ts](../hooks/useEnglishClasses.ts)
  - [components/Timetable/English/EnglishTimetable.tsx](../components/Timetable/English/EnglishTimetable.tsx)
