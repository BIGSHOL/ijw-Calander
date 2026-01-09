# 학생 관리 탭 설계 및 구현 계획서

> **작성일**: 2026-01-08
> **최종 수정**: 2026-01-08
> **우선순위**: P1 (높음)
> **예상 소요**: 2-3주
> **담당**: 개발팀

---

## 📋 Executive Summary

### 목적
ijw-calander 프로젝트에 **학생 관리 탭**을 추가하여, 학생을 중심으로 모든 데이터를 통합 관리하는 시스템 구축

### 핵심 원칙
**"학생이 학원의 근간이다"** - 모든 데이터는 학생을 기준으로 조회/관리

### 벤치마킹
**makeEdu** 학원 관리 프로그램의 원생목록 기능 참고
- 좌측: 학생 목록 (검색/필터)
- 우측: 학생 상세정보 (탭 구조)
- 통합 데이터 뷰

---

## 🎯 구현 전략 (2026-01-08 결정)

### 원칙: "기존 데이터 우선, 빈칸 여지"

#### ✅ 즉시 사용 가능한 필드 (기존 `UnifiedStudent` 데이터)
| 필드 | 설명 |
|------|------|
| `name` | 이름 |
| `englishName` | 영어이름 |
| `school` | 학교 |
| `grade` | 학년 |
| `startDate` | 등록일 |
| `endDate` | 퇴원일 |
| `status` | 상태 (재원/퇴원/휴학) |
| `enrollments[]` | 수강정보 배열 |

#### ⏳ 빈칸으로 표시 (추후 입력)
| 필드 | 표시 방식 |
|------|----------|
| `birthDate` | `- (구현 예정)` |
| `guardianPhone` | `- (구현 예정)` |
| `studentPhone` | `- (구현 예정)` |
| `guardianName` | `- (구현 예정)` |
| `address` | `- (구현 예정)` |
| `notes` | 빈 텍스트 영역 |

### 미구현 기능 UX 처리

```tsx
// 비활성 버튼/탭에 툴팁 표시
<button 
  className="text-gray-400 cursor-not-allowed opacity-50"
  title="구현 예정"
  disabled
>
  수납 관리
</button>
```

---

## 🎯 현황 분석

### 현재 시스템 구조

| TabIndex | 탭 이름 | 주요 기능 |
|----------|---------|----------|
| 0 | 연간 일정 | 캘린더 뷰, 이벤트 관리 |
| 1 | 시간표 | 수업 시간표 관리 |
| 2 | 출석부 | 출석 체크 및 관리 |
| 3 | 간트 차트 | 일정 시각화 |
| 4 | 상담 관리 | 상담 기록 관리 |
| **5** | **학생 관리** (신규) | 학생 중심 통합 관리 |

### 현재 데이터 구조 (Firestore)

```typescript
// 기존 컬렉션
- CalendarEvents (일정/이벤트)
- EnglishClasses (영어 수업)
- Students (학생 기본정보)
- TaskMemos (상담 메모)
- BucketItems (버킷 아이템)
- SystemConfig (시스템 설정)
```

---

## 🏗️ 설계 개요

### 핵심 컨셉: "학생 중심 데이터 허브"

```
             ┌─────────────────┐
             │   학생 정보     │
             │   (Students)    │
             └────────┬────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │ 출석현황 │   │수강정보│   │상담이력│
   └─────────┘   └────────┘   └────────┘
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │ 성적관리 │   │납부현황│   │학부모   │
   └─────────┘   └────────┘   └────────┘
```

---

## 📐 화면 설계 (makeEdu 벤치마킹)

### Layout 구조

