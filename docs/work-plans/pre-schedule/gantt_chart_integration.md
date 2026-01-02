# 간트 차트 탭 통합 계획

> 작성일: 2026-01-02
> 구현일: 2026-01-02
> 상태: **✅ Phase 1-5 완료 (Firebase 연동 완료)**
> 우선순위: 🟢 완료
> 버전: v2.0 (Firebase 연동 완료)

---

## 📋 개요

### 목표
`customgantt_-project-builder` 프로젝트의 간트 차트 기능을 `ijw-calander`의 4번째 탭 "간트 차트"로 통합

### 현재 탭 구조

```
📅 연간 일정 → 📋 시간표 → 💳 전자 결제 → [📊 간트 차트 (NEW)]
  (calendar)     (timetable)    (payment)         (gantt)
```

---

## 📂 소스 코드 분석

### customgantt_-project-builder 구조

```
customgantt_-project-builder/
├── App.tsx                    # 메인 앱 (154줄)
├── types.ts                   # 타입 정의 (30줄)
├── package.json               # 의존성
├── components/
│   ├── GanttBuilder.tsx       # 프로젝트 생성/편집 (7,965B)
│   ├── GanttChart.tsx         # 간트 차트 시각화 (7,006B)
│   ├── TaskList.tsx           # 작업 목록 (2,719B)
│   ├── ProgressBar.tsx        # 진행률 표시 (1,065B)
│   ├── TemplateSelector.tsx   # 템플릿 선택 화면 (5,176B)
│   ├── InputSection.tsx       # 입력 섹션 (2,364B)
│   └── Layout.tsx             # 레이아웃 (1,002B)
└── services/
    └── geminiService.ts       # Gemini AI 연동 (2,672B)
```

### 타입 정의

```typescript
// 이전 필요한 인터페이스
interface SubTask {
  id: string;
  title: string;
  description: string;
  startOffset: number;  // 시작 오프셋 (일 단위)
  duration: number;     // 기간 (일 단위)
  completed: boolean;
}

interface GanttTemplate {
  id: string;
  title: string;
  description: string;
  tasks: SubTask[];
  createdAt: number;
}
```

### 의존성

| 패키지 | 버전 | ijw-calander 보유 여부 |
|--------|------|:---------------------:|
| `recharts` | ^3.6.0 | ✅ 보유 |
| `@google/genai` | ^1.34.0 | ❌ **추가 필요** |

---

## 🔧 마이그레이션 계획

### Phase 1: 타입 및 의존성 준비 ✅

| 작업 | 파일 | 상태 |
|------|------|:------:|
| GanttSubTask, GanttTemplate, GanttProject 추가 | `types.ts` | ✅ |
| AppTab에 'gantt' 추가 | `types.ts` | ✅ |
| DEFAULT_TAB_PERMISSIONS 업데이트 | `types.ts` | ✅ |
| gantt.* 권한 ID 추가 | `types.ts` | ✅ |

### Phase 2: 컴포넌트 이전 ✅

| 컴포넌트 | 대상 경로 | 상태 |
|----------|----------|:------:|
| GanttBuilder.tsx | `components/Gantt/` | ✅ |
| GanttChart.tsx | `components/Gantt/` | ✅ |
| GanttTaskList.tsx | `components/Gantt/` | ✅ |
| GanttProgressBar.tsx | `components/Gantt/` | ✅ |
| GanttTemplateSelector.tsx | `components/Gantt/` | ✅ |
| GanttManager.tsx | `components/Gantt/` | ✅ |

### Phase 3: 메인 앱 통합 ✅

| 작업 | 파일 | 상태 |
|------|------|:------:|
| GanttManager import | `App.tsx` | ✅ |
| appMode 타입에 'gantt' 추가 | `App.tsx` | ✅ |
| 헤더에 간트 탭 버튼 추가 | `App.tsx` | ✅ |
| GanttManager 렌더링 | `App.tsx` | ✅ |

### Phase 4: Firestore 연동 ✅

| 작업 | 설명 | 상태 |
|------|------|:------:|
| useGanttTemplates.ts 작성 | React Query 기반 템플릿 CRUD | ✅ |
| useGanttProjects.ts 작성 | React Query 기반 프로젝트 CRUD | ✅ |
| GanttManager 리팩토링 | localStorage → Firestore 전환 | ✅ |
| Loading/Error 상태 추가 | UX 개선 | ✅ |

