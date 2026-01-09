# 🎯 에이전트 역할 명확화 및 중복 기능 정리

> **작성일**: 2026-01-09
> **목적**: 에이전트 간 역할 중복 제거 및 책임 범위 명확화
> **에이전트 수**: 14개

---

## 📊 중복 분석 결과

### 발견된 중복 영역

#### 1️⃣ 코드 품질 검토 영역

**중복 에이전트**:
- `code-reviewer` (코드 리뷰어)
- `refactor-expert` (리팩토링 전문가)

**중복 내용**:
- 코드 가독성 평가
- 코드 구조 분석
- 베스트 프랙티스 검증
- 성능 최적화 제안

---

#### 2️⃣ 버그 관련 영역

**중복 에이전트**:
- `code-reviewer` (코드 리뷰어)
- `bug-hunter` (버그 헌터)

**중복 내용**:
- 잠재적 버그 발견
- 에러 핸들링 검토
- 타입 안정성 확인

---

#### 3️⃣ 문서화 영역

**중복 에이전트**:
- `doc-writer` (문서 작성)
- `report-analyst` (보고서 분석)

**중복 내용**:
- 문서 구조 평가
- 가독성 검토
- 완결성 확인

---

#### 4️⃣ 🆕 보안 관련 영역

**중복 에이전트**:
- `code-reviewer` (코드 리뷰어)
- `security-auditor` (보안 검사)

**중복 내용**:
- 기본적인 보안 패턴 검사
- 잠재적 취약점 식별

**역할 구분**:
- `code-reviewer`: 기본적인 보안 패턴만 (명백한 것)
- `security-auditor`: 심층 보안 분석 (XSS, CSRF, 인증, 개인정보 등)

---

#### 5️⃣ 🆕 비용 최적화 영역

**중복 에이전트**:
- `firebase-cost-optimizer` (Firebase 비용)
- `notification-designer` (알림 설계)

**중복 내용**:
- 비용 분석 및 최적화

**역할 구분**:
- `firebase-cost-optimizer`: Firestore 읽기/쓰기 비용
- `notification-designer`: 알림 발송 비용 (SMS, 알림톡 등)

---

## ✅ 역할 재정의

### 🔍 code-reviewer (코드 리뷰어)

#### 핵심 역할
**정적 분석 및 품질 검증**

#### 책임 범위
1. ✅ **코드 품질 평가**
   - 네이밍 컨벤션
   - 코드 스타일
   - 일관성 검사
   - DRY 원칙 준수

2. ✅ **베스트 프랙티스 검증**
   - React/TypeScript 패턴
   - 기본적인 보안 취약점
   - 타입 안정성

3. ✅ **잠재적 문제 식별**
   - 명백한 버그 패턴
   - 메모리 누수 가능성
   - 성능 이슈 (기본적인 것만)

#### 하지 않는 것 ❌
- 깊은 디버깅 (→ bug-hunter)
- 리팩토링 계획 수립 (→ refactor-expert)
- 실제 코드 수정 (→ code-fixer)
- 아키텍처 재설계 (→ refactor-expert)
- 심층 보안 분석 (→ security-auditor)

#### 출력물
- 리뷰 리포트
- Critical/Important/Suggestion 이슈 목록
- 우선순위별 개선 사항

---

### 🐛 bug-hunter (버그 헌터)

#### 핵심 역할
**동적 디버깅 및 근본 원인 분석**

#### 책임 범위
1. ✅ **버그 재현 및 분석**
   - 에러 메시지 해석
   - 스택 트레이스 추적
   - 재현 조건 파악

2. ✅ **근본 원인 파악**
   - 코드 흐름 추적
   - 데이터 상태 분석
   - 타이밍 이슈 파악

3. ✅ **수정 방안 제시**
   - 여러 수정 옵션 제공
   - 장단점 분석
   - 재발 방지 방안

