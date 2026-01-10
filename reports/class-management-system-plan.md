# 수업 관리 시스템 설계 보고서

## 📋 개요

**작성일**: 2026-01-10
**목적**: 학생 관리, 시간표와 연동되는 통합 수업 관리 탭 개발 계획
**현재 상태**: 학생 관리 탭과 시간표는 구현됨, 수업 관리 탭 미구현

---

## 🎯 목표

학원 관리 시스템의 완성도를 높이기 위해 **수업(Class) 중심**의 관리 기능을 추가합니다.

### 핵심 가치
1. **학생 관리**: 학생 중심 - "이 학생이 어떤 수업을 듣나?"
2. **수업 관리**: 수업 중심 - "이 수업에 누가 있나?" ← **신규**
3. **시간표**: 스케줄 중심 - "월요일 3시에 무슨 수업이 있나?"

이 세 가지가 연동되면 학원 운영의 모든 측면을 효율적으로 관리할 수 있습니다.

---

## 📊 현재 시스템 분석

### 기존 데이터 구조

#### 1. 구 구조 (수업목록 컬렉션)
```
수업목록/
  └─ {classId}
      ├─ className: string
      ├─ teacher: string
      ├─ schedule: string[]
      ├─ studentIds: string[]  (학생 이름 배열)
      └─ ...
```

#### 2. 신 구조 (students/enrollments)
```
students/
  └─ {studentId}
      ├─ name: string
      ├─ grade: string
      ├─ status: 'active' | 'on_hold' | 'withdrawn'
      └─ enrollments/
          └─ {enrollmentId}
              ├─ subject: 'math' | 'english'
              ├─ className: string
              ├─ teacherId: string
              ├─ schedule: string[]
              └─ ...
```

### 기존 Hook 분석

#### `useClasses(subject?: 'math' | 'english')`
- **위치**: `hooks/useClasses.ts`
- **기능**: 수업 목록 조회
- **반환 타입**:
```typescript
interface ClassInfo {
    id: string;
    className: string;
    teacher: string;
    subject: 'math' | 'english';
    schedule?: string[];
    studentCount?: number;
}
```
- **특징**:
  - `localStorage.useNewDataStructure` 설정에 따라 구/신 구조 자동 전환
  - 신 구조에서는 collectionGroup으로 enrollments 조회 후 그룹화
  - React Query 캐싱 (10분 stale, 30분 GC)

#### `useStudents(includeWithdrawn: boolean)`
- **위치**: `hooks/useStudents.ts`
- **기능**: 학생 목록 조회
- **특징**:
  - enrollments 서브컬렉션까지 함께 로드
  - 퇴원생 포함 여부 선택 가능

---

## 🏗️ 수업 관리 탭 설계

### 1. 화면 구성

```
┌─────────────────────────────────────────────────┐
│  수업 관리 (곤색 #081429)    [새 수업 추가 +]    │
│                              (노란색 #fdb813)   │
├─────────────────────────────────────────────────┤
│                                                 │
│  필터:  [수학 ▼]  [전체 강사 ▼]  [검색...]      │
│        (곤색 테두리)                              │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  수업 목록 (카드 그리드)                          │
│  ┌───────────────┐  ┌───────────────┐          │
│  │  중1 수학     │  │  고3 수학     │          │
│  │  (곤색 제목)  │  │  (곤색 제목)  │          │
│  │  강사: 김철수  │  │  강사: 이영희  │          │
│  │  (회색 텍스트)│  │  (회색 텍스트)│          │
│  │  학생: 12명   │  │  학생: 8명    │          │
│  │  📅 월수금 5pm │  │  📅 화목 7pm  │          │
│  └───────────────┘  └───────────────┘          │
│  [곤색 테두리, 호버시 노란색 테두리]              │
│                                                 │
│  ┌───────────────┐  ┌───────────────┐          │
│  │  초5 영어     │  │  중2 영어     │          │
│  │  강사: 박지민  │  │  강사: 최수연  │          │
│  │  학생: 15명   │  │  학생: 10명   │          │
│  │  (노란색 강조)│  │  (노란색 강조)│          │
│  │  📅 월수 4pm  │  │  📅 화목 6pm  │          │
│  └───────────────┘  └───────────────┘          │
│                                                 │
└─────────────────────────────────────────────────┘
```