### Phase 5: 권한 시스템 연동 ✅

| 작업 | 설명 | 상태 |
|------|------|:------:|
| Security Rules 작성 | gantt_templates, gantt_projects 규칙 | ✅ |
| 권한별 접근 제어 | MASTER/ADMIN/MANAGER/EDITOR/USER | ✅ |

---

## 📁 최종 파일 구조

```
ijw-calander/
├── components/
│   └── Gantt/
│       ├── GanttManager.tsx         ✅ 메인 래퍼 (Firestore 연동)
│       ├── GanttBuilder.tsx         ✅ 프로젝트 생성/편집
│       ├── GanttChart.tsx           ✅ 간트 차트 시각화
│       ├── GanttTaskList.tsx        ✅ 작업 목록
│       ├── GanttProgressBar.tsx     ✅ 진행률 표시
│       └── GanttTemplateSelector.tsx ✅ 템플릿 선택
├── hooks/
│   ├── useGanttTemplates.ts         ✅ 템플릿 CRUD hooks (NEW)
│   ├── useGanttProjects.ts          ✅ 프로젝트 CRUD hooks (NEW)
│   └── usePermissions.ts            ✅ 권한 체크
├── services/
│   └── geminiService.ts             ✅ Gemini AI 서비스
├── types.ts                         ✅ 타입 정의
└── firestore.rules                  ✅ Security Rules (간트 규칙 추가)
```

---

## 📊 Firestore 컬렉션 설계

### gantt_templates 컬렉션

```typescript
interface FirestoreGanttTemplate {
  id: string;
  title: string;
  description: string;
  tasks: SubTask[];
  createdAt: Timestamp;
  createdBy: string;         // 작성자 UID
  createdByEmail: string;    // 작성자 이메일
  isShared: boolean;         // 공유 여부
}
```

### gantt_projects (진행 중인 프로젝트)

```typescript
interface FirestoreGanttProject {
  id: string;
  templateId: string;
  title: string;
  tasks: SubTask[];          // 현재 진행 상태 포함
  progress: number;          // 진행률 (%)
  startedAt: Timestamp;
  lastUpdated: Timestamp;
  ownerId: string;           // 담당자 UID
}
```

---

## ⏱️ 예상 소요 시간

| Phase | 작업 | 소요 시간 |
|-------|------|----------|
| 1 | 타입 및 의존성 준비 | 30분 |
| 2 | 컴포넌트 이전 | 2시간 |
| 3 | 메인 앱 통합 | 1시간 |
| 4 | Firestore 연동 | 1.5시간 |
| 5 | 권한 시스템 연동 | 30분 |
| - | 테스트 및 디버깅 | 1시간 |
| **총계** | | **~6.5시간** |

---

## 🧪 테스트 시나리오

### 기능 테스트

1. **템플릿 CRUD**
   - 템플릿 생성, 조회, 수정, 삭제

2. **프로젝트 실행**
   - 템플릿에서 프로젝트 시작
   - 작업 완료 토글
   - 진행률 업데이트

3. **Gemini AI 연동**
   - AI로 프로젝트 생성
   - 작업 자동 분해

### 권한 테스트

| 역할 | 보기 | 생성 | 편집 | 삭제 |
|------|:----:|:----:|:----:|:----:|
| MASTER | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ | ✅ | ✅ | ❌ |
| EDITOR | ✅ | ✅ | ❌ | ❌ |
| USER | ✅ | ❌ | ❌ | ❌ |

---

## ⚠️ 주의사항

### 1. 스타일 일관성
- 기존 ijw-calander의 디자인 시스템 적용 필요
- 색상: `#081429` (네이비), `#fdb813` (노란색)
- 폰트: Pretendard 또는 시스템 폰트

### 2. Gemini API 키 관리
- 환경 변수로 API 키 관리
- `.env.local`에 `VITE_GEMINI_API_KEY` 추가

### 3. Firebase Security Rules
- `gantt_templates`, `gantt_projects` 컬렉션 규칙 추가 필요

---

## 다음 단계

1. **계획 승인**: 이 문서 검토 후 승인
2. **Phase 1 시작**: 타입 정의 및 의존성 추가
3. **Phase 2-5**: 순차적 구현
4. **테스트**: 전체 기능 검증
5. **배포**: 프로덕션 반영

---

## 관련 문서

