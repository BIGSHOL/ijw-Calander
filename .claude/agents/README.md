# 🤖 Claude Code 에이전트 시스템

> **프로젝트**: ijw-calander (학원 관리 시스템)
> **업데이트**: 2026-01-11
> **에이전트 수**: 18개

---

## 📚 주요 문서

### 1. [협업 워크플로우](WORKFLOW.md)
에이전트 간 협업 프로세스와 사용 시나리오를 상세하게 설명합니다.

**주요 내용**:
- 8가지 핵심 워크플로우
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

### 코드 품질 관리 (4개)

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

#### 4. 🆕 [security-auditor](security-auditor.md)
**역할**: 코드 보안 취약점 검사, 개인정보 보호 검토
**트리거**: `trigger_before_deployment: true`
**키워드**: "보안", "취약점", "XSS", "인증", "개인정보"
**협업**: code-reviewer → **security-auditor** → code-fixer

---

### 도메인 전문가 (3개)

#### 5. [academy-domain-expert](academy-domain-expert.md)
**역할**: 학원 관리 시스템 도메인 로직 설계
**트리거**: `trigger_on_phrases` + `trigger_on_domain_features: true`
**키워드**: "학원", "원생", "출석", "수강", "강좌"

#### 6. [cloud-function-architect](cloud-function-architect.md)
**역할**: Firebase Cloud Functions 아키텍처 설계
**트리거**: `trigger_on_phrases`
**키워드**: "Cloud Function", "클라우드 펑션", "서버리스", "트리거"

#### 7. 🆕 [notification-designer](notification-designer.md)
**역할**: 알림 시스템 설계, 푸시/SMS/카카오 연동
**트리거**: `trigger_on_domain_features: true`
**키워드**: "알림", "푸시", "SMS", "카카오", "알림톡"
**협업**: academy-domain-expert → **notification-designer** → cloud-function-architect

---

### 문제 해결 (2개)

#### 8. [bug-hunter](bug-hunter.md)
**역할**: 버그 추적 및 디버깅
**트리거**: `trigger_on_phrases`
**키워드**: "버그", "에러", "오류", "bug", "error", "문제 발생"
**협업**: **bug-hunter** → code-fixer → test-writer

#### 9. [refactor-expert](refactor-expert.md)
**역할**: 코드 리팩토링 및 최적화
**트리거**: `trigger_on_phrases` + `trigger_on_complexity_threshold: true`
**키워드**: "리팩토링", "코드 개선", "최적화", "구조 개선"
**협업**: **refactor-expert** → code-fixer → test-writer

---

### 문서화 및 분석 (4개)

#### 10. [doc-writer](doc-writer.md)
**역할**: 기술 문서 및 API 문서 작성
**트리거**: `trigger_on_phrases` + `trigger_on_new_features: true`
**키워드**: "문서 작성", "README", "API 문서", "가이드"
**협업**: **doc-writer** → report-analyst

#### 11. [report-analyst](report-analyst.md)
**역할**: 마크다운 보고서 분석 및 개선
**트리거**: `trigger_on_file_extension: [".md"]` + `trigger_on_phrases`
**키워드**: "보고서 검토", "문서 검토", "리포트 분석"

#### 12. 🆕 [analytics-expert](analytics-expert.md)
**역할**: 운영 데이터 분석, 리포트 생성, 시각화
**트리거**: `trigger_on_domain_features: true`
**키워드**: "통계", "분석", "리포트", "대시보드", "KPI"
**협업**: **analytics-expert** → doc-writer → notification-designer

#### 13. 🆕 [report-summarizer](report-summarizer.md)
**역할**: 긴 리포트를 핵심만 빠르게 요약, 의사결정 지원
**트리거**: `trigger_after_report_generation: true`
**키워드**: "요약", "핵심만", "간단히", "브리핑", "정리해줘", "한줄로"
**협업**: 다른 에이전트 리포트 → **report-summarizer** → 사용자 의사결정

---

### 테스트 (2개)

#### 14. [test-writer](test-writer.md)
**역할**: 단위/통합/E2E 테스트 작성
**트리거**: `trigger_on_phrases` + `trigger_after_refactoring: true` + `trigger_after_bug_fix: true`
**키워드**: "테스트 작성", "테스트 추가", "test", "커버리지"

#### 15. 🆕 [tdd-expert](tdd-expert.md)
**역할**: TDD 사이클 관리 (RED → GREEN → REFACTOR)
**트리거**: `trigger_on_phrases`
**키워드**: "TDD", "테스트 먼저", "테스트 주도", "RED GREEN"
**협업**: **tdd-expert** → test-writer → code-fixer → code-reviewer

---

### 디자인/성능 (2개)