#### 하지 않는 것 ❌
- 일반적인 코드 리뷰 (→ code-reviewer)
- 예방적 품질 검토 (→ code-reviewer)
- 실제 코드 수정 (→ code-fixer)

#### 출력물
- 버그 분석 리포트
- 근본 원인 설명
- 수정 방안 (옵션별)
- 재현 단계

---

### 🔄 refactor-expert (리팩토링 전문가)

#### 핵심 역할
**아키텍처 개선 및 구조 재설계**

#### 책임 범위
1. ✅ **코드 구조 분석**
   - 복잡도 측정
   - 의존성 분석
   - 응집도/결합도 평가

2. ✅ **리팩토링 계획 수립**
   - 단계별 계획
   - 우선순위 설정
   - 리스크 평가

3. ✅ **아키텍처 개선**
   - 디자인 패턴 적용
   - 모듈 재구성
   - 추상화 수준 조정

4. ✅ **성능 최적화**
   - 알고리즘 개선
   - 렌더링 최적화
   - 번들 크기 최적화

#### 하지 않는 것 ❌
- 단순 코드 스타일 검토 (→ code-reviewer)
- 버그 수정 (→ bug-hunter)
- 실제 리팩토링 실행 (→ code-fixer)

#### 출력물
- 리팩토링 계획서
- Before/After 비교
- 단계별 실행 계획
- 예상 개선 효과

---

### 🔧 code-fixer (코드 수정 전문가)

#### 핵심 역할
**리뷰 피드백 자동 반영 및 코드 수정**

#### 책임 범위
1. ✅ **자동 코드 수정**
   - code-reviewer 피드백 반영
   - firebase-cost-optimizer 권장사항 적용
   - bug-hunter 수정 방안 구현
   - refactor-expert 계획 실행
   - 🆕 security-auditor 보안 이슈 수정
   - 🆕 notification-designer 알림 기능 구현

2. ✅ **검증 및 테스트**
   - 수정 후 동작 확인
   - 린터/포맷터 실행
   - 기능 보존 검증

3. ✅ **변경사항 문서화**
   - 상세 변경 로그
   - Before/After 코드
   - 개선 효과 측정

#### 하지 않는 것 ❌
- 코드 분석/리뷰 (→ code-reviewer)
- 리팩토링 계획 (→ refactor-expert)
- 버그 원인 분석 (→ bug-hunter)
- 보안 분석 (→ security-auditor)

#### 출력물
- 수정된 코드
- 변경 로그
- 검증 결과
- 커밋 메시지 제안

---

### 📝 doc-writer (문서 작성가)

#### 핵심 역할
**기술 문서 및 API 문서 작성**

#### 책임 범위
1. ✅ **문서 작성**
   - README
   - API 문서
   - 사용자 가이드
   - 코드 주석 (JSDoc/TSDoc)

2. ✅ **템플릿 적용**
   - 표준 문서 구조
   - 일관된 스타일
   - 베스트 프랙티스

3. ✅ **예시 및 샘플 제공**
   - 코드 예시
   - 사용 시나리오
   - 트러블슈팅

4. 🆕 ✅ **분석 리포트 문서화**
   - analytics-expert 결과 문서화
   - 차트/그래프 포함
   - 인사이트 정리

#### 하지 않는 것 ❌
- 문서 품질 검토 (→ report-analyst)
- 보고서 분석 (→ report-analyst)
- 데이터 분석 (→ analytics-expert)

#### 출력물
- 완성된 문서 (README, API 문서 등)
- 코드 주석
- 예시 코드

---

### 📊 report-analyst (보고서 분석가)

#### 핵심 역할
**마크다운 문서 품질 분석 및 개선안 제시**

#### 책임 범위
1. ✅ **문서 품질 평가**
   - 구조 분석
   - 내용 완결성 검토
   - 가독성 평가
   - 논리성 검증

2. ✅ **개선안 제시**
   - 구체적인 수정 제안
   - Before/After 비교
   - 우선순위 정렬

