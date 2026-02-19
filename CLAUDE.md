## Skills

커스텀 검증 및 유지보수 스킬은 `.claude/skills/`에 정의되어 있습니다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |
| `verify-timetable` | 시간표 도메인(Math/shared)의 핵심 패턴과 규칙을 검증합니다 |
| `verify-lazy-loading` | 탭/모달/서브매니저의 React.lazy + Suspense + ErrorBoundary 패턴을 검증합니다 |
| `verify-test-coverage` | hooks/utils의 테스트 파일 존재 여부를 검증합니다 |
| `verify-firebase-mutations` | Firebase mutation 훅의 invalidateQueries/에러처리 패턴을 검증합니다 |
| `verify-schedule-tabs` | 일정 그룹(연간일정/간트차트) 탭의 컴포넌트 구조와 핵심 기능을 검증합니다 |
| `verify-class-tabs` | 수업 그룹(시간표/출석부/출결/수업/강의실/강의실배정/숙제/시험/교재) 탭의 핵심 기능을 검증합니다 |
| `verify-student-tabs` | 학생 그룹(학생관리/등록상담/학생상담/성적관리/퇴원관리/계약관리/성적표) 탭의 핵심 기능을 검증합니다 |
| `verify-admin-tabs` | 관리 그룹(수강료현황/직원관리/수납관리/자료실/역할관리/통계분석/급여관리) 탭의 핵심 기능을 검증합니다 |
| `verify-comm-tabs` | 소통 그룹(공지사항/학부모포털/알림센터) 탭의 핵심 기능을 검증합니다 |
| `verify-marketing-tabs` | 마케팅 그룹(마케팅/셔틀관리) 탭의 핵심 기능을 검증합니다 |
| `verify-permissions` | 역할별 탭 접근권한, 버튼 노출, 권한 체크 로직을 검증합니다 |
| `verify-responsive` | 모바일/태블릿/데스크톱 반응형 TailwindCSS 패턴 일관성을 검증합니다 |
| `verify-error-boundaries` | ErrorBoundary + fallback UI + 에러 복구 패턴을 검증합니다 |
| `verify-query-patterns` | React Query 캐시키/enabled/staleTime 일관성과 쿼리 패턴을 검증합니다 |
| `verify-bundle-size` | 코드 스플리팅 효과와 번들 크기를 검증합니다 |
| `generate-tab-component` | 새 탭 추가 시 보일러플레이트(컴포넌트/lazy import/권한/메타데이터)를 자동 생성합니다 |
| `generate-hook-test` | 훅 테스트 템플릿을 프로젝트 표준 패턴에 맞춰 자동 생성합니다 |
| `generate-import-modal` | Excel 가져오기 모달을 useExcelImport 훅 기반으로 자동 생성합니다 |