#### 16. 🆕 [design-system-guardian](design-system-guardian.md)
**역할**: UI/UX 일관성 점검, 디자인 시스템 관리
**트리거**: `trigger_on_phrases`
**키워드**: "디자인 점검", "UI 일관성", "타이포그래피", "색상 점검"
**협업**: **design-system-guardian** → refactor-expert → code-fixer

#### 17. 🆕 [performance-optimizer](performance-optimizer.md)
**역할**: 성능 분석 및 최적화 (번들, 렌더링, 메모리)
**트리거**: `trigger_on_phrases`
**키워드**: "성능 분석", "성능 최적화", "느림", "번들 크기", "Lighthouse"
**협업**: **performance-optimizer** → firebase-cost-optimizer → refactor-expert

---

### 마이그레이션 (1개)

#### 18. 🆕 [migration-helper](migration-helper.md)
**역할**: 데이터/스키마 마이그레이션, 하위 호환성 관리
**트리거**: `trigger_on_phrases`
**키워드**: "마이그레이션", "데이터 이전", "스키마 변경", "구조 통일"
**협업**: academy-domain-expert → **migration-helper** → test-writer

---

## 🔄 핵심 워크플로우 (11가지)

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

### 6️⃣ 🆕 보안 점검

```
code-reviewer → security-auditor → code-fixer → [배포]
```

**사용 예**:
```
사용자: "배포 전 보안 검사해줘"
→ code-reviewer 실행 (기본 품질 검토)
→ security-auditor 실행 (보안 취약점 검사)
→ code-fixer 실행 (보안 이슈 수정)
→ [배포 진행]
```

---

### 7️⃣ 🆕 알림 기능 개발

```
academy-domain-expert → notification-designer → cloud-function-architect → code-fixer → security-auditor
```

**사용 예**:
```
사용자: "학부모 출결 알림 기능 설계해줘"
→ academy-domain-expert 실행 (비즈니스 요구사항)
→ notification-designer 실행 (알림 채널 및 템플릿 설계)
→ cloud-function-architect 실행 (트리거 설계)
→ code-fixer 실행 (구현)
→ security-auditor 실행 (개인정보 보호 검토)
```

---

### 8️⃣ 🆕 데이터 분석

```
analytics-expert → doc-writer → notification-designer
```

**사용 예**:
```
사용자: "이번 달 매출 분석 리포트 만들어줘"
→ analytics-expert 실행 (데이터 분석)
→ doc-writer 실행 (리포트 문서화)
→ notification-designer 실행 (자동 발송 설정, 선택)
```

---

### 9️⃣ 🆕 TDD 개발

```
tdd-expert → test-writer → code-fixer → code-reviewer
```

**사용 예**:
```
사용자: "권한 시스템 TDD로 개발해줘"
→ tdd-expert 실행 (테스트 시나리오 설계)
→ test-writer 실행 (🔴 실패 테스트 작성)
→ code-fixer 실행 (🟢 최소 구현)
→ refactor-expert 실행 (🔵 리팩토링)
→ 반복
```

---

### 🔟 🆕 디자인 시스템 점검

```
design-system-guardian → refactor-expert → code-fixer
```

**사용 예**:
```
사용자: "전체 UI 일관성 점검해줘"
→ design-system-guardian 실행 (타이포그래피/색상 분석)
→ refactor-expert 실행 (표준화 작업)
→ code-fixer 실행 (수정 적용)
```

---

### 1️⃣1️⃣ 🆕 데이터 마이그레이션

```
academy-domain-expert → migration-helper → test-writer → code-reviewer
```