**색상 적용 상세**:
- **헤더**: 곤색 배경 (#081429), 흰색 텍스트
- **버튼**: 노란색 배경 (#fdb813), 곤색 텍스트
- **카드 테두리**: 곤색 (#081429) 1px
- **카드 호버**: 노란색 테두리 (#fdb813) 2px
- **제목**: 곤색 (#081429)
- **보조 텍스트**: 회색 (#373d41)
- **강조 숫자**: 노란색 (#fdb813)

### 2. 수업 상세 모달

클릭 시 나타나는 모달:

```
┌──────────────────────────────────────────────┐
│  수업 상세 (곤색 헤더)    [편집] [삭제]       │
│  (흰색 텍스트)           (노란색) (빨강)     │
├──────────────────────────────────────────────┤
│                                              │
│  📚 수업 정보 (곤색 제목)                     │
│  ────────────────────────────────────        │
│  수업명: 중1 수학 (곤색 볼드)                 │
│  과목: 수학 (회색)                            │
│  강사: 김철수 (회색)                          │
│  스케줄: 월요일 5:00 PM, 수요일 5:00 PM       │
│          금요일 5:00 PM                      │
│  교실: A-301                                 │
│                                              │
│  👥 수강 학생 (12명, 노란색)  [학생 추가 +]   │
│  ────────────────────────────────────        │
│  ┌────────────────────────────────┐          │
│  │ 김민수 (초6) - 정상 수강       │ [제외]   │
│  │ 이지은 (중1) - 정상 수강       │ [제외]   │
│  │ 박준형 (중1) - 정상 수강       │ [제외]   │
│  │ (회색 텍스트)             (곤색 버튼)     │
│  │ ...                           │          │
│  └────────────────────────────────┘          │
│                                              │
│  📊 통계 (곤색 제목)                          │
│  ────────────────────────────────────        │
│  평균 출석률: 95% (노란색 강조)               │
│  이번 달 수업 횟수: 12회 (노란색 강조)        │
│                                              │
└──────────────────────────────────────────────┘
```

**색상 적용 상세**:
- **모달 헤더**: 곤색 배경 (#081429), 흰색 텍스트
- **편집 버튼**: 노란색 배경 (#fdb813), 곤색 텍스트
- **삭제 버튼**: 빨간색 배경, 흰색 텍스트
- **섹션 제목**: 곤색 (#081429) 볼드
- **일반 텍스트**: 회색 (#373d41)
- **강조 숫자**: 노란색 (#fdb813) 볼드
- **학생 추가 버튼**: 노란색 배경 (#fdb813)
- **제외 버튼**: 곤색 테두리, 투명 배경

---

## 🎨 브랜드 컬러 상수 정의

구현 시 재사용 가능한 색상 상수:

```typescript
// constants/colors.ts 또는 컴포넌트 상단에 정의
export const BRAND_COLORS = {
  primary: '#081429',      // 곤색 - 메인 컬러
  accent: '#fdb813',       // 노란색 - 강조 컬러
  secondary: '#373d41',    // 회색 - 보조 컬러

  // 파생 색상
  primaryLight: '#1a2845',     // 연한 곤색
  accentDark: '#e5a60f',       // 진한 노란색
  accentLight: 'rgba(253, 184, 19, 0.1)',  // 반투명 노란색

  // 상태 색상
  success: '#10b981',      // 초록색
  error: '#ef4444',        // 빨간색
  warning: '#f59e0b',      // 주황색
  info: '#3b82f6',         // 파란색

  // 중립 색상
  white: '#ffffff',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
} as const;

// 사용 예시
<button className={`bg-[${BRAND_COLORS.primary}] hover:bg-[${BRAND_COLORS.accent}]`}>
  버튼
</button>
```

---

## 💻 구현 계획

### Phase 1: 기본 구조 (1단계)

#### 1.1 컴포넌트 생성
- **위치**: `components/ClassManagement/`
- **파일**:
  - `ClassManagementTab.tsx` - 메인 탭
  - `ClassList.tsx` - 수업 목록 (카드 그리드)
  - `ClassCard.tsx` - 개별 수업 카드
  - `ClassDetailModal.tsx` - 수업 상세 모달
  - `AddClassModal.tsx` - 새 수업 추가 모달
  - `EditClassModal.tsx` - 수업 편집 모달

#### 1.2 Hook 개선
- **`useClasses` 확장**:
  ```typescript
  // 기존 기능 유지 + 추가 기능
  interface ClassInfo {
    id: string;
    className: string;
    teacher: string;
    subject: 'math' | 'english';
    schedule?: string[];
    studentCount?: number;
    room?: string;              // 추가
    startDate?: string;         // 추가
    endDate?: string;           // 추가
    color?: string;             // 추가
  }
  ```

- **새 Hook 생성**: `hooks/useClassDetail.ts`
  ```typescript
  interface ClassDetail extends ClassInfo {
    students: {
      id: string;
      name: string;
      grade: string;
      status: 'active' | 'on_hold' | 'withdrawn';
      enrollmentDate: string;
    }[];
    statistics?: {
      averageAttendance: number;
      monthlySessionCount: number;
    };
  }

  export const useClassDetail = (classId: string, subject: 'math' | 'english')
  ```

#### 1.3 CRUD 함수
- **위치**: `hooks/useClassMutations.ts`
```typescript
// 수업 생성
export const useCreateClass = () => {
  // enrollments 생성 로직
}

// 수업 수정
export const useUpdateClass = () => {
  // className, teacher, schedule 등 업데이트
}

// 수업 삭제
export const useDeleteClass = () => {
  // 모든 학생의 해당 enrollment 삭제
}

// 학생 추가/제거
export const useManageClassStudents = () => {
  // 특정 학생의 enrollment 추가/삭제
}
```

---

### Phase 2: UI/UX 구현 (2단계)

#### 2.1 필터링 기능
```typescript
interface ClassFilters {
  subject: 'all' | 'math' | 'english';
  teacher: string; // 'all' or teacherId
  searchQuery: string;
  sortBy: 'name' | 'studentCount' | 'teacher';
}
```

#### 2.2 정렬 기능
- 수업명 (가나다순)
- 학생 수 (많은 순/적은 순)
- 강사명 (가나다순)

#### 2.3 검색 기능
- 수업명 검색
- 강사명 검색
- 실시간 필터링

---

### Phase 3: 연동 기능 (3단계)

#### 3.1 학생 관리와 연동
- 학생 상세 화면에서 "수업 보기" 클릭 → 해당 수업 상세로 이동
- 수업 상세 화면에서 학생 클릭 → 학생 상세로 이동

#### 3.2 시간표와 연동
- 시간표에서 수업 클릭 → 수업 상세 모달 표시
- 수업 상세에서 "시간표 보기" → 해당 수업 시간대로 시간표 이동

#### 3.3 출석부와 연동 (선택)
- 수업별 출석 통계 표시
- 수업 상세에서 출석부로 바로가기

---

## 🗂️ 파일 구조

```
components/
  └─ ClassManagement/
      ├─ ClassManagementTab.tsx       # 메인 탭 컴포넌트
      ├─ ClassList.tsx                # 수업 목록 (그리드)
      ├─ ClassCard.tsx                # 개별 수업 카드
      ├─ ClassDetailModal.tsx         # 수업 상세 모달
      ├─ AddClassModal.tsx            # 수업 추가 모달
      ├─ EditClassModal.tsx           # 수업 편집 모달
      └─ ClassStudentList.tsx         # 수업별 학생 목록

hooks/
  ├─ useClasses.ts                   # 기존 (확장)
  ├─ useClassDetail.ts               # 신규
  └─ useClassMutations.ts            # 신규

types.ts                              # ClassInfo, ClassDetail 타입 추가
```

---

## 📐 데이터 흐름

### 수업 목록 조회
```
ClassManagementTab
  └─ useClasses(subject)
      └─ Firebase collectionGroup('enrollments')
          └─ Group by className + subject
              └─ ClassInfo[]
```

### 수업 상세 조회
```
ClassDetailModal
  └─ useClassDetail(classId, subject)
      └─ Firebase students collection
          └─ Filter enrollments by className
              └─ ClassDetail (with students[])
```

### 수업 수정
```
EditClassModal
  └─ useUpdateClass()
      └─ Update all enrollments with matching className
          └─ Invalidate React Query cache
              └─ Auto-refresh UI
```

---

## 🎨 UI/UX 고려사항

### 1. 브랜드 컬러 시스템
학원 브랜드 아이덴티티를 반영한 색상 체계:

- **곤색 (Primary)**: `#081429` - 헤더, 주요 버튼, 강조 요소
- **노란색 (Accent)**: `#fdb813` - 액션 버튼, 강조 포인트, 호버 효과
- **회색 (Secondary)**: `#373d41` - 텍스트, 보조 UI 요소

#### 과목별 색상 적용
```typescript
const subjectColors = {
  math: {
    primary: '#081429',    // 곤색 (수학 메인)
    accent: '#fdb813',     // 노란색 (강조)
    light: '#1a2845',      // 연한 곤색 (배경)
  },
  english: {
    primary: '#081429',    // 곤색 (영어 메인)
    accent: '#fdb813',     // 노란색 (강조)
    light: '#2a3f5f',      // 파란빛 곤색 (배경)
  }
};
```

### 2. 카드 디자인
- **배경**: 흰색 (#ffffff)
- **테두리**: 곤색 (#081429) 1px
- **제목**: 곤색 (#081429) 폰트
- **강조 텍스트**: 노란색 (#fdb813)
- **보조 정보**: 회색 (#373d41)
- **호버 효과**:
  - 테두리 → 노란색 (#fdb813) 2px
  - 배경 → 매우 연한 노란색 (#fdb813 opacity 0.05)
  - 그림자 강화

### 3. 버튼 스타일
```css
/* Primary 버튼 */
background: #081429 (곤색)
hover: #fdb813 (노란색)
text: #ffffff

/* Secondary 버튼 */
background: transparent
border: 1px solid #081429
text: #081429
hover-bg: #081429
hover-text: #ffffff

/* Accent 버튼 */
background: #fdb813 (노란색)
text: #081429 (곤색)
hover: darken(#fdb813, 10%)
```

#### Tailwind CSS 클래스 예시
```typescript
// Primary 버튼
className="bg-[#081429] hover:bg-[#fdb813] text-white px-6 py-2 rounded-lg font-bold transition-colors"

// Secondary 버튼
className="bg-transparent border border-[#081429] text-[#081429] hover:bg-[#081429] hover:text-white px-6 py-2 rounded-lg font-bold transition-colors"

// Accent 버튼
className="bg-[#fdb813] hover:bg-[#e5a60f] text-[#081429] px-6 py-2 rounded-lg font-bold transition-colors"

// 카드 스타일
className="bg-white border border-[#081429] hover:border-[#fdb813] hover:border-2 rounded-lg p-6 transition-all shadow-sm hover:shadow-md"

// 제목 텍스트
className="text-[#081429] font-bold text-xl"

// 보조 텍스트
className="text-[#373d41] text-sm"

// 강조 텍스트
className="text-[#fdb813] font-semibold"
```

### 4. 반응형 디자인
- 데스크톱: 3-4열 그리드
- 태블릿: 2열 그리드
- 모바일: 1열 리스트

### 5. 로딩 상태
- Skeleton UI 활용
- 색상: 곤색 (#081429) opacity 0.1
- React Query의 `isLoading`, `isFetching` 상태 표시

### 6. 에러 처리
- 빈 상태: "등록된 수업이 없습니다" 메시지 (회색 #373d41)
- 에러 상태: 에러 메시지 + 재시도 버튼 (노란색 #fdb813)

---

## 🔄 마이그레이션 고려사항

### 구 구조 → 신 구조 전환 시나리오

#### 1. 신규 수업 생성
- 신 구조: students/{id}/enrollments 직접 생성
- 구 구조 호환 X (새 데이터 구조 전용)

#### 2. 기존 수업 편집
- 신 구조: 모든 enrollments 업데이트
- 구 구조: 수업목록 컬렉션 업데이트 (fallback)

#### 3. 토글 기능
- `localStorage.useNewDataStructure`에 따라 자동 전환
- MigrationTab에서 제어

---

## 🚀 우선순위

### High Priority (필수)
1. ✅ ClassManagementTab 기본 구조
2. ✅ ClassList + ClassCard 구현
3. ✅ useClasses Hook 활용
4. ✅ ClassDetailModal (읽기 전용)
5. ✅ 필터링 및 검색

### Medium Priority (중요)
6. ⬜ AddClassModal (수업 생성)
7. ⬜ EditClassModal (수업 수정)
8. ⬜ useClassMutations Hook
9. ⬜ 학생 추가/제거 기능

### Low Priority (나중에)
10. ⬜ 수업 삭제 기능
11. ⬜ 출석 통계 연동
12. ⬜ 수업 복제 기능
13. ⬜ 수업 아카이빙

---

## 🔐 권한 관리

기존 권한 시스템과 통합:
- `system.classes.view`: 수업 목록 보기
- `system.classes.manage`: 수업 생성/수정/삭제
- `students.manage`: 학생 추가/제거

---

## 📈 성능 최적화

### 1. React Query 캐싱
```typescript
staleTime: 1000 * 60 * 10,   // 10분
gcTime: 1000 * 60 * 30,      // 30분
refetchOnMount: false,
```

### 2. Firestore 쿼리 최적화
- `where('subject', '==', subject)` 필터 활용
- collectionGroup 대신 개별 쿼리 고려 (성능 측정 후 결정)

### 3. 가상 스크롤
- 수업이 100개 이상일 경우 `react-window` 도입 검토

---

## 🧪 테스트 계획

### 1. 단위 테스트
- useClasses Hook 테스트
- useClassDetail Hook 테스트
- 필터링 로직 테스트

### 2. 통합 테스트
- 수업 생성 → 학생 추가 → 시간표 표시 플로우
- 수업 수정 → 모든 enrollments 업데이트 확인

### 3. E2E 테스트
- 사용자 시나리오 기반 테스트
- 권한별 화면 접근 테스트

---

## 📝 구현 순서

### Week 1: 기본 구조
1. ClassManagementTab 컴포넌트 생성
2. ClassList, ClassCard 구현
3. 필터링 및 검색 UI
4. useClasses Hook 활용하여 데이터 표시

### Week 2: 상세 기능
5. ClassDetailModal 구현
6. useClassDetail Hook 생성
7. 학생 목록 표시
8. 학생 관리와 연동 링크

### Week 3: CRUD 기능
9. AddClassModal 구현
10. EditClassModal 구현
11. useClassMutations Hook 생성
12. 학생 추가/제거 기능

### Week 4: 통합 및 테스트
13. 시간표 연동
14. 버그 수정
15. 성능 최적화
16. 문서화

---

## 💡 추가 아이디어

### 1. 수업 템플릿
- 자주 사용하는 수업 설정을 템플릿으로 저장
- "중1 수학 기본반" 템플릿 → 원클릭 생성

### 2. 수업 복제
- 기존 수업을 복사하여 새 학기 수업 생성
- 학생 제외하고 설정만 복사

### 3. 수업 통계 대시보드
- 과목별 수업 수
- 강사별 담당 학생 수
- 월별 수업 통계

### 4. 수업 캘린더 뷰
- 주간 캘린더로 모든 수업 한눈에 보기
- 시간대별 충돌 감지

---

## 🎯 성공 지표

### 기능적 지표
- ✅ 모든 수업 CRUD 작업 가능
- ✅ 학생 관리와 양방향 연동
- ✅ 시간표와 실시간 동기화

### 성능 지표
- ⬜ 수업 목록 로딩 시간 < 1초
- ⬜ 수업 상세 로딩 시간 < 500ms
- ⬜ 100개 수업까지 부드러운 스크롤

### UX 지표
- ⬜ 직관적인 UI (사용자 피드백)
- ⬜ 모바일 친화적 반응형 디자인
- ⬜ 에러 발생 시 명확한 안내

---

## 📚 참고 자료

### 기존 구현
- `components/StudentManagement/StudentManagementTab.tsx` - 참고할 UI 패턴
- `hooks/useClasses.ts` - 기존 데이터 조회 로직
- `hooks/useStudents.ts` - 학생-수업 관계 조회

### 라이브러리
- React Query: 데이터 캐싱 및 상태 관리
- Lucide React: 아이콘
- Tailwind CSS: 스타일링

---

## ✅ 체크리스트

### 개발 전 준비
- [ ] types.ts에 ClassDetail 인터페이스 추가
- [ ] hooks/useClassDetail.ts 파일 생성
- [ ] hooks/useClassMutations.ts 파일 생성
- [ ] components/ClassManagement/ 폴더 생성

### Phase 1 완료 기준
- [ ] ClassManagementTab 화면 렌더링
- [ ] 수업 목록 표시 (카드 형태)
- [ ] 필터링 동작 (과목, 강사, 검색)
- [ ] 수업 클릭 시 상세 모달 표시

### Phase 2 완료 기준
- [ ] 새 수업 추가 기능
- [ ] 수업 정보 수정 기능
- [ ] 학생 추가/제거 기능
- [ ] 변경사항 즉시 반영

### Phase 3 완료 기준
- [ ] 학생 관리 탭과 연동
- [ ] 시간표와 연동
- [ ] 모든 CRUD 작업 안정적 동작
- [ ] 성능 최적화 완료

---

## 🔮 향후 확장 가능성

1. **AI 기반 수업 추천**
   - 학생 성향에 맞는 수업 자동 추천

2. **수업 평가 시스템**
   - 학생/학부모 피드백 수집
   - 강사 평가 연동

3. **자동 시간표 생성**
   - 학생 수강 정보 기반 최적 시간표 생성

4. **대기자 명단 관리**
   - 정원 초과 시 대기자 등록
   - 자리 나면 자동 알림

---

**작성자**: AI Assistant
**검토자**: -
**승인자**: -
**문서 버전**: 1.0
