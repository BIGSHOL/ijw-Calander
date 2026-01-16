# 강사 관리 → 직원 관리 통합 이전 계획서

**작성일**: 2026-01-16  
**작성자**: AI Assistant  
**상태**: 계획 수립 (사용자 검토 필요)

---

## 1. 현황 분석

### 1.1 현재 데이터 구조

#### Teacher 인터페이스 (`types.ts:680-691`)
```typescript
export interface Teacher {
  id: string;
  name: string;
  subjects?: string[];      // 담당 과목
  isHidden?: boolean;       // 시간표 표시 여부
  isNative?: boolean;       // 원어민 강사 여부
  color?: string;
  bgColor?: string;         // 퍼스널 배경색
  textColor?: string;       // 퍼스널 글자색
  order?: number;
  defaultRoom?: string;     // 기본 강의실
}
```

#### StaffMember 인터페이스 (`types.ts:1300-1315`)
```typescript
export interface StaffMember {
  id: string;
  userId?: string;          // users 컬렉션 연동
  name: string;
  email: string;
  phone?: string;
  role: 'teacher' | 'admin' | 'staff';  // ← 이미 teacher 타입 존재!
  subjects?: ('math' | 'english')[];
  hireDate: string;
  status: 'active' | 'inactive' | 'resigned';
  workSchedule?: WeeklySchedule;
  profileImage?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 1.2 Firestore 컬렉션

| 컬렉션 | 용도 | 위치 |
|--------|------|------|
| `teachers` | 강사 목록 (설정 > 시간표 > 강사 관리) | 설정 모달 |
| `staff` | 직원 목록 (직원 관리 탭) | 별도 탭 |

### 1.3 참조 위치 분석 (상세)

**코드베이스 전체 스캔 결과 (2026-01-16):**

#### 핵심 훅 및 타입 정의
- `types.ts:680-691` - Teacher 인터페이스 정의
- `hooks/useFirebaseQueries.ts:27-40` - useTeachers 훅 (Firestore 컬렉션 '강사목록')

#### 주요 컴포넌트 (30+ 파일)

**설정 관련 (3개 파일)**
- `components/Settings/TeachersTab.tsx` - 강사 관리 UI (드래그앤드롭 정렬 포함)
- `components/Settings/SettingsModal.tsx` - 강사 관리 탭 통합
- `components/Settings/modals/UserDetailModal.tsx` - 사용자-강사 연동

**수업 관리 (3개 파일)**
- `components/ClassManagement/AddClassModal.tsx` - useTeachers 훅 사용
- `components/ClassManagement/EditClassModal.tsx` - useTeachers 훅 사용
- `components/ClassManagement/ClassDetailModal.tsx` - useTeachers 훅 사용

**수학 시간표 (4개 파일)**
- `components/Timetable/Math/hooks/useTimetableClasses.ts` - useTeachers 훅 사용
- `components/Timetable/Math/components/TimetableGrid.tsx` - teachers 프롭
- `components/Timetable/Math/components/ClassCard.tsx` - teachers 프롭 (defaultRoom 조회)
- `components/Timetable/TimetableManager.tsx` - teachers 프롭 전달

**영어 시간표 (9개 파일)**
- `components/Timetable/English/EnglishTimetable.tsx` - teachers 데이터 관리
- `components/Timetable/English/EnglishTeacherTab.tsx` - getTeacherColor 사용
- `components/Timetable/English/EnglishClassTab.tsx` - teachersData 프롭
- `components/Timetable/English/EnglishRoomTab.tsx` - teachersData 프롭
- `components/Timetable/English/ClassCard.tsx` - teachersData 프롭
- `components/Timetable/English/IntegrationViewSettings.tsx` - teachersData 프롭
- `components/Timetable/English/MiniGridRow.tsx` - getTeacherColor 사용
- `components/Timetable/English/TeacherOrderModal.tsx` - 강사 정렬 UI
- `components/Timetable/English/hooks/useEnglishClasses.ts` - teachersData 파라미터

**출석부 (2개 파일)**
- `components/Attendance/AttendanceManager.tsx` - teachers 필터링
- `components/Attendance/components/SalarySettingsTab.tsx` - teachers 프롭

**학생 관리 (1개 파일)**
- `components/StudentManagement/tabs/CoursesTab.tsx` - useTeachers 훅 사용

**유틸리티 함수**
- `components/Timetable/English/englishUtils.ts` - getTeacherColor(teacherName, teachersData)

**스크립트**
- `scripts/migrateStudents.ts` - fetchTeachersData() 함수

**루트 파일**
- `App.tsx:89` - useTeachers 훅 호출 및 전역 teachers 데이터 관리

#### 통계
- **총 파일 수**: 30+
- **useTeachers 훅 직접 호출**: 7회
- **Teacher 타입 임포트**: 25+ 위치
- **Firestore 컬렉션**: '강사목록' (1개)
- **권한 ID**: 'system.teachers.view', 'system.teachers.edit'

---

## 2. 통합 설계

### 2.1 확장된 StaffMember 인터페이스

```typescript
export interface StaffMember {
  // 기존 필드
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  role: 'teacher' | 'admin' | 'staff';
  subjects?: ('math' | 'english')[];
  hireDate: string;
  status: 'active' | 'inactive' | 'resigned';
  workSchedule?: WeeklySchedule;
  profileImage?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;

