# 근태 관리 탭 신규 생성 계획

## 개요
직원 관리의 "휴가 관리" 기능을 독립적인 "근태 관리" 탭으로 분리하여, 모든 직원의 근태 관련 사항을 종합 관리하는 시스템 구축

## 현재 구조

### 직원 관리 탭
```
직원 관리
├── 💼 직원 목록
├── 🛡️ 시스템 사용자
├── 📅 근무 일정
└── 🏖️ 휴가 관리 ← 이동 대상
```

## 목표 구조

### 근태 관리 탭 (신규)
```
근태 관리
├── 📊 대시보드
│   ├── 오늘의 근태 현황
│   ├── 휴가 사용 현황
│   ├── 지각/조퇴 통계
│   └── 부서별 출근율
├── 🏖️ 휴가 관리 (기존 LeaveManagement)
│   ├── 휴가 신청 승인
│   ├── 휴가 일정
│   ├── 연차 관리
│   └── 휴가 유형별 통계
├── ⏰ 근무 시간
│   ├── 출퇴근 기록
│   ├── 근무 시간 통계
│   ├── 초과 근무
│   └── 탄력 근무
├── 📝 근태 기록
│   ├── 출결 현황
│   ├── 지각/조퇴/결근
│   ├── 근태 이력
│   └── 예외 처리
└── 🤖 AI 분석 (에이전트/MCP)
    ├── 근태 패턴 분석
    ├── 이상 징후 감지
    ├── 자동 리포트 생성
    └── 근태 개선 제안
```

## 주요 기능

### 1. 휴가 관리 (기존 이전)
- **현재 위치**: `components/Staff/LeaveManagement.tsx`
- **이동 위치**: `components/AttendanceManagement/LeaveManagement.tsx`
- **기능**:
  - 휴가 신청 승인/거부
  - 휴가 일정 캘린더
  - 연차 잔여일 관리
  - 휴가 통계

### 2. 근무 시간 관리 (신규)
- 출퇴근 시간 기록
- 근무 시간 계산
- 초과 근무 관리
- 탄력 근무제 지원

### 3. 근태 기록 (신규)
- 출결 체크
- 지각/조퇴/결근 관리
- 근태 이력 조회
- 예외 사유 관리

### 4. AI 분석 (에이전트/MCP 활용)
- **패턴 분석**:
  - 지각 빈도 분석
  - 부서별 출근율 비교
  - 시즌별 휴가 패턴

- **이상 징후 감지**:
  - 연속 지각 직원 알림
  - 비정상적인 근무 패턴
  - 휴가 남용 감지

- **자동 리포트**:
  - 월간 근태 리포트
  - 부서별 근태 현황
  - 관리자용 요약 리포트

- **개선 제안**:
  - 근무 시간 최적화
  - 휴가 분산 권장
  - 근태 관리 개선안

## 데이터 구조

### Firestore Collections

```typescript
// 출퇴근 기록
interface AttendanceRecord {
  id: string;
  staffId: string;
  date: string;
  checkIn?: Timestamp;
  checkOut?: Timestamp;
  workHours?: number;
  status: 'present' | 'late' | 'early_leave' | 'absent' | 'on_leave';
  note?: string;
  createdAt: Timestamp;
}

// 휴가 기록 (기존 StaffLeave 확장)
interface LeaveRecord {
  id: string;
  staffId: string;
  type: 'annual' | 'sick' | 'personal' | 'unpaid';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
}

// 근태 설정
interface AttendanceConfig {
  workStartTime: string; // "09:00"
  workEndTime: string;   // "18:00"
  lateThreshold: number; // 분 단위
  overtimeRate: number;  // 초과 근무 수당
  annualLeaveDays: number; // 연간 연차 일수
}
```

## 기술 스택

### 1. 에이전트 통합
```typescript
// 근태 분석 에이전트
interface AttendanceAgent {
  analyzePattern(staffId: string, period: DateRange): Promise<PatternAnalysis>;
  detectAnomalies(departmentId: string): Promise<Anomaly[]>;
  generateReport(type: ReportType): Promise<Report>;
  suggestImprovements(data: AttendanceData): Promise<Suggestion[]>;
}
```

### 2. MCP (Model Context Protocol) 활용
- **데이터 수집**: 자동으로 근태 데이터 수집
- **분석**: LLM을 활용한 패턴 분석
- **리포트**: 자연어 기반 리포트 생성
- **알림**: 이상 징후 자동 알림

## 구현 단계

### Phase 1: 기본 구조 (백그라운드)
- [ ] AttendanceManagement 컴포넌트 생성
- [ ] LeaveManagement 이동
- [ ] 탭 구조 구현
- [ ] 기본 UI 완성

### Phase 2: 근무 시간 관리 (백그라운드)
- [ ] 출퇴근 기록 기능
- [ ] 근무 시간 계산
- [ ] 통계 대시보드

### Phase 3: 근태 기록 (백그라운드)
- [ ] 출결 체크 기능
- [ ] 지각/조퇴 관리
- [ ] 이력 조회

### Phase 4: AI 통합 (에이전트/MCP)
- [ ] 패턴 분석 에이전트
- [ ] 이상 징후 감지
- [ ] 자동 리포트 생성
- [ ] MCP 통합

## App.tsx 통합

```typescript
// 새로운 appMode 추가
type AppMode =
  | 'calendar'
  | 'timetable'
  | 'classes'
  | 'students'
  | 'consultation'
  | 'gantt'
  | 'attendance'      // 기존 출석부
  | 'staff'           // 직원 관리
  | 'staff-attendance' // 신규 근태 관리
  | ...

// 탭 정의
{
  id: 'staff-attendance',
  label: '근태 관리',
  emoji: '⏰',
  component: <AttendanceManagementTab />,
  permissions: ['attendance.view']
}
```

## 직원 관리 변경사항

### 변경 전
```
직원 관리
├── 직원 목록
├── 시스템 사용자
├── 근무 일정
└── 휴가 관리
```

### 변경 후
```
직원 관리
├── 직원 목록
├── 시스템 사용자
└── 근무 일정 (스케줄링만)
```

## 이점

1. **명확한 관심사 분리**
   - 직원 관리: 직원 정보, 계약, 인사
   - 근태 관리: 출퇴근, 휴가, 근무 시간

2. **확장성**
   - 근태 관련 기능 집중 추가 가능
   - AI/MCP 통합이 용이

3. **사용자 경험**
   - 근태 관리자가 한 곳에서 모든 것 확인
   - 직원 관리 탭이 심플해짐

4. **데이터 분석**
   - 근태 데이터 중앙화
   - 통계 및 리포트 생성 용이

## 주의사항

1. **데이터 마이그레이션**
   - 기존 휴가 데이터 보존
   - staffLeaves 컬렉션 유지

2. **권한 관리**
   - 새로운 권한 추가: `attendance.view`, `attendance.manage`
   - 기존 휴가 관련 권한 통합

3. **UI 일관성**
   - 직원 관리와 비슷한 디자인 패턴 유지
   - 색상 스킴 통일

## 다음 액션

1. ✅ 계획 문서 작성 (현재)
2. ⏳ AttendanceManagementTab 컴포넌트 스켈레톤 생성
3. ⏳ LeaveManagement 이동
4. ⏳ 기본 UI 구현
5. ⏳ 에이전트/MCP 통합 설계

---

**작성일**: 2026-01-16
**상태**: 계획 단계
**우선순위**: 백그라운드 작업
