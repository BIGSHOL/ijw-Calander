# 🎯 에이전트 역할 명확화 및 중복 기능 정리

> **작성일**: 2026-01-08
> **목적**: 에이전트 간 역할 중복 제거 및 책임 범위 명확화

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
   - 보안 취약점 (기본적인 것만)
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

#### 하지 않는 것 ❌
- 문서 품질 검토 (→ report-analyst)
- 보고서 분석 (→ report-analyst)

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

3. ✅ **데이터 구조 권장**
   - Firestore 컬렉션 설계
   - 인덱스 전략
   - 데이터 정규화/비정규화

#### 하지 않는 것 ❌
- 일반적인 코드 구현 (→ 개발자)
- Cloud Function 구현 (→ cloud-function-architect)
- 코드 리뷰 (→ code-reviewer)

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

#### 하지 않는 것 ❌
- 일반 백엔드 로직 (→ academy-domain-expert)
- 실제 구현 (→ 개발자/code-fixer)
- Firebase 비용 분석 (→ firebase-cost-optimizer)

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

## 🔄 협업 시나리오 (역할 명확화)

### 시나리오 1: 코드 품질 문제 발견

```
잘못된 흐름:
사용자 → code-reviewer → refactor-expert (중복!)

올바른 흐름:
사용자 → code-reviewer (품질 검토)
    ↓
    Critical 이슈 발견 → code-fixer (자동 수정)
    중복 코드 많음 → refactor-expert (리팩토링 계획)
```

**역할 구분**:
- `code-reviewer`: "이 코드는 중복이 많습니다" (식별)
- `refactor-expert`: "중복을 제거하는 3가지 방법이 있습니다" (계획)
- `code-fixer`: "방법 1을 적용했습니다" (실행)

---

### 시나리오 2: 버그 vs 코드 품질

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

### 시나리오 3: 문서 작성 vs 검토

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

#### Q6: Firebase 비용 걱정되는가?
- **YES** → `firebase-cost-optimizer`
  - 코드 리뷰와 함께: `code-reviewer` → `firebase-cost-optimizer`

#### Q7: 테스트가 필요한가?
- **YES** → `test-writer`
  - 새 기능: 구현 후 `test-writer`
  - 버그 수정: `bug-hunter` → `code-fixer` → `test-writer`

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
                  code-fixer

문서 작업?        리팩토링?
│                  │
doc-writer        refactor-expert
    ↓                  ↓
report-analyst    code-fixer
                       ↓
                  test-writer
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

---

**문서 작성**: Claude Sonnet 4.5
**최종 검토**: 2026-01-08
**버전**: v1.0