  // === 선생님 전용 필드 (role === 'teacher'일 때만 사용) ===
  // 시간표 표시 설정
  isHiddenInTimetable?: boolean;  // 시간표에서 숨김
  isNative?: boolean;             // 원어민 강사 여부
  
  // 퍼스널 색상 (시간표, 출석부 등에서 사용)
  bgColor?: string;               // 배경색
  textColor?: string;             // 글자색
  
  // 시간표 관련
  defaultRoom?: string;           // 기본 강의실
  timetableOrder?: number;        // 시간표 정렬 순서
}
```

### 2.2 마이그레이션 매핑

| Teacher 필드 | StaffMember 필드 | 비고 |
|--------------|------------------|------|
| `id` | `id` | 동일 |
| `name` | `name` | 동일 |
| `subjects` | `subjects` | 타입 통일 필요 |
| `isHidden` | `isHiddenInTimetable` | 명확한 이름으로 변경 |
| `isNative` | `isNative` | 동일 |
| `color` | (미사용) | 제거 |
| `bgColor` | `bgColor` | 동일 |
| `textColor` | `textColor` | 동일 |
| `order` | `timetableOrder` | 명확한 이름으로 변경 |
| `defaultRoom` | `defaultRoom` | 동일 |

---

## 3. 구현 계획

### Phase 1: 데이터 구조 준비 (Day 1)

#### 1.1 StaffMember 인터페이스 확장
- [ ] `types.ts`에 선생님 전용 필드 추가
- [ ] 기존 StaffMember 호환성 유지

#### 1.2 마이그레이션 스크립트 작성
- [ ] `scripts/migrate-teachers-to-staff.ts` 생성
- [ ] teachers 컬렉션 → staff 컬렉션 복사 로직
- [ ] 중복 방지 (이름 기준 체크)

### Phase 2: 훅 및 API 변경 (Day 2)

#### 2.1 useStaff 훅 확장
- [ ] `useStaffTeachers()` 훅 추가 (role='teacher' 필터)
- [ ] `useTeachers()` 훅을 `useStaffTeachers()`로 점진적 교체

#### 2.2 기존 참조 업데이트
- [ ] `App.tsx` - teachers를 staff에서 가져오도록 변경
- [ ] 각 컴포넌트의 `useTeachers` 호출 업데이트

### Phase 3: UI 통합 (Day 3)

#### 3.1 직원 관리 UI 확장
- [ ] `StaffManager` 컴포넌트에 선생님 전용 필드 표시
- [ ] role='teacher' 선택 시 추가 필드(색상, 강의실 등) 표시

#### 3.2 강사 관리 탭 제거
- [ ] `TeachersTab.tsx` 기능을 StaffManager로 이동
- [ ] 설정 모달에서 강사 관리 탭 제거 (또는 리다이렉트)

### Phase 4: 정리 및 테스트 (Day 4)

#### 4.1 레거시 정리
- [ ] `teachers` 컬렉션 deprecated 처리
- [ ] 기존 `useTeachers` 훅 deprecated 마킹

#### 4.2 테스트
- [ ] 시간표 강사 표시 테스트
- [ ] 수업 관리 강사 선택 테스트
- [ ] 출석부 강사 필터 테스트

---

## 4. 위험 요소 및 대응

### 4.1 데이터 불일치
- **위험**: teachers와 staff에 동일인이 다른 이름으로 존재
- **대응**: 마이그레이션 전 사전 검수 리스트 생성

### 4.2 참조 누락
- **위험**: 일부 컴포넌트에서 여전히 teachers 참조
- **대응**: 전역 검색으로 모든 참조 위치 파악 후 순차 업데이트

### 4.3 롤백 계획
- **방법**: teachers 컬렉션은 삭제하지 않고 유지
- **기간**: 최소 30일간 병행 운영 후 삭제 결정

---

## 5. 예상 일정

| 단계 | 예상 소요 | 시작일 | 완료일 |
|------|-----------|--------|--------|
| Phase 1 | 1일 | TBD | TBD |
| Phase 2 | 1일 | TBD | TBD |
| Phase 3 | 1일 | TBD | TBD |
| Phase 4 | 1일 | TBD | TBD |
| **총합** | **4일** | | |

---

## 6. 결론

StaffMember 인터페이스에 이미 `role: 'teacher'` 옵션이 존재하므로, 강사 관리 → 직원 관리 통합은 **기술적으로 자연스러운 확장**입니다.

핵심 작업:
1. StaffMember에 선생님 전용 필드(색상, 강의실 등) 추가
2. teachers 데이터를 staff로 마이그레이션
3. useTeachers 훅을 staff 기반으로 변경
4. UI 통합 및 레거시 정리

**다음 단계**: 사용자 승인 후 Phase 1 구현 시작
