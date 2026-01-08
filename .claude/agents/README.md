# 🤖 Claude Code 에이전트 시스템

> **프로젝트**: ijw-calander (학원 관리 시스템)
> **업데이트**: 2026-01-08
> **에이전트 수**: 10개

---

## 📚 주요 문서

### 1. [협업 워크플로우](WORKFLOW.md)
에이전트 간 협업 프로세스와 사용 시나리오를 상세하게 설명합니다.

**주요 내용**:
- 5가지 핵심 워크플로우
- 워크플로우별 실행 가이드
- 사용 시나리오 및 예시
- 트리거 조건 정리

### 2. [역할 명확화](ROLE-CLARIFICATION.md)
에이전트 간 중복 기능을 정리하고 명확한 역할을 정의합니다.

**주요 내용**:
- 중복 영역 분석
- 에이전트별 책임 범위
- 의사결정 가이드
- 안티패턴 및 모범 사례

---

## 🎯 에이전트 목록

### 코드 품질 관리 (3개)

#### 1. [code-reviewer](code-reviewer.md)
**역할**: 코드 품질 검토 및 개선점 제안
**트리거**: `trigger_on_code_review: true`
**키워드**: "코드 점검", "코드 리뷰", "검토", "체크"

#### 2. [code-fixer](code-fixer.md)
**역할**: 리뷰 피드백 자동 반영
**트리거**: `trigger_after_code_review: true`
**협업**: code-reviewer → **code-fixer**

#### 3. [firebase-cost-optimizer](firebase-cost-optimizer.md)
**역할**: Firebase/Firestore 비용 분석 및 최적화
**트리거**: `trigger_on_firebase_code: true`
**협업**: code-reviewer → **firebase-cost-optimizer** → code-fixer

---

### 도메인 전문가 (2개)

#### 4. [academy-domain-expert](academy-domain-expert.md)
**역할**: 학원 관리 시스템 도메인 로직 설계
**트리거**: `trigger_on_phrases` + `trigger_on_domain_features: true`
**키워드**: "학원", "원생", "출석", "수강", "강좌"

#### 5. [cloud-function-architect](cloud-function-architect.md)
**역할**: Firebase Cloud Functions 아키텍처 설계
**트리거**: `trigger_on_phrases`
**키워드**: "Cloud Function", "클라우드 펑션", "서버리스", "트리거"

---

### 문제 해결 (1개)

#### 6. [bug-hunter](bug-hunter.md)
**역할**: 버그 추적 및 디버깅
**트리거**: `trigger_on_phrases`
**키워드**: "버그", "에러", "오류", "bug", "error", "문제 발생"
**협업**: **bug-hunter** → code-fixer → test-writer

---

### 코드 개선 (1개)

#### 7. [refactor-expert](refactor-expert.md)
**역할**: 코드 리팩토링 및 최적화
**트리거**: `trigger_on_phrases` + `trigger_on_complexity_threshold: true`
**키워드**: "리팩토링", "코드 개선", "최적화", "구조 개선"
**협업**: **refactor-expert** → code-fixer → test-writer

---

### 문서화 및 분석 (2개)

#### 8. [doc-writer](doc-writer.md)
**역할**: 기술 문서 및 API 문서 작성
**트리거**: `trigger_on_phrases` + `trigger_on_new_features: true`
**키워드**: "문서 작성", "README", "API 문서", "가이드"
**협업**: **doc-writer** → report-analyst

#### 9. [report-analyst](report-analyst.md)
**역할**: 마크다운 보고서 분석 및 개선
**트리거**: `trigger_on_file_extension: [".md"]` + `trigger_on_phrases`
**키워드**: "보고서 검토", "문서 검토", "리포트 분석"

---

### 테스트 (1개)

#### 10. [test-writer](test-writer.md)
**역할**: 단위/통합/E2E 테스트 작성
**트리거**: `trigger_on_phrases` + `trigger_after_refactoring: true` + `trigger_after_bug_fix: true`
**키워드**: "테스트 작성", "테스트 추가", "test", "커버리지"

---

## 🔄 핵심 워크플로우

### 1️⃣ 코드 품질 관리 (가장 자주 사용)

```
code-reviewer → firebase-cost-optimizer → code-fixer
```

**사용 예**:
```
사용자: "StudentList.tsx 파일 코드 리뷰해줘"
→ code-reviewer 자동 실행
→ firebase-cost-optimizer 자동 실행 (Firestore 코드 발견 시)
→ code-fixer 실행 (사용자 확인 후)
```

---

### 2️⃣ 버그 수정

```
bug-hunter → code-fixer → test-writer
```

**사용 예**:
```
사용자: "출석 체크 시 에러 발생하는데 원인 찾아줘"
→ bug-hunter 실행
→ code-fixer 실행 (수정 적용)
→ test-writer 실행 (회귀 테스트)
```

---

### 3️⃣ 기능 개발

```
academy-domain-expert → cloud-function-architect → [구현] → test-writer → code-reviewer
```

**사용 예**:
```
사용자: "학생 출석률 자동 계산 기능 설계해줘"
→ academy-domain-expert 실행 (도메인 설계)
→ cloud-function-architect 실행 (서버리스 설계)
→ [개발자 코드 구현]
→ test-writer 실행
→ code-reviewer 실행
```

---

### 4️⃣ 리팩토링

```
refactor-expert → code-fixer → test-writer → code-reviewer
```