3. ✅ **보고서 특화 분석**
   - 설득력 평가
   - 데이터 근거 확인
   - 결론 명확성

#### 하지 않는 것 ❌
- 문서 작성 (→ doc-writer)
- 코드 문서화 (→ doc-writer)
- 데이터 분석 (→ analytics-expert)

#### 출력물
- 분석 리포트
- 개선안
- 체크리스트
- 샘플 개선 버전

---

### 🏫 academy-domain-expert (학원 도메인 전문가)

#### 핵심 역할
**학원 관리 시스템 도메인 로직 설계**

#### 책임 범위
1. ✅ **도메인 모델 설계**
   - 엔티티 정의
   - 관계 설정
   - 비즈니스 규칙

2. ✅ **비즈니스 로직 설계**
   - 수강 관리 프로세스
   - 출석 관리 로직
   - 수납/정산 로직
   - 🆕 알림 비즈니스 요구사항

3. ✅ **데이터 구조 권장**
   - Firestore 컬렉션 설계
   - 인덱스 전략
   - 데이터 정규화/비정규화

#### 하지 않는 것 ❌
- 일반적인 코드 구현 (→ 개발자)
- Cloud Function 구현 (→ cloud-function-architect)
- 코드 리뷰 (→ code-reviewer)
- 알림 채널/템플릿 설계 (→ notification-designer)
- 데이터 분석 (→ analytics-expert)

#### 출력물
- 도메인 모델
- 비즈니스 로직 설계
- 데이터 구조 권장안
- 워크플로우 다이어그램

---

### ☁️ cloud-function-architect (클라우드 펑션 아키텍트)

#### 핵심 역할
**Firebase Cloud Functions 아키텍처 설계**

#### 책임 범위
1. ✅ **트리거 설계**
   - onCreate/onUpdate/onDelete 선택
   - Scheduled 트리거 설계
   - HTTPS/Callable 설계

2. ✅ **안정성 보장**
   - 멱등성 설계
   - 무한 루프 방지
   - 에러 핸들링 전략

3. ✅ **성능 및 비용 최적화**
   - Cold Start 대응
   - 타임아웃 관리
   - 메모리 할당 최적화

4. 🆕 ✅ **알림 트리거 설계**
   - notification-designer 설계 기반 트리거 구현
   - 발송 스케줄링

#### 하지 않는 것 ❌
- 일반 백엔드 로직 (→ academy-domain-expert)
- 실제 구현 (→ 개발자/code-fixer)
- Firebase 비용 분석 (→ firebase-cost-optimizer)
- 알림 채널/템플릿 설계 (→ notification-designer)

#### 출력물
- Cloud Function 설계서
- 트리거 설정
- 안전 장치 코드 패턴
- 비용 고려사항

---

### 💰 firebase-cost-optimizer (Firebase 비용 최적화 전문가)

#### 핵심 역할
**Firebase/Firestore 비용 분석 및 최적화**

#### 책임 범위
1. ✅ **비용 분석**
   - 읽기/쓰기 비용 계산
   - 비용 발생 핫스팟 식별
   - 월간 예상 비용 산출

2. ✅ **쿼리 최적화**
   - 불필요한 읽기 제거
   - 실시간 리스너 최적화
   - 페이지네이션 구현

3. ✅ **데이터 구조 개선**
   - 비정규화 제안
   - 집계 데이터 사전 계산
   - 캐싱 전략

#### 하지 않는 것 ❌
- 일반적인 코드 리뷰 (→ code-reviewer)
- 실제 코드 수정 (→ code-fixer)
- 도메인 로직 설계 (→ academy-domain-expert)
- 알림 비용 분석 (→ notification-designer)

#### 출력물
- 비용 분석 리포트
- 핫스팟 목록
- 최적화 권장사항 (우선순위별)
- 예상 절감 효과

---

