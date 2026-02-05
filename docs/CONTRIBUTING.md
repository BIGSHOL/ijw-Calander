# 기여 가이드 (Contributing Guide)

이 문서는 인재원 학원 관리 시스템 프로젝트에 기여하는 방법을 안내합니다.

## 목차

- [시작하기](#시작하기)
- [코드 스타일 가이드](#코드-스타일-가이드)
- [커밋 메시지 규칙](#커밋-메시지-규칙)
- [브랜치 전략](#브랜치-전략)
- [Pull Request 가이드라인](#pull-request-가이드라인)
- [코드 리뷰 프로세스](#코드-리뷰-프로세스)
- [테스트 작성](#테스트-작성)
- [문서화](#문서화)

---

## 시작하기

### 1. 저장소 포크 및 클론

```bash
# 저장소 클론
git clone https://github.com/your-org/ijw-calander.git
cd ijw-calander

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 Firebase 설정 입력

# 개발 서버 실행
npm run dev
```

### 2. 개발 환경 확인

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git 설치
- VSCode (권장)

### 3. VSCode 확장 프로그램 (권장)

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

---

## 코드 스타일 가이드

### TypeScript

#### 1. 명명 규칙

```typescript
// ✅ 컴포넌트: PascalCase
function StudentList() {}

// ✅ 변수/함수: camelCase
const studentName = '홍길동';
function fetchStudents() {}

// ✅ 상수: UPPER_SNAKE_CASE
const MAX_STUDENTS = 100;
const API_BASE_URL = 'https://api.example.com';

// ✅ 타입/인터페이스: PascalCase
interface Student {
  id: string;
  name: string;
}

type StudentStatus = 'active' | 'withdrawn';

// ✅ 컴포넌트 Props 타입: ComponentNameProps
interface StudentListProps {
  students: Student[];
  onSelect: (id: string) => void;
}
```

#### 2. 타입 정의

```typescript
// ✅ interface 우선 사용 (확장 가능)
interface User {
  id: string;
  name: string;
}

interface StaffMember extends User {
  role: string;
}

// ✅ Union 타입은 type 사용
type Status = 'active' | 'inactive';
type ID = string | number;

// ❌ any 사용 금지
const data: any = {}; // 피하기

// ✅ unknown 또는 구체적인 타입 사용
const data: unknown = {};
const students: Student[] = [];
```

#### 3. 함수 타입 정의

```typescript
// ✅ 화살표 함수 타입
type OnClick = (event: React.MouseEvent) => void;

// ✅ 함수 선언 타입
interface FormProps {
  onSubmit: (values: FormValues) => Promise<void>;
}
```

### React 컴포넌트

#### 1. 함수형 컴포넌트

```typescript
// ✅ 타입 정의 먼저
interface StudentCardProps {
  student: Student;
  onEdit?: (id: string) => void;
}

// ✅ React.FC 대신 일반 함수 사용
function StudentCard({ student, onEdit }: StudentCardProps) {
  return (
    <div>
      <h3>{student.name}</h3>
      {onEdit && <button onClick={() => onEdit(student.id)}>수정</button>}
    </div>
  );
}

// ✅ export default 사용
export default StudentCard;
```

#### 2. Hooks 사용

```typescript
// ✅ 컴포넌트 최상단에서 호출
function MyComponent() {
  const [count, setCount] = useState(0);
  const { data } = useStudents();
  const navigate = useNavigate();

  // ❌ 조건문 안에서 훅 호출 금지
  if (condition) {
    const { data } = useQuery(); // 에러!
  }

  // ✅ 조건은 훅 내부에서 처리
  const { data } = useQuery({ enabled: condition });
}
```

#### 3. 상태 관리

```typescript
// ✅ 단일 상태
const [name, setName] = useState('');

// ✅ 객체 상태 (관련된 여러 값)
const [formData, setFormData] = useState({
  name: '',
  email: '',
  phone: '',
});

// ✅ 함수형 업데이트 (이전 상태 기반)
setCount(prev => prev + 1);
```

### Tailwind CSS

#### 1. 클래스 순서

```typescript
// ✅ 레이아웃 → 스페이싱 → 타이포그래피 → 색상 → 기타 순서
<div className="flex items-center gap-2 p-4 text-sm font-bold text-gray-700 bg-white rounded-lg shadow-md hover:bg-gray-50">
  Content
</div>
```

#### 2. 반응형 디자인

```typescript
// ✅ 모바일 우선 (Mobile First)
<div className="text-sm md:text-base lg:text-lg">
  Responsive Text
</div>

// ✅ 브레이크포인트
// sm: 640px (모바일)
// md: 768px (태블릿)
// lg: 1024px (데스크탑)
// xl: 1280px (대형 데스크탑)
```

#### 3. 커스텀 클래스 지양

```typescript
// ❌ 인라인 스타일 피하기
<div style={{ marginTop: '10px' }}>Bad</div>

// ✅ Tailwind 유틸리티 사용
<div className="mt-2.5">Good</div>

// ✅ 복잡한 스타일은 컴포넌트로 분리
function Card({ children }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {children}
    </div>
  );
}
```

---

## 커밋 메시지 규칙

### 커밋 메시지 포맷

```
<타입>(<스코프>): <제목>

<본문> (선택사항)

<푸터> (선택사항)
```

### 타입 (Type)

| 타입 | 설명 | 예시 |
|------|------|------|
| feat | 새로운 기능 추가 | feat(timetable): 영어 시간표 통합 뷰 추가 |
| fix | 버그 수정 | fix(attendance): 출석 중복 체크 버그 수정 |
| docs | 문서 수정 | docs: README에 환경 변수 설명 추가 |
| style | 코드 포맷팅 (기능 변경 없음) | style: ESLint 규칙 적용 |
| refactor | 코드 리팩토링 | refactor(hooks): useStudents 최적화 |
| test | 테스트 추가/수정 | test: useAttendance 훅 테스트 추가 |
| chore | 빌드/설정 변경 | chore: Vite 설정 업데이트 |
| perf | 성능 개선 | perf: collectionGroup으로 쿼리 최적화 |

### 스코프 (Scope)

- 변경된 모듈/기능 명시
- 예: `timetable`, `attendance`, `students`, `auth`, `hooks`

### 제목 (Subject)

- 50자 이내로 작성
- 명령형 동사 사용 ("추가하다", "수정하다")
- 마침표 없음

### 예시

```bash
# ✅ 좋은 커밋 메시지
feat(timetable): 반 이동 시뮬레이션 기능 추가
fix(attendance): 급여 계산 오류 수정
docs: HOOKS.md 문서 작성
refactor(students): useStudents 훅 React Query로 전환

# ❌ 나쁜 커밋 메시지
update code
fix bug
WIP
asdf
```

### 본문 (Body) - 선택사항

- 변경 이유와 내용을 상세히 설명
- 한 줄 비우고 작성

```
feat(timetable): 반 이동 시뮬레이션 기능 추가

학생들의 반 이동(레벨업/다운)을 미리 시뮬레이션할 수 있는 기능을 추가했습니다.
- UI에만 반영하고 Firestore는 수정하지 않음
- 확정 버튼 클릭 시 실제 DB 업데이트
- 취소 버튼으로 시뮬레이션 초기화 가능
```

### 푸터 (Footer) - 선택사항

- 이슈 번호 참조
- Breaking Change 명시

```
Closes #123
Fixes #456

BREAKING CHANGE: API 응답 형식 변경
```

---

## 브랜치 전략

### 브랜치 종류

```
main
  ↑
develop
  ↑
feature/xxx
hotfix/xxx
release/xxx
```

| 브랜치 | 설명 | 네이밍 |
|--------|------|--------|
| main | 프로덕션 브랜치 | main |
| develop | 개발 통합 브랜치 | develop |
| feature | 기능 개발 | feature/timetable-simulation |
| hotfix | 긴급 버그 수정 | hotfix/attendance-bug |
| release | 릴리스 준비 | release/v1.0.0 |

### 브랜치 생성 및 작업

```bash
# 1. develop 브랜치에서 최신 코드 받기
git checkout develop
git pull origin develop

# 2. feature 브랜치 생성
git checkout -b feature/new-feature

# 3. 작업 후 커밋
git add .
git commit -m "feat(module): 새 기능 추가"

# 4. 원격 저장소에 푸시
git push origin feature/new-feature

# 5. GitHub에서 Pull Request 생성
```

### 브랜치 네이밍 규칙

```bash
# ✅ 좋은 브랜치명
feature/timetable-simulation
feature/attendance-excel-export
fix/student-duplicate-check
hotfix/firebase-connection-error

# ❌ 나쁜 브랜치명
new-feature
mywork
test123
```

---

## Pull Request 가이드라인

### PR 생성 전 체크리스트

- [ ] 코드가 정상적으로 실행되는가?
- [ ] 린팅 오류가 없는가? (`npm run lint`)
- [ ] 테스트가 통과하는가? (`npm run test`)
- [ ] 커밋 메시지가 규칙에 맞는가?
- [ ] 불필요한 파일이 포함되지 않았는가?

### PR 제목

커밋 메시지와 동일한 규칙 적용

```
feat(timetable): 반 이동 시뮬레이션 기능 추가
```

### PR 설명 템플릿

```markdown
## 변경 사항
- 반 이동 시뮬레이션 UI 추가
- 확정/취소 버튼 구현
- Firestore 업데이트 로직 작성

## 변경 이유
학생들의 반 이동을 미리 확인하고 실수를 방지하기 위함

## 테스트 방법
1. 시간표 탭 진입
2. 학생 선택 후 '반 이동' 버튼 클릭
3. 대상 반 선택
4. 시뮬레이션 결과 확인
5. 확정 버튼 클릭하여 저장

## 스크린샷 (선택사항)
![시뮬레이션 화면](screenshot.png)

## 관련 이슈
Closes #123
```

### PR 크기

- 한 PR에는 하나의 기능/버그 수정만 포함
- 500줄 이하 권장
- 큰 기능은 여러 PR로 분할

---

## 코드 리뷰 프로세스

### 리뷰어 가이드

#### 체크 포인트

1. **기능 동작**
   - 요구사항을 충족하는가?
   - 버그가 없는가?
   - 엣지 케이스 처리가 되어 있는가?

2. **코드 품질**
   - 가독성이 좋은가?
   - 중복 코드가 없는가?
   - 네이밍이 명확한가?

3. **성능**
   - 불필요한 리렌더링이 없는가?
   - 메모이제이션이 적절한가?
   - 쿼리 최적화가 되어 있는가?

4. **보안**
   - 민감 정보가 노출되지 않는가?
   - 입력 검증이 되어 있는가?
   - 권한 체크가 적절한가?

5. **테스트**
   - 테스트 커버리지가 충분한가?
   - 중요한 로직에 테스트가 있는가?

#### 코멘트 방법

```markdown
# ✅ 건설적인 피드백
`studentList`보다는 `activeStudents`가 더 명확할 것 같습니다.

이 부분은 useMemo로 최적화하면 좋을 것 같습니다:
```typescript
const filtered = useMemo(() =>
  students.filter(s => s.status === 'active'),
  [students]
);
```

# ❌ 부정적인 피드백
이 코드는 별로네요.
왜 이렇게 짰나요?
```

### 작성자 가이드

#### 피드백 수용

- 코멘트에 감사하고 긍정적으로 받아들이기
- 동의하지 않는 경우 정중하게 의견 제시
- 모든 코멘트에 답변하기

#### 수정 후

- 변경 사항을 커밋에 반영
- 리뷰어에게 재검토 요청

---

## 테스트 작성

### 유닛 테스트

```typescript
// hooks/useStudents.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useStudents } from './useStudents';

describe('useStudents', () => {
  it('학생 목록을 정상적으로 조회한다', async () => {
    const { result } = renderHook(() => useStudents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.students).toHaveLength(10);
  });

  it('학생을 추가할 수 있다', async () => {
    const { result } = renderHook(() => useStudents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.addStudent({
      name: '홍길동',
      status: 'active',
    });

    expect(result.current.students).toHaveLength(11);
  });
});
```

### 컴포넌트 테스트

```typescript
// components/StudentCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import StudentCard from './StudentCard';

describe('StudentCard', () => {
  const mockStudent = {
    id: '1',
    name: '홍길동',
    status: 'active',
  };

  it('학생 이름을 표시한다', () => {
    render(<StudentCard student={mockStudent} />);
    expect(screen.getByText('홍길동')).toBeInTheDocument();
  });

  it('수정 버튼 클릭 시 콜백이 호출된다', () => {
    const handleEdit = jest.fn();
    render(<StudentCard student={mockStudent} onEdit={handleEdit} />);

    fireEvent.click(screen.getByText('수정'));
    expect(handleEdit).toHaveBeenCalledWith('1');
  });
});
```

### 테스트 실행

```bash
# 모든 테스트 실행
npm run test

# UI 모드로 실행
npm run test:ui

# 커버리지 리포트
npm run test:coverage

# 특정 파일만 테스트
npm run test useStudents.test.ts
```

---

## 문서화

### 코드 주석

```typescript
/**
 * 학생 목록을 조회하고 관리하는 훅
 *
 * @param includeWithdrawn - 퇴원생 포함 여부
 * @param enabled - 쿼리 활성화 여부
 * @returns 학생 목록 및 CRUD 함수
 *
 * @example
 * ```typescript
 * const { students, addStudent } = useStudents(false, true);
 *
 * await addStudent({
 *   name: '홍길동',
 *   status: 'active',
 * });
 * ```
 */
export function useStudents(
  includeWithdrawn = false,
  enabled = true
) {
  // 구현...
}
```

### README 업데이트

새로운 기능을 추가했다면 README.md의 "주요 기능" 섹션 업데이트

### 아키텍처 문서 업데이트

- 새로운 컬렉션 추가 시 `docs/ARCHITECTURE.md` 업데이트
- 데이터 흐름이 변경되면 다이어그램 수정

### 훅 문서 업데이트

- 새로운 훅 추가 시 `docs/HOOKS.md`에 설명 추가
- 파라미터, 반환값, 사용 예시 포함

---

## 자주 묻는 질문

### Q. 어떤 기능부터 개발하면 좋을까요?

A. GitHub Issues의 "good first issue" 라벨이 붙은 이슈부터 시작하세요.

### Q. 버그를 발견했어요. 어떻게 해야 하나요?

A. GitHub Issues에 버그 리포트를 작성해주세요. 재현 방법, 예상 동작, 실제 동작을 포함해주세요.

### Q. 기능 제안을 하고 싶어요.

A. GitHub Issues에 "Feature Request" 템플릿으로 제안해주세요.

### Q. 코드 리뷰가 너무 오래 걸려요.

A. 리뷰어에게 리마인드를 보내거나, PR을 더 작은 단위로 분할해보세요.

---

## 도움이 필요하신가요?

- 이슈: [GitHub Issues](https://github.com/your-org/ijw-calander/issues)
- 이메일: support@example.com
- 문서: [프로젝트 문서](../README.md)

---

**기여해주셔서 감사합니다!** 🎉
