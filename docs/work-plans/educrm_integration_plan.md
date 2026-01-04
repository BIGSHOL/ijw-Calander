# EduCRM → IJW Calendar 통합 구현 계획 ✅ 완료

## 개요

학원 입학상담 관리 앱(EduCRM)을 IJW Calendar의 5번째 탭으로 통합합니다.

### 현재 탭 구조
| # | 탭 이름 | 상태 |
|---|---------|------|
| 1 | 연간 일정 | ✅ 구현됨 |
| 2 | 시간표 | ✅ 구현됨 |
| 3 | 전자 결제 | ✅ 구현됨 |
| 4 | 간트 차트 | ✅ 구현됨 |
| 5 | **상담 관리** | 🆕 신규 추가 |

---

## User Review Required

> [!IMPORTANT]
> **Firebase 컬렉션 설계**
> - 새로운 `consultations` 컬렉션을 Firestore에 생성합니다
> - 현재 EduCRM은 로컬 state + MockData를 사용 중이므로 전환이 필요합니다

> [!WARNING]
> **Gemini AI 기능**
> - EduCRM에는 `@google/genai` 기반 AI 분석 기능이 있습니다
> - IJW Calendar에도 이미 `@google/genai`가 설치되어 있어 호환 가능합니다
> - **별도 API 키 설정이 필요할 수 있습니다**

---

## 기술 호환성 분석

### ✅ 완벽 호환 (변경 불필요)

| 항목 | EduCRM | IJW Calendar |
|------|--------|--------------|
| React | 19.2.3 | 19.2.3 ✅ |
| Vite | 6.2.0 | 6.2.0 ✅ |
| date-fns | 4.1.0 | 4.1.0 ✅ |
| lucide-react | 0.562.0 | 0.562.0 ✅ |
| recharts | 3.6.0 | 3.6.0 ✅ |
| @google/genai | 1.34.0 | 1.34.0 ✅ |
| TypeScript | 5.8.2 | 5.8.2 ✅ |

### ⚠️ 변환 필요

| 항목 | EduCRM | IJW Calendar | 변환 작업 |
|------|--------|--------------|-----------|
| 데이터 저장 | 로컬 state + MockData | Firestore | Hook 생성 필요 |
| UUID | uuid 패키지 | - | 제거 (Firestore ID 사용) |
| 인증 | 없음 | Firebase Auth | 연동 필요 |

---

## 이전 대상 파일

### EduCRM 원본 구조
```
educrm---academy-counseling-manager/
├── App.tsx                      # 메인 앱 (분리 필요)
├── types.ts                     # 타입 정의
├── constants.ts                 # 상수 정의
├── components/
│   ├── Dashboard.tsx            # 대시보드 (차트)
│   ├── ConsultationTable.tsx    # 상담 목록 테이블
│   ├── ConsultationForm.tsx     # 상담 등록/수정 폼
│   └── StatsCard.tsx            # 통계 카드
└── services/
    ├── geminiService.ts         # AI 분석 서비스
    └── mockData.ts              # 목업 데이터 (제거)
```

### IJW Calendar 목표 구조
```
ijw-calander/
├── components/
│   └── Consultation/           # [NEW] 상담 관리 폴더
│       ├── ConsultationManager.tsx    # 메인 컴포넌트
│       ├── ConsultationDashboard.tsx  # 대시보드
│       ├── ConsultationTable.tsx      # 목록 테이블
│       ├── ConsultationForm.tsx       # 등록/수정 폼
│       └── StatsCard.tsx              # 통계 카드
├── hooks/
│   └── useConsultations.ts     # [NEW] Firestore Hook
├── types.ts                    # 기존 types에 추가
└── services/
    └── geminiConsultationService.ts  # [NEW] AI 서비스
```

---

## Proposed Changes

### Phase 1: 기반 구조 (30분)

---

#### [MODIFY] [types.ts](file:///f:/ijw-calander/types.ts)
- 상담 관련 타입 추가:
  - `ConsultationStatus` enum
  - `ConsultationSubject` enum  
  - `SchoolGrade` enum
  - `ConsultationRecord` interface
  - `DashboardStats` interface

---

#### [NEW] [useConsultations.ts](file:///f:/ijw-calander/hooks/useConsultations.ts)
- Firestore CRUD Hook 생성:
  - `useConsultations()`: 상담 목록 조회
  - `useCreateConsultation()`: 상담 등록
  - `useUpdateConsultation()`: 상담 수정
  - `useDeleteConsultation()`: 상담 삭제
- React Query 기반 (기존 패턴 따름)

---

### Phase 2: 컴포넌트 이전 (1.5시간)

---

#### [NEW] components/Consultation/ (디렉토리)