### 🧪 test-writer (테스트 작성 전문가)

#### 핵심 역할
**테스트 코드 작성 및 테스트 전략 수립**

#### 책임 범위
1. ✅ **테스트 코드 작성**
   - 단위 테스트
   - 통합 테스트
   - E2E 테스트

2. ✅ **테스트 전략**
   - 테스트 커버리지 계획
   - Mock/Stub 전략
   - Edge case 식별

3. ✅ **테스트 유지보수**
   - Flaky 테스트 개선
   - 테스트 속도 최적화

#### 하지 않는 것 ❌
- 코드 구현 (→ 개발자)
- 버그 수정 (→ bug-hunter)
- 코드 리뷰 (→ code-reviewer)

#### 출력물
- 테스트 코드
- 테스트 계획
- 커버리지 리포트

---

### 🆕 🔒 security-auditor (보안 검사 전문가)

#### 핵심 역할
**코드 보안 취약점 검사 및 개인정보 보호 검토**

#### 책임 범위
1. ✅ **웹 취약점 검사**
   - XSS (Cross-Site Scripting)
   - CSRF (Cross-Site Request Forgery)
   - SQL/NoSQL 인젝션
   - 인증/인가 우회

2. ✅ **개인정보 보호 검토**
   - 개인정보 암호화 확인
   - 민감 정보 노출 검사
   - 로깅 시 마스킹 확인
   - 데이터 보존 정책

3. ✅ **Firebase 보안**
   - Security Rules 검토
   - Storage Rules 검토
   - API 키 노출 검사
   - 인증 설정 검토

4. ✅ **보안 패턴 검증**
   - 입력 값 검증
   - CORS 설정
   - Rate Limiting
   - 세션/토큰 관리

#### 하지 않는 것 ❌
- 일반적인 코드 리뷰 (→ code-reviewer)
- 실제 코드 수정 (→ code-fixer)
- 성능 최적화 (→ refactor-expert)
- 비용 최적화 (→ firebase-cost-optimizer)

#### 출력물
- 보안 검사 리포트
- 취약점 목록 (Critical/Important/Suggestion)
- 수정 방법 및 코드 예시
- 보안 체크리스트

---

### 🆕 📱 notification-designer (알림 설계 전문가)

#### 핵심 역할
**알림 시스템 설계 및 채널 최적화**

#### 책임 범위
1. ✅ **알림 전략 설계**
   - 상황별 최적 채널 선택 (푸시/카카오/SMS/이메일)
   - 발송 시점 최적화
   - 발송 빈도 관리

2. ✅ **메시지 템플릿 설계**
   - 카카오 알림톡 템플릿
   - 푸시 알림 메시지
   - SMS 문자 내용
   - 이메일 템플릿

3. ✅ **비용 최적화**
   - 채널별 비용 분석
   - 무료 채널 우선 전략
   - Fallback 채널 설계
   - 월간 예산 관리

4. ✅ **사용자 경험**
   - 알림 피로도 관리
   - 수신 동의 관리
   - 야간 발송 제한
   - 채널 선호도 반영

#### 하지 않는 것 ❌
- 비즈니스 요구사항 정의 (→ academy-domain-expert)
- Cloud Function 트리거 설계 (→ cloud-function-architect)
- 실제 코드 구현 (→ code-fixer)
- Firebase 비용 분석 (→ firebase-cost-optimizer)

#### 출력물
- 알림 설계서
- 채널 선택 가이드
- 메시지 템플릿
- 비용 분석 리포트
- 구현 가이드

---

### 🆕 📊 analytics-expert (데이터 분석 전문가)

#### 핵심 역할
**운영 데이터 분석 및 인사이트 도출**

#### 책임 범위
1. ✅ **KPI 정의 및 측정**
   - 핵심 성과 지표 설계
   - 측정 방법 및 기준 정의
   - 목표치 설정 가이드
   - 벤치마크 제시

