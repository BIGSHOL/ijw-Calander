# App.tsx 수정 단계별 가이드

이 문서는 App.tsx를 수정하여 학생 관리 탭을 추가하는 방법을 단계별로 안내합니다.

## VS Code에서 수정하기

### 1단계: Import 추가

1. **VS Code에서 App.tsx 열기**
2. **Ctrl+G를 눌러 줄 번호 18로 이동**
3. **18번 줄 끝에 커서를 놓고 Enter** 를 눌러 새 줄 생성
4. **아래 코드 복사하여 붙여넣기**:

```typescript
import StudentManagementTab from './components/StudentManagement/StudentManagementTab';
```

---

### 2단계: appMode 타입 수정

1. **Ctrl+G를 눌러 줄 번호 42로 이동**
2. **42번 줄 전체를 선택 (Home → Shift+End)**
3. **아래 코드로 교체**:

```typescript
  const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | null>(null);
```

---

### 3단계: priority 배열 수정

1. **Ctrl+F를 눌러 검색창 열기**
2. **검색어 입력**: `const priority:`
3. **첫 번째 결과로 이동 (대략 204번 줄)**
4. **해당 줄 전체를 아래 코드로 교체**:

```typescript
    const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation' | 'students')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'];
```

---

### 4단계: preferredTab 타입 수정

1. **Ctrl+F로 검색**: `setAppMode(preferredTab as`
2. **첫 번째 결과로 이동 (대략 213번 줄)**
3. **해당 줄 전체를 아래 코드로 교체**:

```typescript
        setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students');
```

---

### 5단계: 학생 관리 버튼 추가

1. **Ctrl+F로 검색**: `📝 상담 관리`
2. **해당 버튼 블록을 찾습니다** (대략 1267번 줄)
3. **상담 관리 버튼 블록의 닫는 `)}` 다음 줄에 커서를 놓습니다** (대략 1270번 줄)
4. **아래 코드를 복사하여 붙여넣기**:

```typescript
              {/* Student Management */}
              {canAccessTab('students' as AppTab) && (
                <button
                  onClick={() => setAppMode('students')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    appMode === 'students'
                      ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  👥 학생 관리
                </button>
              )}
```

**주의**: 들여쓰기(indentation)를 주변 코드와 맞춰주세요.

---

### 6단계: 학생 관리 뷰 렌더링 추가

1. **Ctrl+F로 검색**: `appMode === 'attendance' ?`
2. **해당 블록을 찾습니다** (대략 1800번 줄)
3. **attendance 뷰 블록의 닫는 `</div>` 다음 줄에 커서를 놓습니다** (대략 1804번 줄)
4. **아래 코드를 복사하여 붙여넣기**:

```typescript
        ) : appMode === 'students' ? (
          /* Student Management View */
          <div className="w-full flex-1 overflow-hidden">
            <StudentManagementTab />
          </div>
```

**주의**: 들여쓰기를 주변 코드와 맞춰주세요.

---

## 수정 완료 후 확인

1. **Ctrl+S를 눌러 파일 저장**
2. **터미널에서 `npm run dev` 실행** (이미 실행 중이면 자동 리로드됨)
3. **브라우저에서 앱 새로고침**
4. **상단 네비게이션에 "👥 학생 관리" 버튼이 보이는지 확인**
5. **버튼 클릭하여 학생 목록이 표시되는지 확인**

## 오류 발생 시 체크리스트

### TypeScript 오류가 발생하는 경우

- [ ] `AppTab` import가 types.ts에서 제대로 import 되었는지 확인
- [ ] 모든 타입 정의에 `'students'`가 추가되었는지 확인
- [ ] 따옴표와 쉼표가 빠지지 않았는지 확인

### 버튼이 보이지 않는 경우

- [ ] 로그인한 사용자의 권한을 확인
- [ ] Firestore `system/config` 문서의 `tabPermissions` 확인
- [ ] 콘솔에서 `canAccessTab('students')` 결과 확인

### 학생 목록이 비어있는 경우

- [ ] Firestore `students` 컬렉션에 데이터가 있는지 확인
- [ ] useStudents 훅의 쿼리 조건 확인 (status != 'withdrawn')
- [ ] 네트워크 탭에서 Firestore 요청 확인

## 수정 전후 비교

### 수정 전
```typescript
// Line 18: 없음

// Line 42:
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | null>(null);

// Line 204:
const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation')[] = [...];

// Line 1270: 상담 관리 버튼 블록 끝

// Line 1804: attendance 뷰 블록 끝
```

### 수정 후
```typescript
// Line 19: 추가됨
import StudentManagementTab from './components/StudentManagement/StudentManagementTab';

// Line 42: 수정됨
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | null>(null);

// Line 204: 수정됨
const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation' | 'students')[] = [...];

// Line 1270+: 학생 관리 버튼 블록 추가됨

// Line 1804+: students 뷰 블록 추가됨
```

---

## 빠른 검증 방법

터미널에서 다음 명령어로 수정이 제대로 되었는지 확인할 수 있습니다:

```bash
# 1. Import가 추가되었는지 확인
grep -n "StudentManagementTab" App.tsx

# 2. students 타입이 추가되었는지 확인
grep -n "'students'" App.tsx

# 3. 학생 관리 버튼이 추가되었는지 확인
grep -n "학생 관리" App.tsx
```

각 명령어에서 결과가 출력되면 수정이 성공한 것입니다.

---

**작성일**: 2026-01-08
**난이도**: ⭐⭐ (초급-중급)
**예상 소요 시간**: 5-10분
