# 세미나 관리 시스템 구현

## 작업 날짜
2026-01-09

## 개요

기존의 간단한 "참가자 관리" 패널을 완전히 재설계하여 **세미나/설명회 전문 관리 시스템**으로 전환했습니다.

## 주요 기능

### 1. 연사 정보 관리
- 연사 이름
- 연락처
- 소개 (텍스트 에리어)

### 2. 참석자 관리 (재원생/비재원생 구분)

#### 재원생
- 학생 검색 (이름 또는 ID)
- 기존 학생 데이터 자동 연동
- 전화번호 자동 입력

#### 비재원생
- 수동 정보 입력
- 성별 (남/여)
- 연령대 (초등/중등/고등/성인)
- 학년 (예: 초6, 중2)
- 주소 (간략히)

### 3. 참석자 상세 정보

모든 참석자(재원생/비재원생)에 대해:
- **이름** (필수)
- **전화번호** (필수)
- 신청 경로 (지인소개, 온라인, 전단지 등)
- 부모 동반 참석 여부 (체크박스)
- 동석자 명단 (TODO: 구현 예정)
- 담당 선생님 지정
- 메모

### 4. 참석 상태 관리
- `registered`: 등록됨
- `confirmed`: 확인됨
- `attended`: 참석함
- `cancelled`: 취소됨
- `no-show`: 불참

### 5. 통계
- 총 참석자 수
- 재원생 수

---

## 데이터 구조

### SeminarAttendee (확장)

```typescript
export interface SeminarAttendee {
  id: string;

  // 기본 정보
  name: string;
  phone: string;              // 전화번호 (필수)
  isCurrentStudent: boolean;  // 재원생 여부
  studentId?: string;         // 재원생인 경우 학생 ID

  // 비재원생 정보
  gender?: 'male' | 'female';
  ageGroup?: 'elementary' | 'middle' | 'high' | 'adult';
  grade?: string;             // 학년
  address?: string;           // 주소

  // 신청 정보
  registrationSource?: string; // 신청경로
  parentAttending?: boolean;   // 부모 참석 여부
  companions?: string[];       // 동석자

  // 담당 및 상태
  assignedTeacherId?: string;
  assignedTeacherName?: string;
  status: 'registered' | 'confirmed' | 'attended' | 'cancelled' | 'no-show';

  // 메타 정보
  registeredAt: string;
  memo?: string;
  createdBy?: string;
  updatedAt?: string;
}
```

### SeminarEventData (확장)

```typescript
export interface SeminarEventData {
  // 연사 정보
  speaker?: string;
  speakerBio?: string;
  speakerContact?: string;    // 추가

  // 관리 정보
  manager?: string;
  managerContact?: string;
  maxAttendees?: number;

  // 참석자 목록
  attendees?: SeminarAttendee[];

  // 장소 및 자료
  venue?: string;
  materials?: string[];

  // 기타
  registrationDeadline?: string;
  isPublic?: boolean;
}
```

---

## 새 파일

### `components/Calendar/SeminarPanel.tsx`

완전히 새롭게 설계된 세미나 관리 패널

**주요 컴포넌트**:
1. 연사 정보 섹션 (보라색 테마)
2. 참석자 추가 폼 (재원생/비재원생 토글)
3. 참석자 목록
4. 통계 섹션

---

## 수정된 파일

### 1. `types.ts`
- `SeminarAttendee` 인터페이스 확장
- `SeminarEventData`에 `speakerContact` 추가

### 2. `components/Calendar/EventModal.tsx`
- `ParticipantsPanel` → `SeminarPanel`로 교체
- `SeminarEventData` state 추가
- Import 수정

---

## UI 구조

```
┌──────────────────────────────────────┐
│ 세미나 관리                   [X]    │ ← 헤더 (보라색)
├──────────────────────────────────────┤
│ 일정: 2026년 학부모 설명회           │
├──────────────────────────────────────┤
│                                      │
│ [연사 정보] (보라색 배경)             │
│ ├ 연사 이름: _______                 │
│ ├ 연락처: _______                    │
│ └ 소개: _______                      │
│                                      │
│ [참석자 목록]              [+ 추가]  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 새 참석자                    [X]│  │
│ │                                │  │
│ │ [비재원생] [재원생] ← 토글      │  │
│ │                                │  │
│ │ 이름: _______                  │  │
│ │ 전화번호: _______              │  │
│ │ 성별: [남/여]                  │  │
│ │ 연령대: [초등/중등/고등/성인]   │  │
│ │ 학년: _______                  │  │
│ │ 주소: _______                  │  │
│ │ 신청경로: _______              │  │
│ │ ☑ 부모 동반 참석               │  │
│ │ 담당선생님: [드롭다운]          │  │
│ │ 메모: _______                  │  │
│ │                                │  │
│ │ [참석자 추가]                   │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 홍길동          [재원생]    [X]│  │
│ │ 010-1234-5678                  │  │
│ │ 담당: 김선생                   │  │
│ └────────────────────────────────┘  │
│                                      │
│ [통계]                               │
│ ├ 총 참석자: 12                      │
│ └ 재원생: 8                          │
│                                      │
├──────────────────────────────────────┤
│              [저장]                  │ ← Footer
└──────────────────────────────────────┘
```