##### [NEW] ConsultationManager.tsx
- EduCRM의 App.tsx에서 레이아웃 분리
- 사이드바 제거 (IJW Calendar 메인 탭 사용)
- view state: 'dashboard' | 'table'

##### [NEW] ConsultationDashboard.tsx
- Dashboard.tsx 복사 후 수정
- props로 데이터 받도록 변경
- AI 분석 기능 유지

##### [NEW] ConsultationTable.tsx
- 원본과 거의 동일하게 복사
- 드래그앤드롭, 정렬 기능 유지

##### [NEW] ConsultationForm.tsx
- 모달 폼 (등록/수정)
- 원본과 거의 동일하게 복사

##### [NEW] StatsCard.tsx
- 통계 카드 컴포넌트
- 원본 그대로 복사

---

#### [NEW] [geminiConsultationService.ts](file:///f:/ijw-calander/services/geminiConsultationService.ts)
- EduCRM의 geminiService.ts 복사
- API 키 환경 변수 연동

---

### Phase 3: 메인 앱 통합 (30분)

---

#### [MODIFY] [App.tsx](file:///f:/ijw-calander/App.tsx)
- AppTab 타입에 'consultation' 추가
- 5번째 탭 버튼 추가 (📋 상담 관리)
- ConsultationManager 렌더링 조건 추가

---

#### [MODIFY] [types.ts](file:///f:/ijw-calander/types.ts)
- APP_TABS 배열에 추가:
  ```typescript
  { id: 'consultation', label: '상담 관리' }
  ```
- DEFAULT_TAB_PERMISSIONS 업데이트

---

### Phase 4: Firestore 설정 (15분)

---

#### [MODIFY] [firestore.rules](file:///f:/ijw-calander/firestore.rules)
- consultations 컬렉션 접근 규칙 추가:
  ```javascript
  match /consultations/{consultationId} {
    allow read: if isAuthenticated();
    allow create, update: if hasRole(['master', 'admin', 'manager']);
    allow delete: if hasRole(['master', 'admin']);
  }
  ```

---

#### [MODIFY] [firestore.indexes.json](file:///f:/ijw-calander/firestore.indexes.json)
- 상담 목록 쿼리용 인덱스 추가 (consultationDate, status)

---

## Verification Plan

### 자동화 테스트

현재 프로젝트에 자동화 테스트가 없으므로 **수동 테스트**로 검증합니다.

### 수동 검증 (필수)

#### 1. 빌드 테스트
```bash
cd f:\ijw-calander
npm run build
```
- ✅ 에러 없이 빌드 완료 확인

#### 2. 탭 표시 테스트
1. `npm run dev` 실행
2. http://localhost:5173 접속
3. 상단 탭 바에 "📋 상담 관리" 탭이 5번째로 표시되는지 확인
4. 탭 클릭 시 상담 관리 화면으로 전환되는지 확인

#### 3. 상담 CRUD 테스트
1. 상담 관리 탭 진입
2. **등록 테스트**: "상담 등록" 버튼 클릭 → 폼 작성 → 저장 → 목록에 반영 확인
3. **조회 테스트**: 등록된 상담이 테이블에 표시되는지 확인
4. **수정 테스트**: 항목 수정 → 변경사항 저장 → 반영 확인
5. **삭제 테스트**: 항목 삭제 → 목록에서 제거 확인

#### 4. 대시보드 테스트
1. 대시보드 뷰로 전환
2. 통계 카드가 올바르게 표시되는지 확인
3. 차트가 데이터에 맞게 렌더링되는지 확인

#### 5. AI 분석 테스트 (선택적)
1. "AI 운영 리포트 생성" 버튼 클릭
2. AI 응답이 표시되는지 확인
- ⚠️ API 키가 설정되지 않으면 에러 발생 예상

---

## 예상 소요 시간

| 단계 | 예상 시간 |
|------|-----------|
| Phase 1: 기반 구조 | 30분 |
| Phase 2: 컴포넌트 이전 | 1.5시간 |
| Phase 3: 메인 앱 통합 | 30분 |
| Phase 4: Firestore 설정 | 15분 |
| 테스트 및 디버깅 | 30분 |
| **총 예상 시간** | **3시간 15분** |

---

## 의존성 설치

추가 설치 필요 없음 (모든 의존성 이미 존재)

---

## 결론

### ✅ 이전 가능성: **높음**

- 기술 스택 100% 호환
- 컴포넌트 구조 재활용 가능
- 주요 작업은 데이터 레이어(Firebase) 전환

### 주요 변경 사항
1. 로컬 state → Firestore
2. MockData 제거 → 실제 데이터
3. 독립 앱 → 탭 컴포넌트로 변환

**승인 후 구현을 시작합니다.**