**사용 예**:
```
사용자: "App.tsx 리팩토링 계획 세워줘"
→ refactor-expert 실행
→ code-fixer 실행 (리팩토링 적용)
→ test-writer 실행 (회귀 테스트)
→ code-reviewer 실행 (검증)
```

---

### 5️⃣ 문서화

```
doc-writer → report-analyst
```

**사용 예**:
```
사용자: "출석 관리 API 문서 작성해줘"
→ doc-writer 실행
→ report-analyst 실행 (품질 검토)
→ doc-writer 실행 (개선 반영)
```

---

## 🚀 빠른 시작

### Step 1: 상황 파악
무엇을 하고 싶은가?
- 코드 점검? → `code-reviewer`
- 버그 수정? → `bug-hunter`
- 기능 설계? → `academy-domain-expert`
- 리팩토링? → `refactor-expert`
- 문서 작성? → `doc-writer`

### Step 2: 워크플로우 확인
[WORKFLOW.md](WORKFLOW.md)에서 해당 워크플로우 찾기

### Step 3: 순차 실행
각 에이전트를 순서대로 실행 (자동 트리거 활용)

### Step 4: 결과 검증
마지막 단계에서 전체 검증

---

## 📊 에이전트 활용 통계 (권장)

### 🔥 매일 사용
- `code-reviewer`: 모든 코드 작업 후
- `code-fixer`: 리뷰 피드백 반영

### 📈 자주 사용
- `firebase-cost-optimizer`: Firebase 코드 작업 시
- `bug-hunter`: 버그 발생 시
- `test-writer`: 새 기능 추가 시

### 📅 주기적 사용
- `refactor-expert`: 주간 코드 정리
- `doc-writer`: 기능 완성 시
- `report-analyst`: 월간 보고서 작성 시

### 🌙 필요 시 사용
- `academy-domain-expert`: 새 도메인 기능 설계
- `cloud-function-architect`: Cloud Function 추가

---

## ⚠️ 주의사항

### ✅ DO (해야 할 것)
1. 워크플로우 순서 준수
2. 자동 트리거 활용
3. 결과 검증 필수
4. 문서 업데이트

### ❌ DON'T (하지 말 것)
1. 같은 에이전트 중복 실행
2. 순서 뒤바꾸기 (reviewer 전에 fixer)
3. 역할 오용 (doc-writer에게 검토 요청)
4. 검증 없이 배포

---

## 🔧 트러블슈팅

### Q1: 어떤 에이전트를 사용해야 할지 모르겠어요
**A**: [ROLE-CLARIFICATION.md](ROLE-CLARIFICATION.md)의 의사결정 가이드 참조

### Q2: 에이전트가 자동 실행되지 않아요
**A**: 트리거 키워드를 정확히 사용했는지 확인
- 예: "코드 점검" (O) vs "코드 확인" (X)

### Q3: 에이전트 결과가 기대와 달라요
**A**:
1. 역할 범위 확인 (각 에이전트 문서 참조)
2. 올바른 워크플로우 사용 중인지 확인
3. 이전 단계 결과물 제공했는지 확인

### Q4: 여러 에이전트를 동시에 실행하고 싶어요
**A**:
- 독립적인 작업: 병렬 실행 가능
- 의존 관계: 순차 실행 필수

---

## 📈 성능 최적화

### 에이전트 실행 속도 개선
1. **모델 선택**: 간단한 작업은 `haiku` 모델 사용 (설정 시)
2. **캐싱 활용**: 반복 작업은 결과 재사용
3. **병렬 실행**: 독립적 에이전트 동시 실행

### 비용 절감
1. 필요한 에이전트만 실행
2. 자동 트리거 조건 정확히 설정
3. 결과물 재사용

---

## 📝 변경 이력

### v1.2 (2026-01-08)
- ✅ 협업 워크플로우 문서화 완료
- ✅ 자동 트리거 조건 추가
- ✅ 에이전트 간 중복 기능 정리

### v1.1 (2026-01-05)
- code-reviewer, code-fixer, firebase-cost-optimizer 업데이트

### v1.0 (2025-12-30)
- 초기 에이전트 시스템 구축

---

## 🤝 기여

에이전트 개선 제안:
1. 이슈 등록
2. 팀 회의 안건 상정
3. 문서 업데이트 PR

---

## 📚 추가 리소스

- [Claude Code 공식 문서](https://claude.com/claude-code)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
- [프로젝트 위키](링크 추가 예정)

---

## 💡 팁과 트릭

### 효율적인 사용법
```bash
# 1. 키워드로 자동 트리거
"이 파일 코드 점검해줘"  # code-reviewer 자동 실행

# 2. 체인 실행 요청
"코드 리뷰하고 자동으로 수정까지 해줘"
# code-reviewer → code-fixer 순차 실행

# 3. 컨텍스트 공유
"위에서 발견한 버그 수정해줘"
# bug-hunter 결과를 code-fixer가 참조
```

### 베스트 프랙티스
1. **작은 단위로**: 큰 작업은 여러 단계로 분할
2. **검증 우선**: 각 단계 후 결과 확인
3. **문서화 습관**: 중요한 변경사항 기록
4. **정기 점검**: 주기적으로 전체 코드 리뷰

---

**관리자**: ijw-calander 개발팀
**문서 작성**: Claude Sonnet 4.5
**최종 업데이트**: 2026-01-08