```
┌─────────────────────────────────────────────────────┐
│  [원생목록] 탭                                        │
├──────────────┬──────────────────────────────────────┤
│              │  학생 상세 정보 (우측 패널)            │
│  학생 목록   │  ┌────────────────────────────────┐  │
│  (좌측)      │  │ [기본정보] [수업] [기타수업] ... │  │
│              │  ├────────────────────────────────┤  │
│ ┌──────────┐│  │  보호자: 010-8652-3960(모) 이은은│  │
│ │검색       ││  │  생년월일: 2025-03-10 (30살)    │  │
│ │[    검색]││  │  휴대폰: 010-7196-3960          │  │
│ └──────────┘│  │  학교: 침산초                    │  │
│              │  │  학년_반: 중3                   │  │
│ 필터:        │  │                                 │  │
│ □주:능실등록 │  │  [회원] [원생정보] [퇴원처리]   │  │
│ 수업:중등과목│  │  [말록] [SMS] [예비결석관찰]    │  │
│ 학년:[전체] │  │  [수납] [결제] [수강조회]       │  │
│ 재원:[재원] │  │  [목록] [수정]                  │  │
│              │  └────────────────────────────────┘  │
│ 학생 리스트  │                                       │
│ ┌──────────┐│  [상세정보 탭]                        │
│ │☑ 강하진  ││  ┌────────────────────────────────┐  │
│ │  침산초 중3││  │ • 출결번호: 3960               │  │
│ ├──────────┤│  │ • 원생고유번호: 09302          │  │
│ │  강민승   ││  │ • 포인트: 재원(O)              │  │
│ │  달성초 초3││  │ • 재원상태: 재원(O)            │  │
│ ├──────────┤│  │ • 수납 기준금액(매월): 1월 수정│  │
│ │  강민주   ││  │ • 수납/미납 문자 발송: 보조자  │  │
│ │  침산초 중1││  │ • 적립금: 0원 수정             │  │
│ │  ...     ││  │ • 당월(0천): O (신정일:...)    │  │
│ └──────────┘│  │ • 자동(정기)결제신청하부: ...  │  │
│              │  │ • 입학등기: X                  │  │
│  총 41명     │  │ • 노랜서 SMS수신 대상: ...     │  │
└──────────────┴──────────────────────────────────────┘
```

---

## 💡 핵심 기능 설계

### Phase 1: MVP (2주)

#### 1.1 학생 목록 (좌측 패널)

**기능**:
- ✅ 전체 학생 목록 표시
- ✅ 실시간 검색 (이름, 학교, 학년)
- ✅ 필터링
  - 주: 능실등록 여부
  - 수업: 중등과목/초등과목 등
  - 학년: 전체/초1~고3
  - 재원: 재원/퇴원/휴학
- ✅ 정렬: 이름순/학년순/등록일순
- ✅ 선택된 학생 강조 표시

**UI 컴포넌트**:
```typescript
interface StudentListProps {
  students: Student[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
  filters: StudentFilters;
  onFilterChange: (filters: StudentFilters) => void;
}

interface StudentFilters {
  searchQuery: string;
  grade: string; // '전체', '초1', '초2', ..., '고3'
  status: 'active' | 'withdrawn' | 'on-leave' | 'all';
  course: string[]; // 수강 중인 강좌
}
```

**데이터 로딩 전략**:
```typescript
// React Query 캐싱 (5분)
const { data: students } = useQuery({
  queryKey: ['students', filters],
  queryFn: () => fetchStudents(filters),
  staleTime: 1000 * 60 * 5, // 5분 캐싱
});

// Firestore 쿼리 (페이지네이션)
const fetchStudents = async (filters: StudentFilters) => {
  let q = query(
    collection(db, 'students'),
    where('status', '==', filters.status === 'all' ? undefined : filters.status),
    orderBy('name'),
    limit(50) // 페이지네이션
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

---

#### 1.2 학생 상세정보 (우측 패널)

**탭 구조** (makeEdu 참고):

| 탭 이름 | 내용 | 데이터 소스 |
|---------|------|------------|
| **기본정보** | 기본정보, 보호자 정보, 연락처 | Students |
| **수업** | 수강 중인 강좌, 시간표 | EnglishClasses, CalendarEvents |
| **기타수업** | 추가 수업 정보 | CalendarEvents |
| **수납** | 납부 현황, 수강료 | Payments (신규) |
| **SMS** | SMS 발송 이력 | SMSLogs (신규) |
| **상담** | 상담 이력 | TaskMemos |
| **자료** | 학습 자료, 성적 | Documents (신규) |
| **포인트** | 포인트 적립/사용 내역 | Points (신규) |
| **간트메모** | 간트차트 메모 | BucketItems |
| **전학사항** | 전학/퇴원 이력 | TransferHistory (신규) |
| **성적** | 성적 관리 | Grades (신규) |
| **학습일지** | 학습 일지 | LearningLogs (신규) |
| **대모** | 대기 메모? | Notes (신규) |

**Phase 1에서 우선 구현할 탭 (3개)**:
1. ✅ 기본정보
2. ✅ 수업 (수강 정보)
3. ✅ 상담 (기존 TaskMemos 연동)

---

#### 1.3 기본정보 탭 상세 설계

**표시 정보** (makeEdu 벤치마킹):

```typescript
interface StudentDetailView {
  // 상단 요약
  profileImage?: string;
  name: string;
  guardianPhone: string; // "010-8652-3960(모) 이은은"
  birthDate: string; // "2025-03-10 (30살)"
  studentPhone?: string;
  school: string; // "침산초"
  gradeClass: string; // "중3"