2. ✅ **데이터 분석**
   - 기술 통계 (평균, 중앙값, 분포)
   - 추세 분석 (시계열)
   - 비교 분석 (전월/전년 대비)
   - 코호트 분석

3. ✅ **시각화 설계**
   - 적합한 차트 유형 선택
   - 대시보드 레이아웃 설계
   - 인터랙티브 요소 설계

4. ✅ **리포트 자동화**
   - 정기 리포트 템플릿
   - 자동 발송 스케줄
   - 이상 징후 알림

#### 하지 않는 것 ❌
- 문서 작성 (→ doc-writer)
- 알림 발송 설계 (→ notification-designer)
- 코드 구현 (→ code-fixer)
- 비즈니스 로직 설계 (→ academy-domain-expert)

#### 출력물
- 데이터 분석 리포트
- KPI 현황 대시보드
- 데이터 쿼리 설계
- 인사이트 및 권장사항

---

### 🆕 📋 report-summarizer (보고서 요약 전문가)

#### 핵심 역할
**긴 리포트를 핵심만 빠르게 요약하여 의사결정 지원**

#### 책임 범위
1. ✅ **리포트 요약**
   - 코드 리뷰 결과 요약
   - 보안 검사 결과 요약
   - 데이터 분석 리포트 요약
   - Firebase 비용 분석 요약
   - 버그 분석 결과 요약

2. ✅ **핵심 정보 추출**
   - 전체 상태/결론 (통과/보류/실패)
   - 숫자로 된 지표 (건수, 비율, 금액)
   - 즉시 조치 필요 사항
   - 긴급도 표시 (🔴🟡🟢)

3. ✅ **의사결정 지원**
   - 결론 먼저 (Bottom Line Up Front)
   - 다음 행동 제안
   - 우선순위 정리

#### 하지 않는 것 ❌
- 리포트 생성 (→ 각 전문 에이전트)
- 코드 분석 (→ code-reviewer)
- 보안 검사 (→ security-auditor)
- 데이터 분석 (→ analytics-expert)
- 문서 작성 (→ doc-writer)

#### 출력물
- 핵심 요약 (10-15줄)
- 한줄 요약 (1-2줄)
- 상태 브리핑 (🔴🟡🟢)
- 다음 단계 권장

#### 트리거 키워드
- "요약", "요약해줘", "핵심만", "간단히", "브리핑", "정리해줘", "한줄로", "결론만"

#### 체인 실행 지원
```
"코드 리뷰하고 요약해줘"
→ code-reviewer 실행 → report-summarizer 자동 연결
→ "🟡 Critical 2건, Important 5건. 즉시 수정: StudentList.tsx"
```

---

## 🔄 협업 시나리오 (역할 명확화)

### 시나리오 1: 코드 품질 + 보안 검사

```
잘못된 흐름:
사용자 → code-reviewer (보안까지 요청)

올바른 흐름:
사용자 → code-reviewer (품질 검토)
    ↓
    security-auditor (보안 검토)
    ↓
    code-fixer (이슈 수정)
```

**역할 구분**:
- `code-reviewer`: "이 코드는 XSS 위험이 있을 수 있습니다" (기본 식별)
- `security-auditor`: "XSS 취약점 상세 분석 및 수정 방법" (심층 분석)
- `code-fixer`: "DOMPurify를 적용했습니다" (실행)

---

### 시나리오 2: 알림 기능 개발

```
잘못된 흐름:
사용자 → notification-designer (비즈니스 요구사항 없이)

올바른 흐름:
사용자 → academy-domain-expert (비즈니스 요구사항)
    ↓
    notification-designer (알림 설계)
    ↓
    cloud-function-architect (트리거 설계)
    ↓
    code-fixer (구현)
```

