# 복원 필요 작업 계획서

## 배경
복원으로 인해 이전 세션에서 작업했던 내용이 사라졌습니다. 이 문서는 복원해야 할 모든 변경사항과 상세 구현 계획을 포함합니다.

---

## 📊 현재 코드 상태 (2025-12-31 검증 완료)

### ✅ 이미 복원됨 / 유지됨
| 항목 | 파일 | 상태 |
|------|------|------|
| withdrawalDate 필드 | types.ts | ✅ 존재 |
| onHold 필드 | types.ts | ✅ 존재 |
| TuitionEntry 인터페이스 | types.ts | ✅ 존재 |
| StudentModal 버튼 (신입/퇴원/밑줄/대기/삭제) | StudentModal.tsx | ✅ 존재 |
| 3-state 신입 토글 (Today→2ndMonth→Off) | StudentModal.tsx | ✅ 존재 |
| 학생 정렬 로직 (Underline→Normal→Pink→Red→Withdrawn) | StudentModal.tsx | ✅ 존재 |
| 퇴원 학생 분리 섹션 | StudentModal.tsx | ✅ 존재 |
| 상호 배타성 로직 | StudentModal.tsx | ✅ 존재 |
| handleSaveChanges sanitization | StudentModal.tsx | ✅ 존재 |
| handleAddStudent 자동 enrollmentDate | StudentModal.tsx | ✅ 존재 |
| studentStats 배지 (검색창 우측) | EnglishClassTab.tsx | ✅ 방금 복원 |
| 교시→시간 표시 변경 | EnglishClassTab.tsx | ✅ 방금 복원 |
| PaymentReport 컴포넌트 | components/PaymentReport/ | ✅ 존재 |
| geminiService, sheetService | services/ | ✅ 존재 |

### ✅ 복원 완료 (2025-12-31 17:00)
| 항목 | 파일 | 설명 |
|------|------|------|
| studentCount 계산 수정 | EnglishClassTab.tsx | ✅ 퇴원/대기 학생 제외 |
| 학생 정렬 로직 개선 | EnglishClassTab.tsx | ✅ Underline→Normal→Pink→Red 순 |
| 신입생 풀 로우 하이라이팅 | EnglishClassTab.tsx | ✅ 배경색으로 1개월/2개월 구분 |
| 3섹션 분리 (Active/Hold/Withdrawn) | EnglishClassTab.tsx | ✅ 대기생, 퇴원생 별도 섹션 |
| enrollmentDate 툴팁 | EnglishClassTab.tsx | ✅ title 속성으로 입학일 표시 |
| App.tsx 'payment' appMode | App.tsx | ✅ 이미 존재 확인 |



## 🔴 복원 필요사항 (이전 세션에서 완료했던 작업)

### 1. 통합뷰: 교시 표시 제거 (시간대만 표현)
**위치**: `EnglishClassTab.tsx`

**문제점**: 인재원뷰에서 교시 표시하면 `[5] → [7]`로 넘어가서 불편해 보임 (6교시가 없어서 스킵됨)

**해결 방안**:
- `[1]`, `[2]` 등 교시 번호 표시 대신 시간대만 표시 (예: `14:20~15:00`)
- 행 헤더에서 `[교시번호]` 제거하고 `시간` 정보만 남김

**수정 위치**:
- Line 477: `pLabel` 생성 로직 수정
- Line 904: 행 헤더 "교시" 텍스트 제거/수정
- `PeriodRow` 컴포넌트에서 period.id 대신 period.time 표시

---

### 2. 학생 통계 위치 변경: 검색창 우측으로 이동
**원래 위치**: `EnglishTeacherTab.tsx` 또는 `EnglishTimetable.tsx` 헤더

**목표 위치**: `EnglishClassTab.tsx` - 수업명 검색(`className` search) 우측

**표시할 정보**:
- 재원생 (active 학생 수)
- 신입 1개월 (enrollmentDate가 30일 이내)
- 신입 2개월 (enrollmentDate가 31~60일)
- 퇴원생 (withdrawalDate가 30일 이내)

