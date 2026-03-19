# 인재원 학원 관리 시스템 (IJW Calendar)

> Firebase 기반 학원 통합 관리 플랫폼 - 시간표, 출석, 상담, 수납, 학생 관리 올인원 솔루션

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-19.2-61dafb)
![Firebase](https://img.shields.io/badge/Firebase-12.7-orange)
![Vite](https://img.shields.io/badge/Vite-6.2-646cff)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8)
![React Query](https://img.shields.io/badge/React_Query-5.90-ff4154)

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시작하기](#시작하기)
- [환경 변수 설정](#환경-변수-설정)
- [프로젝트 구조](#프로젝트-구조)
- [탭 시스템](#탭-시스템)
- [주요 커스텀 훅](#주요-커스텀-훅)
- [권한 시스템](#권한-시스템)
- [개발 가이드](#개발-가이드)
- [배포](#배포)
- [트러블슈팅](#트러블슈팅)

---

## 프로젝트 소개

인재원 학원 관리 시스템은 학원 운영에 필요한 모든 기능을 하나의 플랫폼에서 제공하는 웹 기반 SaaS 솔루션입니다.

### 핵심 목표

- **효율성**: 반복 작업 자동화로 업무 시간 절감
- **정확성**: 실시간 동기화로 데이터 불일치 제거
- **접근성**: 웹 기반으로 언제 어디서나 접근 가능 (임베드 모드 지원)
- **확장성**: 모듈식 탭 설계로 새로운 기능 추가 용이

### 주요 사용자

| 역할 | 주요 기능 |
|------|----------|
| **원장/관리자** | 전체 학원 운영 관리, 통계 분석, 역할 관리 |
| **강사** | 출석/성적 관리, 시간표 확인, 숙제/시험 관리 |
| **상담 담당자** | 등록 상담 기록, 학생 상담, 학부모 소통 |
| **회계 담당자** | 수납 관리, 급여 정산, 수강료 계산 |

---

## 주요 기능

### 일정 관리
| 기능 | 설명 |
|------|------|
| **대시보드** | 실시간 KPI (재원생, 출석률, 수납률), 상담 현황 추이 |
| **연간 일정** | 다단 비교 뷰 (최대 3년), 드래그앤드롭, 부서별 필터링, 반복 일정 |
| **간트 차트** | 프로젝트 일정 시각화, 부서별 업무 계획, 캘린더 연동 |

### 수업 운영
| 기능 | 설명 |
|------|------|
| **시간표** | 수학/영어 과목별 시간표, 통합 뷰, 반 이동 시뮬레이션, 엑셀 임포트 |
| **출석 관리** | 월별/세션별 출석 체크, 급여 자동 계산, 일괄 처리 |
| **일일 출결** | 일별 출결 현황 추적 |
| **수업 관리** | 반 스케줄, 강사 배정, 학생 배정 |
| **강의실 배정** | 시간대별 사용 현황, 충돌 감지 |
| **숙제 관리** | 과제 배정 및 제출 관리 |
| **시험 관리** | 시험 일정, 시험 시리즈 관리 |
| **교재 관리** | 교재 목록, 반별 교재 배정 |

### 학생 관리
| 기능 | 설명 |
|------|------|
| **학생 관리** | 통합 DB, 재원/퇴원/예비생 상태, 과목별 수강 이력, 중복 병합 |
| **등록 상담** | 상담 기록, 진행 상태 추적, 전환율 분석, 월별 목표 현황 |
| **학생 상담** | 재원생 상담 기록 및 진행 모니터링 |
| **성적 관리** | 성적 입력/조회, 과목별 추이, 성적표 자동 생성 |
| **퇴원 관리** | 퇴원 사유 추적, 통계 |
| **계약 관리** | 수강 계약 관리 |
| **학습 보고서** | AI 기반 학습 보고서 (Edutrix 연동) |

### 경영 관리
| 기능 | 설명 |
|------|------|
| **수납 현황** | 학생별 수납 내역, 미수금 추적, 월별 리포트 |
| **수강료 계산기** | 수강료 자동 계산, 청구서 CRUD, 세션/공휴일 관리 |
| **직원 관리** | 직원 정보, 휴가 관리, 과목 배정 |
| **수납 관리** | 결제 내역 관리, 청구서 발행 |
| **자료실** | 문서/파일 관리 |
| **역할 관리** | RBAC 기반 역할/권한 설정, 역할 시뮬레이션 |
| **통계 분석** | 경영 데이터 분석, 차트 시각화 |
| **급여 관리** | 강사별 급여 계산, 출석 기반 자동 정산 |

### 소통
| 기능 | 설명 |
|------|------|
| **공지사항** | 전체/부서별 공지 게시 |
| **학부모 포털** | 학부모 커뮤니케이션, QR코드 링크 |
| **알림 센터** | SMS/푸시 알림 관리 |

### 확장 기능
| 기능 | 설명 |
|------|------|
| **마케팅** | 마케팅 캠페인 관리 |
| **셔틀 관리** | 셔틀버스 노선/학생 배정 |
| **시간표 배포** | 시간표 이미지 생성 및 배포 |
| **회의록** | 회의 녹음 + AI 분석 보고서 (Gemini) |
| **AI 챗봇** | Gemini 기반 AI 어시스턴트 |

---

## 기술 스택

### Frontend
| 기술 | 용도 |
|------|------|
| **React 19.2** | UI 라이브러리 |
| **TypeScript 5.8** | 타입 안전성 |
| **Vite 6.2** | 빌드 도구 (13개 청크 코드 스플리팅) |
| **TailwindCSS 3.4** | 유틸리티 우선 스타일링 |
| **React Query 5.90** | 서버 상태 관리 (staleTime 5min, gcTime 30min) |
| **date-fns 4.1** | 날짜 처리 |
| **lucide-react 0.562** | 아이콘 라이브러리 |

### Backend
| 기술 | 용도 |
|------|------|
| **Firebase 12.7** | Firestore (NoSQL DB), Authentication, Storage |
| **Supabase 2.99** | Edutrix 학습 보고서 연동 |

### AI
| 기술 | 용도 |
|------|------|
| **@google/genai 1.34** | Gemini AI 챗봇, 회의록 분석 |
| **tesseract.js 7.0** | OCR 이미지 텍스트 인식 |

### UI/UX
| 기술 | 용도 |
|------|------|
| **@dnd-kit 6.3** | 드래그 앤 드롭 |
| **recharts 3.6** | 차트/그래프 시각화 |
| **jspdf 3.0 + html2canvas 1.4** | PDF 생성 |
| **xlsx 0.18** | 엑셀 임포트/익스포트 |
| **qrcode.react 4.2** | QR코드 생성 |
| **react-markdown 10.1** | 마크다운 렌더링 |

### DevOps
| 기술 | 용도 |
|------|------|
| **Vitest 4.0** | 유닛/통합 테스트 |
| **@testing-library/react 16.3** | 컴포넌트 테스트 |
| **ESLint 9.39** | 코드 린팅 |
| **Firebase Hosting** | 프로덕션/개발 배포 |

---

## 시작하기

### 사전 요구사항

```bash
Node.js >= 18.0.0
npm >= 9.0.0
```

### 설치

```bash
# 1. 저장소 클론
git clone https://github.com/your-org/ijw-calander.git
cd ijw-calander

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 값 설정

# 4. 개발 서버 실행
npm run dev
# → http://localhost:3001
```

---

## 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 설정합니다.

### 필수 변수

```env
# Firebase 프로젝트 설정 (Firebase Console에서 확인)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# 암호화 키 (개인정보 AES 암호화, 최소 32자)
VITE_ENCRYPTION_KEY=your_256bit_encryption_key_here

# 마스터 계정 이메일 (최고 권한)
VITE_MASTER_EMAILS=admin@example.com
```

### 선택 변수

```env
# Gemini AI (챗봇, 회의록 분석)
VITE_GEMINI_API_KEY=your_gemini_api_key

# Supabase (Edutrix 학습 보고서 연동)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# 레거시 Firebase (데이터 마이그레이션)
VITE_OLD_FIREBASE_PROJECT_ID=old_project_id
```

### 암호화 키 생성

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 보안 주의사항

- `.env.local`은 Git에 커밋하지 마세요
- 암호화 키 분실 시 기존 암호화 데이터 복구 불가
- 프로덕션에서는 호스팅 플랫폼의 환경 변수 관리 사용

---

## 프로젝트 구조

```
ijw-calander/
├── components/              # React 컴포넌트 (47개 도메인 그룹)
│   ├── Analytics/           # 통계 분석 대시보드
│   ├── Attendance/          # 출석 관리 (월별/세션별)
│   ├── Auth/                # 로그인/인증 UI
│   ├── Billing/             # 수납 관리
│   ├── Calendar/            # 연간 일정 (드래그앤드롭)
│   ├── Chatbot/             # AI 어시스턴트 (Gemini)
│   ├── ClassManagement/     # 수업/반 관리
│   ├── Classroom/           # 강의실 현황
│   ├── ClassroomAssignment/ # 강의실 자동 배정
│   ├── Common/              # 공통 UI (Badge, Button, Modal, Table, ErrorBoundary 등 27개)
│   ├── ConsultationRecording/ # 상담 녹음/분석
│   ├── Contracts/           # 수강 계약
│   ├── DailyAttendance/     # 일일 출결 추적
│   ├── Dashboard/           # KPI 대시보드
│   ├── Embed/               # iframe 임베드 모드
│   ├── Exams/               # 시험 관리
│   ├── Gantt/               # 간트 차트
│   ├── Grades/              # 성적 관리
│   ├── Help/                # 도움말
│   ├── Homework/            # 숙제 관리
│   ├── Layout/              # AppHeader, TabContent, ModalManager
│   ├── Logs/                # 시스템 로그
│   ├── Marketing/           # 마케팅 캠페인
│   ├── MeetingMinutes/      # 회의록 (AI 분석 보고서)
│   ├── Navigation/          # 사이드바 네비게이션
│   ├── Notices/             # 공지사항
│   ├── Notifications/       # 알림 센터 (SMS)
│   ├── ParentPortal/        # 학부모 포털 (QR)
│   ├── PaymentReport/       # 수납 현황 리포트
│   ├── Payroll/             # 급여 관리/정산
│   ├── RegistrationConsultation/ # 등록 상담 (전환율)
│   ├── Reports/             # 학습 보고서 (Edutrix)
│   ├── Resources/           # 자료실
│   ├── RoleManagement/      # 역할/권한 관리
│   ├── Settings/            # 사용자 설정
│   ├── Shuttle/             # 셔틀버스 관리
│   ├── Staff/               # 직원 관리
│   ├── StudentConsultation/ # 학생 상담
│   ├── StudentManagement/   # 학생 DB (통합)
│   ├── TaskMemo/            # 업무 메모
│   ├── Textbooks/           # 교재 관리
│   ├── Timetable/           # 시간표 (핵심 모듈)
│   │   ├── Math/            # 수학 시간표
│   │   ├── English/         # 영어 시간표
│   │   ├── Generic/         # 공통 시간표 UI
│   │   ├── Shuttle/         # 셔틀 시간표
│   │   └── shared/          # 시간표 공유 유틸
│   ├── TimetableDistribution/ # 시간표 배포
│   ├── TuitionCalculator/   # 수강료 계산기
│   └── WithdrawalManagement/ # 퇴원 관리
├── hooks/                   # 커스텀 훅 (87개)
├── utils/                   # 유틸리티 함수 (27개)
├── types/                   # TypeScript 타입 (22개)
├── contexts/                # React Context (HeaderCollapseContext)
├── scripts/                 # 마이그레이션 스크립트 (19개)
├── App.tsx                  # 메인 앱 (탭 라우팅, 모달 관리)
├── index.tsx                # 엔트리 포인트
├── firebaseConfig.ts        # Firebase 초기화 + 진단
├── queryClient.ts           # React Query 전역 설정
├── converters.ts            # Firestore 한글↔영문 컨버터
├── constants.ts             # 앱 상수
└── vite.config.ts           # Vite 빌드 (코드 스플리팅)
```

---

## 탭 시스템

33개 탭이 6개 그룹으로 구성됩니다.

| 그룹 | 탭 |
|------|-----|
| **홈** | 대시보드 |
| **일정** | 연간일정, 간트차트 |
| **수업** | 시간표, 출석부, 일일출결, 수업관리, 강의실, 강의실배정, 숙제관리, 시험관리, 교재관리 |
| **학생** | 학생관리, 등록상담, 학생상담, 성적관리, 퇴원관리, 계약관리, 학습보고서 |
| **관리** | 수납현황, 수강료계산, 직원관리, 수납관리, 자료실, 역할관리, 통계분석, 급여관리 |
| **소통** | 공지사항, 학부모포털, 알림센터 |
| **마케팅** | 마케팅, 셔틀관리, 시간표배포 |
| **AI/지원** | 회의록, 로그, 도움말 |

---

## 주요 커스텀 훅

### 인증/권한
| 훅 | 용도 |
|----|------|
| `useAuth` | 사용자 인증 상태 관리 |
| `usePermissions` | 기능별 권한 체크 |
| `useTabPermissions` | 탭 접근 권한 |
| `useRoleHelpers` | 역할 유틸리티 |

### 데이터 조회 (React Query)
| 훅 | 용도 |
|----|------|
| `useFirebaseQueries` | 부서, 강사, 공휴일, 시스템설정 등 기본 데이터 |
| `useStudents` | 학생 목록 조회/검색 |
| `useClasses` | 반 목록 조회 |
| `useStaff` | 직원 정보 |
| `useAttendance` | 출석 데이터 (1076줄, 최대 규모) |
| `useConsultations` | 상담 기록 |
| `useEnrollments` | 수강 이력 |

### 데이터 변경 (Mutations)
| 훅 | 용도 |
|----|------|
| `useClassMutations` | 반 CRUD (728줄) |
| `useConsultationMutations` | 상담 CRUD |
| `useEventCrud` | 일정 CRUD |
| `useEnglishClassUpdater` | 영어 반 업데이트 (910줄) |

### UI 상태 (`useAppState`)
- `useCalendarState` - 캘린더 필터/뷰
- `useEventModalState` - 일정 모달
- `useModalState` - 글로벌 모달
- `useTimetableState` - 시간표 뷰모드
- `useStudentFilterState` - 학생 필터링
- `useGradesFilterState` - 성적 필터링
- `useDarkMode` - 다크모드
- `usePendingEventMoves` - 일정 이동 임시 상태

### 유틸리티
| 훅 | 용도 |
|----|------|
| `useExcelImport` | 엑셀 파일 임포트 |
| `useGlobalSearch` | 전역 검색 |
| `useForm` | 폼 상태 관리 |
| `useFocusTrap` | 포커스 트랩 (접근성) |
| `useVersionCheck` | 앱 버전 업데이트 감지 |
| `useDraggable` | 드래그 유틸 |

---

## 권한 시스템

**역할 기반 접근 제어 (RBAC)**를 사용합니다.

### 역할 계층

```
master (최고 관리자)
  └─ admin (관리자)
       └─ manager (매니저)
            ├─ math_lead (수학 리더)
            │    └─ math_teacher (수학 강사)
            └─ english_lead (영어 리더)
                 └─ english_teacher (영어 강사)
                      └─ user (일반 사용자)
```

### 권한 종류

| 종류 | 설명 |
|------|------|
| **탭 접근 권한** | 특정 탭(모드) 접근 가능 여부 |
| **데이터 권한** | 읽기/쓰기/삭제 권한 |
| **기능 권한** | 특정 기능(버튼, 액션) 사용 가능 여부 |

### 사용 예시

```typescript
import { usePermissions } from './hooks/usePermissions';

function MyComponent() {
  const { hasPermission } = usePermissions(userProfile);

  const canEdit = hasPermission('students.edit');
  const canDelete = hasPermission('students.delete');

  return (
    <>
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
    </>
  );
}
```

---

## 개발 가이드

### 코드 스타일

- **한국어 UI**, 코드 주석은 한국어
- **TypeScript** 사용 (strict: false)
- **함수형 컴포넌트** + **Hooks** 패턴
- **TailwindCSS** 유틸리티 클래스 우선
- Path alias: `@` = 프로젝트 루트
- 프로덕션 빌드 시 `console.log`/`debug`/`info` 자동 제거

### 커밋 메시지 규칙

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅 (기능 변경 없음)
refactor: 코드 리팩토링
test: 테스트 추가/수정
chore: 빌드/설정 변경
```

예시:
```
feat(timetable): 영어 시간표 통합 뷰 추가
fix(attendance): 출석 중복 체크 버그 수정
```

### 아키텍처 패턴

```
Firestore → React Query 훅 (캐시) → 컴포넌트 → useAppState (크로스 컴포넌트)
```

- **React Query**: staleTime 5min, gcTime 30min, refetchOnWindowFocus: true
- **Firestore 컨버터**: 한글 필드명 ↔ 영문 필드명 양방향 변환
- **Lazy Loading**: React.lazy() + Suspense + ErrorBoundary
- **코드 스플리팅**: 13개 수동 청크 (react, firebase, lucide, charts 등)
- **개인정보**: AES 암호화 (`utils/encryption.ts`)

### 스크립트

```bash
npm run dev           # 개발 서버 (localhost:3001)
npm run build         # 프로덕션 빌드
npm run preview       # 빌드 미리보기
npm run test          # 테스트 실행
npm run test:ui       # UI 모드 테스트
npm run test:coverage # 커버리지 리포트
npm run lint          # ESLint 검사
npm run lint:fix      # ESLint 자동 수정
npm run migrate       # 데이터 마이그레이션
npm run validate      # 마이그레이션 검증
```

---

## 배포

### Firebase Hosting

```bash
# 빌드 + 배포
npm run build
npx firebase deploy --only hosting

# 개발 환경 배포
npx firebase deploy --only hosting:dev

# 프로덕션 배포
npx firebase deploy --only hosting:prod
```

### 배포 설정

| 설정 | 값 |
|------|-----|
| **프로덕션 타겟** | `ijw-calander` |
| **개발 타겟** | `ijw-calander-dev` |
| **SPA 리라이트** | `index.html` |
| **Assets 캐시** | 31536000초 (immutable) |
| **index.html 캐시** | no-cache |
| **version.json 캐시** | no-cache |
| **CSP** | frame-ancestors * (임베드 허용) |

### 버전 관리

빌드 시 `version.json`이 생성되어 캐시 버스팅에 사용됩니다. `useVersionCheck` 훅이 클라이언트에서 새 버전 감지 시 업데이트 토스트를 표시합니다.

---

## 트러블슈팅

### Firebase 연결 오류
```
Error: Missing required environment variables
```
**해결**: `.env.local` 파일의 Firebase 설정값 확인

### 빌드 오류
```
Module not found: Can't resolve 'xxx'
```
**해결**: `npm install` 재실행, 필요 시 `node_modules` 삭제 후 재설치

### 권한 오류
```
Permission denied
```
**해결**: Firebase Console에서 Firestore 보안 규칙 확인, 사용자 역할 재설정

### 암호화 키 오류
```
Decryption failed
```
**해결**: `VITE_ENCRYPTION_KEY`가 데이터 암호화 시 사용한 키와 동일한지 확인

### 캐시 문제
**해결**: React Query DevTools로 캐시 상태 확인, 브라우저 캐시 클리어

---

## 라이선스

이 프로젝트는 비공개 프로젝트입니다. 무단 복제 및 배포를 금지합니다.

---

**인재원 개발팀**