- [types.ts](../../../types.ts) - 타입 정의
- [default_tab_selection.md](../default_tab_selection.md) - 탭 권한 시스템
- [team_leader_roles.md](../team_leader_roles.md) - 역할 권한

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-01-02 | 초안 작성 |
| v1.1 | 2026-01-02 | Phase 1-3 구현 완료 (localStorage 기반) |
| v2.0 | 2026-01-02 | Phase 4-5 구현 완료 (Firebase 연동) |

---

## ✅ 검증 체크리스트 (2026-01-02 완료)

### 도메인 적합성 검증
- [x] 학원 업무 시나리오 적합성 확인
- [x] 데이터 모델 학원 특화 검토
- [x] 권한 시스템 9단계 역할 체계 일치
- [ ] ⚠️ 연간 일정 시스템 통합 (추후 개선)
- [ ] ⚠️ 알림 시스템 연동 (추후 개선)

### 기술 아키텍처 검증
- [x] 컴포넌트 구조 및 파일 조직
- [x] TypeScript 타입 정의 완전성
- [x] Firestore 스키마 설계
- [x] Phase별 마이그레이션 순서
- [x] 의존성 관리 (recharts, @google/genai)
- [x] Firebase Security Rules 작성
- [ ] ⚠️ Firestore 복합 인덱스 설정 (수동 생성 필요)

### Firebase 비용 최적화 검증
- [x] 현재 설계 비용 분석 (무료 범위 내)
- [ ] ⚠️ Meta 컬렉션 분리 권장 (향후 확장성)
- [ ] ⚠️ 서브컬렉션 활용 고려
- [x] React Query 캐싱 전략
- [x] 페이지네이션 적용

---

## ⚠️ 알려진 제한사항 및 개선 권장사항

### 우선순위 🔴 높음
1. **Firestore 인덱스 수동 생성 필요**
   - `gantt_templates`: `createdBy ASC, createdAt DESC`
   - `gantt_templates`: `isShared ASC, createdAt DESC`
   - Firebase Console에서 수동 생성 또는 첫 쿼리 시 자동 생성 링크 제공

2. **AppTab 타입 정의 명확화**
   - 현재: `'calendar' | 'timetable' | 'payment' | 'system'`
   - 'gantt' 탭 추가 시 'system'과의 관계 정리 필요

### 우선순위 🟡 중간
3. **학원 특화 데이터 모델 확장 (선택적)**
   - 담당자 필드 추가 (`assigneeId`, `assigneeName`)
   - 부서 연동 (`departmentIds[]`)
   - 작업 의존성 (`dependencies[]`)
   - 상태 세분화 (`not_started`, `in_progress`, `on_hold`, `completed`)

4. **연간 일정 시스템 통합**
   - 프로젝트 마일스톤을 캘린더에 자동 표시
   - 시작일/마감일 이벤트 생성

5. **비용 최적화 (사용자 증가 시)**
   - Meta 컬렉션 분리 (목록 조회 최적화)
   - 서브컬렉션 활용 (tasks 배열 → tasks 서브컬렉션)
   - 예상 효과: 읽기 61% 감소, 네트워크 92% 절감

### 우선순위 🟢 낮음
6. **UI/UX 개선**
   - 모바일 최적화 (타임라인 리스트 뷰)
   - 접근성 개선 (ARIA 레이블)
   - Safari 브라우저 호환성

7. **고급 기능**
   - 실시간 협업 모드
   - 알림 및 리마인더 시스템
   - 진행 상황 대시보드

---

## 📊 성능 메트릭 (예상)

| 지표 | 현재 구현 | 최적화 후 |
|------|----------|----------|
| 템플릿 목록 로딩 | ~200ms | ~150ms |
| 초기 번들 크기 | +12KB | +12KB |
| Firestore 읽기/월 | 110K | 44K |
| 네트워크 전송/월 | 1.4GB | 0.11GB |

---

## 관련 문서

- [gantt_firebase_implementation.md](./gantt_firebase_implementation.md) - Phase 4-5 상세 구현 가이드
- [types.ts](../../../types.ts) - 타입 정의
- [useGanttTemplates.ts](../../../hooks/useGanttTemplates.ts) - 템플릿 CRUD Hooks
- [useGanttProjects.ts](../../../hooks/useGanttProjects.ts) - 프로젝트 CRUD Hooks

---

**문서 끝**