**역할 구분**:
- `academy-domain-expert`: "출결 시 학부모에게 알림 필요, 지각/결석은 즉시 발송"
- `notification-designer`: "푸시 + 카카오 알림톡, 비용 월 15,600원"
- `cloud-function-architect`: "attendance onCreate 트리거 설계"
- `code-fixer`: "Cloud Function 코드 구현"

---

### 시나리오 3: 데이터 분석 + 리포트

```
잘못된 흐름:
사용자 → doc-writer (분석 없이 리포트 요청)

올바른 흐름:
사용자 → analytics-expert (데이터 분석)
    ↓
    doc-writer (리포트 문서화)
    ↓
    report-analyst (품질 검토)
```

**역할 구분**:
- `analytics-expert`: "매출 5,230만원, 전월 대비 +8.9%, 출석률 92.5%"
- `doc-writer`: "월간 운영 리포트 문서 작성"
- `report-analyst`: "리포트 가독성/완결성 검토"

---

### 시나리오 4: 버그 vs 코드 품질

```
버그 발생 시:
사용자 → bug-hunter (근본 원인 분석)
    ↓
    code-fixer (수정 적용)
    ↓
    test-writer (회귀 테스트)

예방적 검토:
사용자 → code-reviewer (잠재적 버그 식별)
    ↓
    code-fixer (예방 조치)
```

**역할 구분**:
- `bug-hunter`: 이미 발생한 버그 추적
- `code-reviewer`: 잠재적 버그 예방

---

### 시나리오 5: 문서 작성 vs 검토

```
올바른 흐름:
사용자 → doc-writer (문서 작성)
    ↓
    report-analyst (품질 검토)
    ↓
    doc-writer (개선안 반영)
```

**역할 구분**:
- `doc-writer`: 문서 생성
- `report-analyst`: 품질 평가

---

## 📋 의사결정 가이드

### 어떤 에이전트를 선택할까?

#### Q1: 코드 리뷰가 필요한가?
- **YES** → `code-reviewer`
  - 품질만 검토: `code-reviewer`만
  - 리팩토링도 필요: `code-reviewer` → `refactor-expert`
  - 🆕 보안도 확인: `code-reviewer` → `security-auditor`

#### Q2: 버그가 발생했는가?
- **YES** → `bug-hunter`
  - 원인 모름: `bug-hunter`
  - 원인 알지만 수정 필요: `code-fixer`

#### Q3: 리팩토링이 필요한가?
- **YES** → `refactor-expert`
  - 계획만: `refactor-expert`
  - 실행까지: `refactor-expert` → `code-fixer`

#### Q4: 문서 작업인가?
- **작성** → `doc-writer`
- **검토** → `report-analyst`

#### Q5: 학원 도메인 로직인가?
- **YES** → `academy-domain-expert`
  - 서버리스 필요: `academy-domain-expert` → `cloud-function-architect`
  - 🆕 알림 필요: `academy-domain-expert` → `notification-designer`

#### Q6: Firebase 비용 걱정되는가?
- **YES** → `firebase-cost-optimizer`
  - 코드 리뷰와 함께: `code-reviewer` → `firebase-cost-optimizer`

#### Q7: 테스트가 필요한가?
- **YES** → `test-writer`
  - 새 기능: 구현 후 `test-writer`
  - 버그 수정: `bug-hunter` → `code-fixer` → `test-writer`

#### 🆕 Q8: 보안 검사가 필요한가?
- **YES** → `security-auditor`
  - 배포 전: `code-reviewer` → `security-auditor`
  - 개인정보 관련: 즉시 `security-auditor`

#### 🆕 Q9: 알림 기능이 필요한가?
- **YES** → `notification-designer`
  - 비즈니스 요구사항부터: `academy-domain-expert` → `notification-designer`
  - 채널만 변경: 바로 `notification-designer`

#### 🆕 Q10: 데이터 분석이 필요한가?
- **YES** → `analytics-expert`
  - 리포트까지: `analytics-expert` → `doc-writer`
  - 대시보드 설계: `analytics-expert`

---