  // 상세 정보
  attendanceNumber: string; // "출결번호: 3960"
  studentId: string; // "원생고유번호: 09302"
  enrollmentDate: string; // "입학등기"
  status: '재원(O)' | '휴학' | '퇴원';

  // 수납 정보
  monthlyFee: number; // "수납 기준금액(매월): 1월"
  paymentStatus: string; // "당월(0천): O"
  points: number; // "적립금: 0원"
  autoPayment: boolean; // "자동(정기)결제신청하부"

  // 기타
  address?: string; // "주소: 대구 북구 서변 원대로 21-8..."
  smsReceiver: string; // "노랜서 SMS수신 대상: 1번 버튼(등원)..."
  notes?: string;
}
```

**UI 레이아웃**:
```tsx
function StudentDetailBasicInfo({ student }: { student: Student }) {
  return (
    <div className="student-detail">
      {/* 상단 요약 */}
      <div className="summary-section">
        <Avatar src={student.profileImage} name={student.name} />
        <div className="info">
          <h2>{student.name}</h2>
          <p>보호자: {student.guardianPhone}</p>
          <p>생년월일: {student.birthDate}</p>
          <p>휴대폰: {student.studentPhone}</p>
          <p>학교: {student.school}</p>
          <p>학년_반: {student.gradeClass}</p>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="action-buttons">
        <Button>회원</Button>
        <Button>원생정보</Button>
        <Button>퇴원처리</Button>
        <Button>말록</Button>
        <Button variant="primary">SMS</Button>
        <Button>예비결석관찰</Button>
        <Button>수납</Button>
        <Button>결제</Button>
        <Button>수강조회</Button>
        <Button>목록</Button>
        <Button>수정</Button>
      </div>

      {/* 상세 정보 */}
      <div className="detail-section">
        <DetailRow label="출결번호" value={student.attendanceNumber} />
        <DetailRow label="원생고유번호" value={student.studentId} />
        <DetailRow label="포인트" value={student.points} />
        <DetailRow label="재원상태" value={student.status} />
        <DetailRow
          label="수납 기준금액(매월)"
          value={`${student.monthlyFee}원`}
          action={<Button size="sm">수정</Button>}
        />
        {/* ... 기타 정보 */}
      </div>
    </div>
  );
}
```

---

#### 1.4 수업 탭 설계

**표시 정보**:
- 현재 수강 중인 강좌 목록
- 각 강좌별 시간표
- 출석률
- 수강 기간

```typescript
interface StudentCourseView {
  courses: {
    id: string;
    name: string; // "중등 영어 레벨 3"
    teacher: string;
    schedule: string; // "월/수/금 19:00-20:00"
    startDate: string;
    endDate?: string;
    attendanceRate: number; // 85.5%
    status: 'active' | 'completed' | 'paused';
  }[];
}
```

---

### Phase 2: 확장 기능 (1주)

#### 2.1 수납 관리
- 납부 내역 조회
- 미납금 확인
- 영수증 발행
- 자동결제 설정

#### 2.2 SMS 발송
- SMS 발송 이력
- 새 SMS 작성
- 템플릿 활용

#### 2.3 성적 관리
- 시험 성적 입력
- 성적 추이 그래프
- 학력평가 결과

---

### Phase 3: 고급 기능 (추후)

#### 3.1 학습 분석 대시보드
- 출석률 트렌드
- 성적 변화 그래프
- 수강 이력 타임라인

#### 3.2 학부모 연동
- 학부모 앱 연동
- 실시간 알림
- 학습 리포트 자동 발송

#### 3.3 AI 추천
- 적합한 강좌 추천
- 학습 패턴 분석
- 위험 학생 조기 발견

---

## 🗄️ 데이터베이스 설계

### 기존 Students 컬렉션 확장

```typescript
interface Student {
  // 기본 정보
  id: string;
  name: string;
  englishName?: string;
  birthDate: string; // "2010-03-15"
  gender: 'male' | 'female';
  profileImage?: string;

