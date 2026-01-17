# 수학 시간표 SlotTeachers(교시별 담당강사) 기능 구현 계획서

> **작성일**: 2026-01-17  
> **작성자**: Antigravity Agent (Sequential Thinking MCP 활용)

---

## 1. 개요

### 1.1 현재 문제
수학 시간표에서 수업을 생성할 때 **교시별로 다른 강사를 배정**하더라도(`slotTeachers`), 시간표 화면에서는 **메인 담임만** 기준으로 표시됩니다.

**예시**:
- "3-1" 수업의 메인 담임: 이수진
- 5교시 담당 강사(slotTeacher): 이성우
- **문제**: 이성우 선생님의 시간표에 5교시 수업이 표시되지 않음

### 1.2 목표
영어 시간표처럼 **강사별 뷰**와 **날짜별 뷰** 모두에서 `slotTeachers` 정보를 반영하여 정확한 강사 배정을 표시합니다.

---

## 2. 현재 코드 분석

### 2.1 데이터 저장 (✅ 정상 작동)
| 파일 | 역할 | 상태 |
|------|------|------|
| [EditClassModal.tsx](file:///f:/ijw-calander/components/ClassManagement/EditClassModal.tsx) | `slotTeachers` 저장 | ✅ 정상 |
| [useClassMutations.ts](file:///f:/ijw-calander/hooks/useClassMutations.ts) | Firestore 업데이트 | ✅ 정상 |

### 2.2 데이터 표시 (❌ 미구현)
| 파일 | 역할 | 문제점 |
|------|------|--------|
| [types.ts](file:///f:/ijw-calander/types.ts#L667-L678) | `TimetableClass` 타입 | `slotTeachers` 필드 없음 |
| [useTimetableClasses.ts](file:///f:/ijw-calander/components/Timetable/Math/hooks/useTimetableClasses.ts#L92-L102) | 데이터 페칭 | `slotTeachers` 미포함 |
| [gridUtils.ts](file:///f:/ijw-calander/components/Timetable/Math/utils/gridUtils.ts#L20-L41) | 셀 필터링 로직 | `cls.teacher`만 사용 |
| [TimetableGrid.tsx](file:///f:/ijw-calander/components/Timetable/Math/components/TimetableGrid.tsx) | UI 렌더링 | slot 강사 미표시 |

---

## 3. 변경 계획

### Phase 1: 타입 정의 수정

#### [MODIFY] [types.ts](file:///f:/ijw-calander/types.ts)

`TimetableClass` 인터페이스에 다음 필드 추가:

```diff
 export interface TimetableClass {
   id: string;
   className: string;
   teacher: string;
   room?: string;
   subject: string;
   schedule: string[];
   studentList?: TimetableStudent[];
   studentIds?: string[];
   color?: string;
   order?: number;
+  slotTeachers?: Record<string, string>;  // key: "월-1-1", value: 강사명
+  slotRooms?: Record<string, string>;     // key: "월-1-1", value: 강의실
 }
```

---

### Phase 2: 데이터 페칭 수정

#### [MODIFY] [useTimetableClasses.ts](file:///f:/ijw-calander/components/Timetable/Math/hooks/useTimetableClasses.ts)

통합 `classes` 컬렉션에서 데이터 로드 시 `slotTeachers`, `slotRooms` 포함:

```diff
 return {
     id: doc.id,
     className: data.className || '',
     teacher: data.teacher || '',
     subject: subjectLabel,
     studentList,
     studentIds: data.studentIds || [],
     schedule: scheduleStrings,
     room: data.room || '',
     color: data.color,
+    slotTeachers: data.slotTeachers || {},
+    slotRooms: data.slotRooms || {},
 };
```

---

### Phase 3: 필터링 로직 수정 (핵심)

#### [MODIFY] [gridUtils.ts](file:///f:/ijw-calander/components/Timetable/Math/utils/gridUtils.ts)

`getClassesForCell` 함수에서 `slotTeachers` 확인 로직 추가:

```typescript
export const getClassesForCell = (
    filteredClasses: TimetableClass[],
    day: string,
    period: string,
    resource: string,
    viewType: 'teacher' | 'room' | 'class'
) => {
    return filteredClasses.filter(cls => {
        // Schedule 매칭 먼저 확인
        const targetSlot = `${day}${period}`.replace(/\s+/g, '');
        const scheduleMatch = cls.schedule?.some(s => {
            const normalizedS = s.replace(/\s+/g, '');
            return normalizedS === targetSlot || normalizedS.startsWith(`${targetSlot}-`);
        });
        
        if (!scheduleMatch) return false;

        // 리소스 매칭 (Teacher/Room)
        if (viewType === 'teacher') {
            // slotTeachers 키 생성 (예: "월-5" 또는 "월-1-1")
            const slotKey = `${day}-${period}`.replace(/\s+/g, '');
            const slotTeacher = cls.slotTeachers?.[slotKey];
            
            // slotTeacher가 있으면 그것 사용, 없으면 메인 teacher
            const effectiveTeacher = slotTeacher || cls.teacher;
            return effectiveTeacher?.trim() === resource?.trim();
        } else {
            // Room 뷰는 slotRooms 또는 기본 room
            const slotKey = `${day}-${period}`.replace(/\s+/g, '');
            const slotRoom = cls.slotRooms?.[slotKey];
            const effectiveRoom = slotRoom || cls.room;
            return effectiveRoom?.trim() === resource?.trim();
        }
    });
};
```

---

### Phase 4: UI 렌더링 개선 (선택사항)

#### [MODIFY] [TimetableGrid.tsx](file:///f:/ijw-calander/components/Timetable/Math/components/TimetableGrid.tsx)

`ClassCard` 컴포넌트에 현재 셀의 슬롯 강사 정보 전달:

```diff
 <ClassCard
     key={cls.id}
     cls={cls}
+    slotTeacher={cls.slotTeachers?.[`${day}-${period}`]}
+    slotRoom={cls.slotRooms?.[`${day}-${period}`]}
     // ... other props
 />
```

---

## 4. 검증 계획

### 4.1 수동 테스트 (브라우저)

> [!IMPORTANT]  
> 자동화 테스트보다 **수동 브라우저 테스트**가 적합합니다 (UI 시각적 확인 필요)

**테스트 시나리오**:

1. **설정**:
   - 개발 서버 실행: `npm run dev`
   - 수학 시간표 → 수업 관리에서 테스트 수업 생성/편집
   - 메인 담임: "이수진"
   - 5교시(화요일) 슬롯 강사: "이성우"

2. **강사별 뷰 테스트**:
   - 시간표 → 강사별 보기
   - **예상 결과**: 
     - "이수진" 컬럼에 수업이 표시됨 (5교시 제외한 나머지)
     - "이성우" 컬럼 화요일 5교시에 동일 수업 표시됨

3. **날짜별 뷰 테스트**:
   - 시간표 → 날짜별 보기 → 화요일 선택
   - **예상 결과**: 5교시 셀에 "이성우" 강사명 표시

4. **하위 호환성 테스트**:
   - `slotTeachers` 없는 기존 수업도 정상 표시 확인

### 4.2 기존 테스트 실행

```bash
npm test -- tests/hooks/useClasses.test.ts
```

> [!NOTE]
> 현재 `useTimetableClasses`에 대한 직접 테스트는 없으나, `useClasses` 테스트로 데이터 구조 호환성 확인 가능

---

## 5. 위험 요소 및 대응

| 위험 | 영향도 | 대응 방안 |
|------|--------|-----------|
| 기존 필터링 동작 변경 | 높음 | `slotTeachers`가 없으면 기존 로직 유지 (fallback) |
| 성능 저하 | 낮음 | 추가 체크는 O(1) 객체 접근 |
| 키 포맷 불일치 | 중간 | `EditClassModal.tsx` 저장 포맷과 동기화 필요 |

---

## 6. 구현 예상 시간

| Phase | 예상 시간 |
|-------|-----------|
| Phase 1: 타입 정의 | 5분 |
| Phase 2: 데이터 페칭 | 10분 |
| Phase 3: 필터링 로직 | 20분 |
| Phase 4: UI 개선 | 15분 |
| 테스트 및 디버깅 | 30분 |
| **합계** | **~80분** |

---

## 7. 결론

영어 시간표에서 이미 검증된 패턴을 수학 시간표에 적용하는 것으로, **4개 파일 수정**으로 구현 가능합니다.

핵심은 `gridUtils.ts`의 `getClassesForCell` 함수에서 **슬롯별 강사 오버라이드**를 확인하는 로직 추가입니다.