## ✅ 정리된 협업 프로토콜

### 필수 협업 (반드시 함께)

1. **코드 점검 트리오**
   ```
   code-reviewer → firebase-cost-optimizer → code-fixer
   ```

2. **버그 수정 체인**
   ```
   bug-hunter → code-fixer → test-writer
   ```

3. **문서화 듀오**
   ```
   doc-writer → report-analyst
   ```

4. **리팩토링 플로우**
   ```
   refactor-expert → code-fixer → test-writer
   ```

5. **🆕 보안 점검 체인**
   ```
   code-reviewer → security-auditor → code-fixer
   ```

6. **🆕 알림 기능 개발 플로우**
   ```
   academy-domain-expert → notification-designer → cloud-function-architect → code-fixer
   ```

7. **🆕 데이터 분석 플로우**
   ```
   analytics-expert → doc-writer → notification-designer (선택)
   ```

---

## 🚫 안티패턴 (하지 말 것)

### ❌ 중복 실행
```
# 잘못된 예
code-reviewer + refactor-expert (동시 실행)
→ 역할 중복, 혼란 발생

# 올바른 예
code-reviewer (먼저) → 결과 확인 → refactor-expert (필요 시)
```

### ❌ 순서 뒤바뀜
```
# 잘못된 예
code-fixer → code-reviewer
→ 수정 후 검토는 의미 없음

# 올바른 예
code-reviewer → code-fixer
```

### ❌ 역할 오용
```
# 잘못된 예
doc-writer에게 보고서 검토 요청
→ doc-writer는 작성만 담당

# 올바른 예
report-analyst에게 검토 요청
```

### 🆕 ❌ 보안 검사 생략
```
# 잘못된 예
code-reviewer → code-fixer → [배포]
→ 보안 검사 없이 배포

# 올바른 예
code-reviewer → security-auditor → code-fixer → [배포]
```

### 🆕 ❌ 비즈니스 요구사항 없이 알림 설계
```
# 잘못된 예
notification-designer (바로 실행)
→ 비즈니스 컨텍스트 없음

# 올바른 예
academy-domain-expert (먼저) → notification-designer
```

---

## 📊 에이전트 선택 플로우차트

```
사용자 요청 접수
    ↓
┌─── 유형 판별 ───┐
│                  │
버그 발생?        코드 작성/수정?
│                  │
bug-hunter        code-reviewer
    ↓                  ↓
code-fixer        Firebase 코드?
    ↓                  │
test-writer       firebase-cost
                  -optimizer
                       ↓
                  보안 중요?
                       │
                  security-auditor
                       ↓
                  code-fixer

문서 작업?        리팩토링?        🆕 알림 필요?      🆕 분석 필요?
│                  │                   │                  │
doc-writer        refactor-expert   academy-domain    analytics-expert
    ↓                  ↓                   ↓                  ↓
report-analyst    code-fixer        notification      doc-writer
                       ↓              -designer             ↓
                  test-writer             ↓            notification
                                    cloud-function      -designer
                                      -architect          (선택)
                                           ↓
                                      code-fixer
```

---

## 🎯 핵심 원칙

### 1. One Agent, One Responsibility
각 에이전트는 하나의 명확한 책임만 가진다.

### 2. Sequential Execution
의존 관계가 있으면 순차 실행.

### 3. Clear Hand-off
다음 에이전트에 명확한 결과물 전달.

### 4. No Overlapping
같은 역할은 하나의 에이전트만.

### 5. Documentation First
역할 변경 시 즉시 문서 업데이트.

### 🆕 6. Security by Default
배포 전 보안 검사 필수.

### 🆕 7. Domain First for Notifications
알림 설계 전 비즈니스 요구사항 먼저.

### 🆕 8. Data-Driven Decisions
의사결정에 analytics-expert 활용.

---

**문서 작성**: Claude
**최종 검토**: 2026-01-09
**버전**: v1.3