  // 학교 정보
  school: string; // "침산초등학교"
  grade: string; // "초3", "중1", "고2"
  gradeNumber: number; // 3 (정렬용)
  classNumber?: string; // "3반"

  // 연락처
  studentPhone?: string;
  guardianPhone: string; // "010-8652-3960"
  guardianRelation: '모' | '부' | '조모' | '조부' | '기타';
  guardianName: string;
  email?: string;
  address?: string;

  // 학원 정보
  studentId: string; // "원생고유번호: 09302"
  attendanceNumber: string; // "출결번호: 3960"
  enrollmentDate: string; // "2023-03-01"
  status: 'active' | 'withdrawn' | 'on-leave'; // 재원/퇴원/휴학
  withdrawalDate?: string;
  withdrawalReason?: string;

  // 수납 정보
  monthlyFee: number; // 월 수강료
  paymentMethod: 'cash' | 'card' | 'transfer' | 'auto';
  autoPayment: boolean;
  points: number; // 적립금

  // 기타
  notes?: string;
  smsReceiver: string; // SMS 수신 대상
  specialNeeds?: string; // 특이사항

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  lastModifiedBy: string;
}
```

### 신규 컬렉션 (Phase 2+)

#### Payments (수납 관리)
```typescript
interface Payment {
  id: string;
  studentId: string;
  studentName: string; // 비정규화
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'card' | 'transfer';
  status: 'completed' | 'pending' | 'cancelled' | 'refunded';
  receiptNumber?: string;
  notes?: string;
  createdAt: Timestamp;
}
```

#### Grades (성적 관리)
```typescript
interface Grade {
  id: string;
  studentId: string;
  studentName: string;
  examName: string; // "중간고사", "기말고사"
  examDate: string;
  subject: string; // "영어", "수학"
  score: number;
  maxScore: number;
  rank?: number;
  notes?: string;
  createdAt: Timestamp;
}
```

#### SMSLogs (SMS 발송 이력)
```typescript
interface SMSLog {
  id: string;
  studentId: string;
  studentName: string;
  recipientPhone: string;
  message: string;
  sentAt: Timestamp;
  status: 'sent' | 'failed' | 'pending';
  template?: string;
}
```

---

## 🎨 UI/UX 디자인 가이드

### 디자인 원칙
1. **일관성**: 기존 탭들과 동일한 디자인 언어 사용
2. **명확성**: 학생 정보를 한눈에 파악 가능
3. **효율성**: 최소 클릭으로 원하는 정보 접근
4. **반응성**: 모바일/태블릿 대응

### 색상 체계 (기존 유지)
```css
--primary: #3b82f6; /* 파란색 */
--danger: #ef4444; /* 빨간색 */
--warning: #f59e0b; /* 주황색 */
--success: #10b981; /* 초록색 */
--gray: #6b7280;
```

### 컴포넌트 재사용
- `FilterSelect` (학년 필터)
- `SearchInput` (검색)
- `DataTable` (목록)
- `Modal` (상세 뷰)
- `Tabs` (정보 탭)

---

## 🔄 기존 시스템 연동

### 출석부 연동
```typescript
// 학생 상세 -> 출석 현황 조회
const getStudentAttendance = async (studentId: string) => {
  const attendanceRecords = await getDocs(
    query(
      collection(db, 'CalendarEvents'),
      where('studentIds', 'array-contains', studentId),
      where('type', '==', 'attendance'),
      orderBy('date', 'desc'),
      limit(30) // 최근 30일
    )
  );

  return attendanceRecords.docs.map(doc => doc.data());
};
```

### 시간표 연동
```typescript
// 학생의 수강 강좌 조회
const getStudentCourses = async (studentId: string) => {
  const courses = await getDocs(
    query(
      collection(db, 'EnglishClasses'),
      where('studentIds', 'array-contains', studentId),
      where('status', '==', 'active')
    )
  );

  return courses.docs.map(doc => doc.data());
};
```

### 상담 이력 연동
```typescript
// TaskMemos에서 학생 관련 상담 조회
const getStudentConsultations = async (studentId: string) => {
  const consultations = await getDocs(
    query(
      collection(db, 'TaskMemos'),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc')
    )
  );

  return consultations.docs.map(doc => doc.data());
};
```

---

## 🚀 구현 로드맵

### Week 1-2: Phase 1 (MVP)

#### Week 1
- [x] 데이터 모델 설계 완료
- [ ] Students 컬렉션 마이그레이션
- [ ] 학생 목록 컴포넌트 개발
  - [ ] 검색 기능
  - [ ] 필터 기능
  - [ ] 정렬 기능
- [ ] 기본정보 탭 개발

#### Week 2
- [ ] 수업 탭 개발
- [ ] 상담 탭 개발 (TaskMemos 연동)
- [ ] 기존 시스템 연동 테스트
- [ ] 반응형 디자인 적용

### Week 3-4: Phase 2 (확장 기능)

- [ ] 수납 관리 기능
- [ ] SMS 발송 기능
- [ ] 성적 관리 기능
- [ ] 통합 테스트

### Week 5+: Phase 3 (고급 기능)

- [ ] 학습 분석 대시보드
- [ ] AI 추천 시스템
- [ ] 학부모 연동

---

## 📊 성공 지표

### 정량적 지표
- [ ] 학생 정보 조회 시간: < 2초
- [ ] 필터링 응답 시간: < 500ms
- [ ] Firebase 읽기 비용: 기존 대비 +10% 이내
- [ ] 사용자 만족도: 4.5/5 이상

### 정성적 지표
- [ ] 학생 정보 찾기가 쉬워졌는가?
- [ ] 통합된 뷰가 업무 효율을 높였는가?
- [ ] 기존 탭들과 자연스럽게 연동되는가?

---

## ⚠️ 위험 요소 및 대응 방안

### 1. 성능 저하
**위험**: 대량의 학생 데이터 로딩 시 느려질 수 있음
**대응**:
- React Query 캐싱 (5분)
- 가상 스크롤링 (react-window)
- 페이지네이션 (50명씩)

### 2. Firebase 비용 증가
**위험**: 학생 정보 조회가 많아져 읽기 비용 증가
**대응**:
- 캐싱 전략 강화
- 불필요한 실시간 리스너 제거
- 집계 데이터 사전 계산

### 3. 데이터 일관성
**위험**: 여러 컬렉션에 분산된 데이터의 일관성 문제
**대응**:
- 데이터 비정규화 (studentName 등)
- Cloud Function으로 자동 동기화
- 트랜잭션 사용

### 4. UX 복잡도
**위험**: 너무 많은 정보로 인한 복잡도 증가
**대응**:
- 탭 구조로 정보 분산
- 점진적 공개 (Progressive Disclosure)
- 사용 빈도 높은 정보 우선 표시

---

## 📝 참고 자료

### makeEdu 벤치마킹 포인트
1. ✅ **좌우 분할 레이아웃** - 목록 + 상세
2. ✅ **다중 탭 구조** - 정보 분류
3. ✅ **실시간 검색** - 빠른 학생 찾기
4. ✅ **액션 버튼 그룹** - 자주 쓰는 기능 빠른 접근
5. ✅ **상세 정보 폼** - 레이블 + 값 + 액션

### 개선할 점
1. **더 나은 UX**: 모던한 디자인 (Material-UI, Tailwind)
2. **모바일 대응**: 반응형 디자인
3. **실시간 동기화**: Firestore 실시간 업데이트
4. **검색 강화**: 다중 조건 검색, 자동완성
5. **데이터 시각화**: 차트, 그래프 활용

---

## ✅ 체크리스트

### 설계 단계
- [x] 요구사항 정의
- [x] 화면 설계
- [x] 데이터 모델 설계
- [x] API 설계
- [ ] UX 검토

### 개발 단계
- [ ] 컴포넌트 개발
- [ ] API 연동
- [ ] 테스트 작성
- [ ] 성능 최적화
- [ ] 문서화

### 배포 단계
- [ ] 스테이징 배포
- [ ] QA 테스트
- [ ] 사용자 피드백
- [ ] 프로덕션 배포
- [ ] 모니터링 설정

---

## 📞 문의 및 피드백

**담당자**: 개발팀
**작성자**: Claude Sonnet 4.5 (academy-domain-expert)
**최종 검토**: 2026-01-08

---

**다음 단계**:
1. 본 문서 검토 및 승인
2. 상세 UI/UX 디자인 (Figma)
3. 개발 착수 (Week 1)

**예상 완료일**: 2026-01-31
