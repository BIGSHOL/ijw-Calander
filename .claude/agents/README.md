# Claude Code Agent System

> **Project**: ijw-calander (Academy Management System)
> **Updated**: 2026-02-06
> **Structure**: 15 Teams, 89 Agents + 1 Director Command

---

## Architecture

```
refactor (Director Command, opus model)
|
|-- Frontend Team (frontend-lead) .......... 6 agents
|-- Backend Team (backend-lead) ............ 6 agents
|-- Database Team (database-lead) .......... 6 agents
|-- Test Team (test-lead) .................. 6 agents
|-- Review Team (review-lead) .............. 8 agents
|-- Security Team (security-lead) .......... 6 agents
|-- Cost Optimization Team (cost-lead) ..... 6 agents
|-- Design Team (design-lead) .............. 6 agents
|-- Debug Team (debug-lead) ................ 5 agents
|-- Content Team (content-lead) ............ 7 agents
|-- Migration Team (migration-lead) ........ 5 agents
|-- Mobile View Team (mobile-view-lead) .... 6 agents
|-- Desktop View Team (desktop-view-lead) .. 6 agents
|-- Tablet View Team (tablet-view-lead) .... 6 agents
|-- Mobile Team (mobile-lead) .............. 7 agents
```

Director: `.claude/commands/refactor.md` (opus model, Task tool access)
Agents: `.claude/agents/*.md` (sonnet model, subagent_type for Task)

---

## Team Details

### 1. Frontend Team (frontend-lead)

| Agent | Role |
|-------|------|
| frontend-lead | Team lead. React 19 component architecture |
| component-refactorer | Component split/merge/optimization |
| state-optimizer | State management optimization |
| ui-consistency | UI design consistency |
| performance-optimizer | React rendering performance |
| accessibility-specialist | A11y, responsive design |

Access: `components/`, `hooks/`, `pages/`, `App.tsx`, `types.ts`

### 2. Backend Team (backend-lead)

| Agent | Role |
|-------|------|
| backend-lead | Team lead. Firebase Cloud Functions |
| cloud-function-architect | Cloud Functions architecture |
| api-designer | API standardization |
| firebase-cost-optimizer | Firebase cost optimization (Cost team shared) |
| error-handler | Error handling patterns |
| caching-specialist | Caching strategy |

Access: `functions/`, `firebaseConfig.ts`

### 3. Database Team (database-lead)

| Agent | Role |
|-------|------|
| database-lead | Team lead. Firestore schema/converter |
| schema-designer | Firestore schema design |
| query-optimizer | Query/index optimization |
| migration-helper | Migration scripts (Migration team shared) |
| data-validator | Data integrity verification |
| backup-specialist | Backup/recovery strategy |

Access: `converters.ts`, `types.ts`, `firestore.indexes.json`, `scripts/`

### 4. Test Team (test-lead)

| Agent | Role |
|-------|------|
| test-lead | Team lead. Test strategy |
| test-writer | Unit/integration test writing |
| tdd-expert | TDD workflow |
| e2e-tester | E2E testing |
| bug-hunter | Bug detection/fix (Debug team shared) |
| test-infra-specialist | Test infrastructure |

Access: `__tests__/`, `scripts/`, `*.test.ts`

### 5. Review Team (review-lead)

| Agent | Role |
|-------|------|
| review-lead | Team lead. Code quality standards |
| code-reviewer | Code review |
| refactor-expert | Refactoring patterns |
| doc-writer | Documentation |
| report-analyst | Report analysis |
| architecture-reviewer | Architecture review |
| analytics-expert | Operations data analysis/KPI |
| report-summarizer | Report summarization/briefing |

Access: All files (read-only)

### 6. Security Team (security-lead)

| Agent | Role |
|-------|------|
| security-lead | Team lead. Security policy |
| security-auditor | Security audit |
| firestore-rules-specialist | Firestore Security Rules |
| auth-specialist | Authentication/authorization |
| data-privacy-specialist | Personal data protection |
| dependency-scanner | Dependency vulnerability scanning |

Access: `firestore.rules`, `functions/index.js` (auth), `.env`

### 7. Cost Optimization Team (cost-lead)

| Agent | Role |
|-------|------|
| cost-lead | Team lead. Cost reduction strategy |
| bundle-optimizer | Bundle size optimization |
| function-cost-optimizer | Cloud Functions cost optimization |
| network-optimizer | Network optimization |
| resource-monitor | Resource monitoring |
| token-optimizer | Claude Code token cost optimization |

Access: All files (read-only) + `package.json`, bundle analysis
Note: `firebase-cost-optimizer` from Backend team shared