**사용 예**:
```
사용자: "수학/영어 시간표 데이터 구조 통일해줘"
→ academy-domain-expert 실행 (도메인 분석)
→ migration-helper 실행 (마이그레이션 계획 및 스크립트)
→ test-writer 실행 (검증 테스트)
→ code-reviewer 실행 (최종 검토)
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
- 보안 검사? → `security-auditor`
- 알림 설계? → `notification-designer`
- 데이터 분석? → `analytics-expert`
- 리포트 요약? → `report-summarizer`
- 🆕 TDD 개발? → `tdd-expert`
- 🆕 UI 일관성? → `design-system-guardian`
- 🆕 성능 최적화? → `performance-optimizer`
- 🆕 데이터 마이그레이션? → `migration-helper`

### Step 2: 워크플로우 확인
[WORKFLOW.md](WORKFLOW.md)에서 해당 워크플로우 찾기

### Step 3: 순차 실행
각 에이전트를 순서대로 실행 (자동 트리거 활용)

### Step 4: 결과 검증
마지막 단계에서 전체 검증

---

## ⚡ 빠른 참조 카드

### 상황별 에이전트 선택

| 이런 상황에서... | 이렇게 말하세요 | 실행되는 에이전트 |
|-----------------|----------------|------------------|
| 코드 작성 후 | "코드 점검해줘" | code-reviewer |
| 에러 발생 | "버그 찾아줘" | bug-hunter |
| 새 기능 필요 | "기능 설계해줘" | academy-domain-expert |
| 문서 필요 | "문서 작성해줘" | doc-writer |
| 테스트 필요 | "테스트 작성해줘" | test-writer |
| 🆕 보안 걱정 | "보안 검사해줘" | security-auditor |
| 🆕 알림 기능 | "알림 설계해줘" | notification-designer |
| 🆕 데이터 분석 | "통계 분석해줘" | analytics-expert |
| 리포트 요약 | "요약해줘" / "핵심만" | report-summarizer |
| 🆕 TDD 개발 | "TDD로 개발해줘" | tdd-expert |
| 🆕 UI 점검 | "디자인 점검해줘" | design-system-guardian |
| 🆕 성능 분석 | "성능 분석해줘" | performance-optimizer |
| 🆕 데이터 이전 | "마이그레이션해줘" | migration-helper |

---

## 📊 에이전트 활용 통계 (권장)

### 🔥 매일 사용
- `code-reviewer`: 모든 코드 작업 후
- `code-fixer`: 리뷰 피드백 반영

### 📈 자주 사용
- `firebase-cost-optimizer`: Firebase 코드 작업 시
- `bug-hunter`: 버그 발생 시
- `test-writer`: 새 기능 추가 시
- 🆕 `security-auditor`: 배포 전

### 📅 주기적 사용
- `refactor-expert`: 주간 코드 정리
- `doc-writer`: 기능 완성 시
- `report-analyst`: 월간 보고서 작성 시
- 🆕 `analytics-expert`: 주간/월간 리포트 생성

### 🌙 필요 시 사용
- `academy-domain-expert`: 새 도메인 기능 설계
- `cloud-function-architect`: Cloud Function 추가
- 🆕 `notification-designer`: 알림 기능 추가

---

## ⚠️ 주의사항

### ✅ DO (해야 할 것)
1. 워크플로우 순서 준수
2. 자동 트리거 활용
3. 결과 검증 필수
4. 문서 업데이트
5. 🆕 배포 전 보안 검사

### ❌ DON'T (하지 말 것)
1. 같은 에이전트 중복 실행
2. 순서 뒤바꾸기 (reviewer 전에 fixer)
3. 역할 오용 (doc-writer에게 검토 요청)
4. 검증 없이 배포
5. 🆕 보안 검사 없이 배포

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

### Q5: 🆕 보안 검사는 언제 해야 하나요?
**A**:
- 배포 전 필수
- 개인정보 관련 코드 수정 후
- 인증/권한 로직 변경 후

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

### v1.5 (2026-01-11) - 현재
- ✅ **tdd-expert** 추가 (TDD 워크플로우)
- ✅ **design-system-guardian** 추가 (UI/UX 일관성)
- ✅ **performance-optimizer** 추가 (성능 최적화)
- ✅ **migration-helper** 추가 (데이터 마이그레이션)
- ✅ 에이전트 18개로 확장
- ✅ 워크플로우 11개로 확장

### v1.4 (2026-01-09)
- ✅ **report-summarizer** 추가 (리포트 요약)
- ✅ 에이전트 14개로 확장
- ✅ 기존 에이전트에 report-summarizer 협업 연계 추가

### v1.3 (2026-01-09)
- ✅ **security-auditor** 추가 (보안 검사)
- ✅ **notification-designer** 추가 (알림 설계)
- ✅ **analytics-expert** 추가 (데이터 분석)
- ✅ 워크플로우 3개 추가 (총 8개)
- ✅ 전체 문서 업데이트

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

# 4. 🆕 보안 검사 포함
"코드 리뷰하고 보안 검사까지 해줘"
# code-reviewer → security-auditor 순차 실행

# 5. 🆕 리포트 요약 체인
"코드 리뷰하고 요약해줘"
# code-reviewer → report-summarizer 순차 실행
```

### 베스트 프랙티스
1. **작은 단위로**: 큰 작업은 여러 단계로 분할
2. **검증 우선**: 각 단계 후 결과 확인
3. **문서화 습관**: 중요한 변경사항 기록
4. **정기 점검**: 주기적으로 전체 코드 리뷰
5. **🆕 보안 우선**: 배포 전 반드시 보안 검사

---

**관리자**: ijw-calander 개발팀
**문서 작성**: Claude
**최종 업데이트**: 2026-01-11