**구현 필요사항**:
1. `EnglishClassTab.tsx`에 `studentStats` state 추가:
   ```tsx
   const [studentStats, setStudentStats] = useState({
     active: 0,
     new1: 0,
     new2: 0,
     withdrawn: 0
   });
   ```

2. Firestore에서 학생 데이터 조회 useEffect 추가:
   - `수업목록` 컬렉션의 `students` 배열 조회
   - `scheduleData`에 있는 활성 수업의 학생만 계산

3. 검색 인풋 우측에 배지 UI 추가:
   ```tsx
   <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
     재원 {studentStats.active}
   </span>
   <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full text-xs font-bold">
     신입1 {studentStats.new1}
   </span>
   <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
     신입2 {studentStats.new2}
   </span>
   <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
     퇴원 {studentStats.withdrawn}
   </span>
   ```

**정리 필요사항**:
- `EnglishTeacherTab.tsx`에서 studentStats 관련 코드 제거 (있다면)
- `EnglishTimetable.tsx`에서 studentStats 관련 코드 제거 (있다면)

---

### 3. 기타 사라진 변경사항 (이전 세션 기록 기반)

#### 3.1 StudentModal 관련
- **자동 enrollmentDate 설정**: 새 학생 추가 시 현재 날짜 자동 설정
- **데이터 sanitization**: `undefined` 값 제거 후 Firestore 업데이트
- **버튼 디자인 변경**: N/W/U/- 버튼을 한글(신입/퇴원/밑줄/삭제)로 변경
- **신입 버튼 3-state 토글**: Today → 2nd Month → Off
- **퇴원 학생 취소선 & 회색 처리**
- **학생 정렬 로직**: Underline → Normal → Pink → Red → Withdrawn

#### 3.2 EnglishClassTab 학생 표시
- **studentCount**: 퇴원 학생 및 대기생(onHold) 제외
- **visibleStudents 정렬**: underline/new/normal/withdrawn 기준 정렬
- **학생 행 스타일**: 신입생/퇴원생 풀 로우 하이라이팅
- **3섹션 분리**: Active / Hold(대기) / Withdrawn(퇴원)
- **enrollmentDate 툴팁**: 학생 이름에 마우스 오버 시 입학일 표시

#### 3.3 types.ts 관련
- `TimetableStudent` 인터페이스에 추가:
  - `withdrawalDate?: string` // 퇴원일 (YYYY-MM-DD)
  - `onHold?: boolean` // 대기생 여부

---

## 📋 구현 순서

### Phase 1: 통합뷰 교시 표시 수정
1. `EnglishClassTab.tsx` 열기
2. 교시 번호 삭제, 시간대만 표시하도록 수정
3. 테스트

### Phase 2: 학생 통계 검색창 우측 배치
1. `EnglishClassTab.tsx`에 studentStats state 추가
2. useEffect로 Firestore 학생 데이터 조회 및 계산
3. 검색 인풋 우측에 배지 UI 추가
4. 기존 위치(EnglishTeacherTab/EnglishTimetable)에서 관련 코드 정리

### Phase 3: StudentModal 기능 복원 (필요시)
- 위 3.1 항목들 확인 및 복원

### Phase 4: EnglishClassTab 학생 표시 기능 복원 (필요시)
- 위 3.2 항목들 확인 및 복원

---

## ⚠️ 주의사항
- 각 단계 완료 후 브라우저에서 테스트
- 기존 기능 regression 확인
- Firestore 쿼리 최적화 주의 (실시간 구독 사용)

---

## 참고: 이전 세션에서 생성했던 파일들

### 전자 결제 관련 (별도 작업)
- `components/PaymentReport/PaymentReport.tsx`
- `components/PaymentReport/EntryForm.tsx`
- `components/PaymentReport/TuitionChart.tsx`
- `services/geminiService.ts`
- `services/sheetService.ts`
- `types.ts`: TuitionEntry, ReportSummary 인터페이스

**상태**: 이 작업이 복원에 포함되었는지 확인 필요