### 8. Design Team (design-lead)

| Agent | Role |
|-------|------|
| design-lead | Team lead. Design system |
| ux-researcher | UX research/analysis |
| ui-designer | UI component design |
| interaction-designer | Interaction design |
| responsive-specialist | Responsive design |
| design-system-guardian | Design system consistency |

Access: `components/`, `tailwind.config.*`, `index.css`
Brand colors: Navy(#081429), Yellow(#fdb813), Gray(#373d41)

### 9. Debug Team (debug-lead)

| Agent | Role |
|-------|------|
| debug-lead | Team lead. RADAR process |
| error-tracer | Error tracking/stack analysis |
| regression-tester | Regression testing |
| firebase-debugger | Firebase-specific debugging |
| performance-debugger | Performance issue debugging |

Access: All files (full access)
Note: `bug-hunter` from Test team shared
Process: Reproduce -> Analyze -> Diagnose -> Act -> Regression (RADAR)

### 10. Content Team (content-lead)

| Agent | Role |
|-------|------|
| content-lead | Team lead. Student-centered content |
| ui-text-specialist | UI text/labels |
| data-display-specialist | Data display formats |
| i18n-specialist | Korean-English mapping/terminology |
| help-content-specialist | Help/guide/onboarding content |
| notification-designer | Notification/message content |
| academy-domain-expert | Academy domain logic/business |

Access: `components/` (text), `types.ts` (labels/enum)

### 11. Migration Team (migration-lead)

| Agent | Role |
|-------|------|
| migration-lead | Team lead. SAFE process |
| schema-migrator | Schema change impact analysis |
| data-integrity-checker | Data integrity verification |
| code-sync-specialist | Code reference synchronization |
| rollback-specialist | Rollback/emergency recovery |

Access: All files (full access)
Note: `migration-helper` from Database team shared
Process: Survey -> Architect -> Fulfill -> Evaluate (SAFE)

### 12. Mobile View Team

| Agent | Role |
|-------|------|
| mobile-view-lead | Team lead. Mobile screen (~767px) optimization |
| mobile-layout | Mobile layout/grid |
| mobile-navigation | Bottom nav/drawer/mobile menu |
| touch-ux | Touch interaction/gesture/swipe |
| mobile-form | Mobile form input optimization |
| mobile-performance | Mobile performance/loading optimization |

Breakpoint: ~767px (default, no prefix)
Focus: Touch UX, one-hand operation, progressive disclosure

### 13. Desktop View Team

| Agent | Role |
|-------|------|
| desktop-view-lead | Team lead. Desktop screen (1024px~) optimization |
| desktop-layout | Wide layout/multi-column |
| desktop-navigation | Sidebar/topbar/breadcrumb navigation |
| keyboard-ux | Keyboard shortcuts/focus management |
| data-table | Desktop table/grid optimization |
| desktop-modal | Modal/panel/drawer desktop UX |

Breakpoint: 1024px~ (`lg:`, `xl:`, `2xl:`)
Focus: Space utilization, information density, keyboard/mouse UX

### 14. Tablet View Team

| Agent | Role |
|-------|------|
| tablet-view-lead | Team lead. Tablet screen (768px~1023px) optimization |
| tablet-layout | Adaptive layout for tablet |
| orientation-handler | Portrait/landscape mode handling |
| hybrid-input | Touch + pointer hybrid input |
| tablet-table | Tablet table/list optimization |
| tablet-modal | Tablet modal/sheet/panel UX |

Breakpoint: 768px~1023px (`md:`)
Focus: Portrait/landscape adaptation, hybrid input, split view

### 15. Mobile Team (모바일화 전담)

| Agent | Role |
|-------|------|
| mobile-lead | Team lead. PWA/네이티브 앱 전환/모바일 전략 총괄 |
| pwa-specialist | Service Worker, Web App Manifest, 캐싱 전략 |
| native-build-specialist | Capacitor 네이티브 빌드, 앱스토어 배포 |
| offline-specialist | 오프라인 지원, Firestore persistence, 동기화 |
| mobile-push-specialist | FCM 푸시 알림, 알림 카테고리 관리 |
| mobile-testing-specialist | 모바일 테스팅, Lighthouse, 디바이스 호환성 |
| mobile-ux-specialist | 모바일 UI/UX, 터치 인터랙션, 네비게이션 패턴 |

Focus: PWA, 네이티브 앱 전환, 오프라인 지원, 푸시 알림, 모바일 UX

> **Mobile View Team vs Mobile Team**
> - Mobile View Team: 반응형 UI (~767px 화면 대응)
> - Mobile Team: 모바일 앱화 (PWA, 오프라인, 푸시, 네이티브 빌드)
>
> **협력 관계**: 두 팀은 긴밀히 협업합니다. Mobile View Team이 반응형 레이아웃을 구현하면, Mobile Team이 PWA/오프라인/푸시를 추가하여 완전한 모바일 경험을 제공합니다.

---

## Shared Agents

Some agents serve on multiple teams:

| Agent | Primary Team | Shared With |
|-------|-------------|-------------|
| mobile-ux-specialist | Mobile | Mobile View (터치 UX 협업) |
| touch-ux | Mobile View | Mobile (모바일 UX 협업) |
| firebase-cost-optimizer | Backend | Cost Optimization |
| migration-helper | Database | Migration |
| bug-hunter | Test | Debug |

---

## Access Rights

| Level | Teams | Scope |
|-------|-------|-------|
| Full access (R/W) | Director, Debug, Migration | All project files |
| Domain access (R/W) | Frontend, Backend, Database, Security, Design, Content, Test | Own domain files |
| Read-only | Review, Cost Optimization | All files (analysis/review) |

---

## Dispatch Priority

| Priority | Situation | Teams Dispatched |
|----------|-----------|-----------------|
| P0 (immediate) | Error/Bug | Debug + related teams |
| P0 (immediate) | Security vulnerability | Security (can halt all) |
| P1 (high) | New feature | Frontend + Backend + DB |
| P1 (high) | Performance issue | Cost Optimization + Debug |
| P1 (high) | Data migration | Migration + DB |
| P2 (medium) | UI/UX improvement | Design + Frontend |
| P2 (medium) | 모바일화/PWA | Mobile + Mobile View |
| P2 (medium) | Refactoring | Review + related teams |
| P2 (medium) | Content update | Content |
| P2 (medium) | Test writing | Test |
| P3 (low) | Documentation | Review (doc-writer) |

---

## Usage

### Via Director (recommended for complex tasks)
```
/refactor [description of work]
```
The Director analyzes the situation, dispatches appropriate teams in parallel/sequence, and reports results.

### Via Individual Agent (for specific tasks)
Use Task tool with `subagent_type` matching the agent name:
```
Task(subagent_type="code-reviewer", prompt="Review App.tsx")
Task(subagent_type="bug-hunter", prompt="Fix attendance error")
```

### Quick Reference

| Situation | Agent/Team |
|-----------|-----------|
| Code review | code-reviewer |
| Bug fix | bug-hunter / debug-lead |
| New feature design | academy-domain-expert |
| Refactoring | refactor-expert |
| Documentation | doc-writer |
| Security audit | security-auditor |
| Performance issue | performance-debugger |
| Cost analysis | firebase-cost-optimizer |
| UI consistency | design-system-guardian |
| Data migration | migration-lead |
| Report summary | report-summarizer |
| Test writing | test-writer |
| PWA/모바일화 | mobile-lead |
| 푸시 알림 | mobile-push-specialist |
| 오프라인 지원 | offline-specialist |

---

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + TailwindCSS
- **Backend**: Firebase Cloud Functions (Node.js)
- **Database**: Cloud Firestore (Korean field names + converter pattern)
- **Auth**: Firebase Authentication (RBAC)
- **Deploy**: Vercel (frontend) + Firebase (Cloud Functions)
- **Standards**: Vercel React Best Practices

---

## Changelog

### v2.1 (2026-02-06) - Current
- Added Mobile Team (mobile-lead): 모바일화 전담팀
- New agents: pwa-specialist, native-build-specialist, offline-specialist, mobile-push-specialist, mobile-testing-specialist, mobile-ux-specialist
- Mobile Team ↔ Mobile View Team 협력 관계 정의
- 15 Teams, 89 Agents total

### v2.0 (2026-01-31)
- Complete restructure: flat 17-agent system -> 11-team hierarchy
- Added Director command (opus model) for orchestration
- Created 6 new teams: Frontend, Backend, Database, Design, Debug, Content
- Added Migration team (SAFE process)
- Expanded to 67 agents with team leads
- Access rights distribution policy
- Autonomous dispatch system (P0-P3)
- Removed outdated docs (ROLE-CLARIFICATION, UPDATE-GUIDE, WORKFLOW)
- Removed redundant agent (code-fixer)

### v1.4 (2026-01-09)
- Added report-summarizer, design-system-guardian, agent-orchestrator, token-optimizer
- 17 agents total

### v1.0-v1.3 (2025-12-30 ~ 2026-01-09)
- Initial agent system through iterative expansion

---

**Maintainer**: ijw-calander dev team
**Last updated**: 2026-01-31