---

## 재원생/비재원생 구분 UI

### 라디오 버튼 스타일
```tsx
<label className="flex-1 ... border-2 rounded-lg"
  style={{
    borderColor: selected ? '#9333ea' : '#e5e7eb',
    backgroundColor: selected ? '#f3e8ff' : '#fff'
  }}
>
  <input type="radio" className="hidden" />
  <span>비재원생</span>
</label>
```

- 선택 시: 보라색 테두리 + 연한 보라색 배경
- 미선택 시: 회색 테두리 + 흰색 배경

---

## 학생 검색 기능

재원생 선택 시 자동으로 검색 인풋 표시:

```tsx
{newAttendee.isCurrentStudent && (
  <div className="relative">
    <Search icon />
    <input placeholder="학생 이름 또는 ID 검색" />
    {filteredStudents.map(student => (
      <button onClick={() => handleStudentSelect(student)}>
        {student.name}
      </button>
    ))}
  </div>
)}
```

- 학생 선택 시 이름, 전화번호 자동 입력
- studentId 자동 매핑

---

## 향후 작업 (TODO)

### 1. 동석자 관리
```typescript
companions?: string[];  // 동석자 이름 배열
```

현재는 필드만 정의되어 있음. UI 구현 필요:
- 동석자 추가 버튼
- 동석자 이름 입력
- 동석자 목록 표시

### 2. Firebase 연동
```typescript
// CalendarEvent 저장 시 seminarData 포함
{
  ...eventData,
  seminarData: {
    speaker,
    speakerContact,
    speakerBio,
    attendees
  }
}
```

### 3. 기존 학생 데이터 로드
```tsx
// EventModal에서 useStudents hook 사용
const { data: students } = useStudents();

<SeminarPanel
  students={students}
  ...
/>
```

### 4. 참석자 상태 변경 UI
- 참석자 카드에 상태 변경 버튼 추가
- `registered` → `confirmed` → `attended`

### 5. 출석 확인 기능
- QR 코드 생성
- 실시간 참석 체크

### 6. 알림 기능
- 등록 마감일 알림
- 참석자에게 SMS/카카오톡 발송

---

## 스타일 가이드

### 색상 테마
- **보라색**: 세미나 관련 (`purple-600`, `purple-50`)
- **파란색**: 재원생 표시 (`blue-100`, `blue-700`)
- **회색**: 비활성/기본 상태

### 아이콘
- `Users`: 참가자 관리
- `UserPlus`: 참석자 추가
- `Search`: 학생 검색
- `Trash2`: 삭제
- `Save`: 저장
- `XCircle`: 취소/닫기

---

## 테스트 시나리오

### 1. 연사 정보 입력
- [ ] 연사 이름 입력
- [ ] 연락처 입력
- [ ] 소개 입력

### 2. 비재원생 추가
- [ ] "비재원생" 선택
- [ ] 이름, 전화번호 입력 (필수)
- [ ] 성별, 연령대, 학년 입력
- [ ] 주소 입력
- [ ] 신청 경로 입력
- [ ] 부모 동반 참석 체크
- [ ] 담당 선생님 선택
- [ ] 메모 입력
- [ ] "참석자 추가" 클릭
- [ ] 목록에 추가 확인

### 3. 재원생 추가
- [ ] "재원생" 선택
- [ ] 검색창 표시 확인
- [ ] 학생 이름 검색
- [ ] 검색 결과 클릭
- [ ] 이름, 전화번호 자동 입력 확인
- [ ] 담당 선생님 선택
- [ ] "참석자 추가" 클릭

### 4. 참석자 관리
- [ ] 참석자 카드 표시 확인
- [ ] 재원생 배지 표시 확인
- [ ] 담당 선생님 표시 확인
- [ ] 삭제 버튼 클릭 → 목록에서 제거

### 5. 통계
- [ ] 총 참석자 수 정확성
- [ ] 재원생 수 정확성

### 6. 저장
- [ ] "저장" 버튼 클릭
- [ ] `onUpdateSeminarData` 콜백 호출 확인

---

## 마이그레이션 가이드

### 기존 ParticipantsPanel 사용 코드

**Before:**
```tsx
<ParticipantsPanel
  isOpen={isPanelOpen}
  eventTitle={title}
  participants={[]}
  onClose={() => setIsPanelOpen(false)}
  onAddParticipant={...}
  onUpdateStatus={...}
  onRemoveParticipant={...}
/>
```

**After:**
```tsx
<SeminarPanel
  isOpen={isPanelOpen}
  eventTitle={title}
  seminarData={seminarData}
  students={students}
  users={users}
  onClose={() => setIsPanelOpen(false)}
  onUpdateSeminarData={(data) => setSeminarData(data)}
/>
```

---

## 완료 시간
약 2시간

## 영향 범위
- 새 파일: SeminarPanel.tsx
- 수정된 파일: types.ts, EventModal.tsx
- 기존 ParticipantsPanel.tsx: 더 이상 사용하지 않음 (삭제 가능)
