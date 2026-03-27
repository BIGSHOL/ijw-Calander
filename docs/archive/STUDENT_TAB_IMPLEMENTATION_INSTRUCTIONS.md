# 학생 관리 탭 구현 완료 안내

## 완료된 작업

### 1. 컴포넌트 파일 생성
모든 필요한 컴포넌트가 생성되었습니다:
- ✅ `components/StudentManagement/StudentManagementTab.tsx` (메인 컨테이너)
- ✅ `components/StudentManagement/StudentList.tsx` (학생 목록, 검색/필터)
- ✅ `components/StudentManagement/StudentDetail.tsx` (상세 정보 + 탭)
- ✅ `components/StudentManagement/tabs/BasicInfoTab.tsx` (기본 정보 탭)
- ✅ `components/StudentManagement/tabs/CoursesTab.tsx` (수업 정보 탭)
- ✅ `components/StudentManagement/tabs/ConsultationsTab.tsx` (상담 이력 탭)

### 2. types.ts 수정 완료
- ✅ `AppTab` 타입에 `'students'` 추가
- ✅ `APP_TABS` 배열에 학생 관리 탭 추가
- ✅ `DEFAULT_TAB_PERMISSIONS`에 각 역할별 students 탭 권한 설정

## 남은 작업: App.tsx 수정

App.tsx 파일을 아래와 같이 수정해주세요.

### 1단계: Import 추가 (line 18 뒤)

```typescript
import ConsultationManager from './components/Consultation/ConsultationManager';
import StudentManagementTab from './components/StudentManagement/StudentManagementTab'; // 이 줄 추가
```

### 2단계: appMode 타입 수정 (line 42)

기존:
```typescript
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | null>(null);
```

수정 후:
```typescript
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | null>(null);
```

### 3단계: priority 배열 수정 (line 204 근처)

기존:
```typescript
const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation'];
```

수정 후:
```typescript
const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation' | 'students')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'];
```

### 4단계: preferredTab 타입 수정 (line 213 근처)

기존:
```typescript
setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance');
```

수정 후:
```typescript
setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students');
```

### 5단계: 상담 관리 버튼 뒤에 학생 관리 버튼 추가 (line 1269 이후)

상담 관리 버튼 블록 바로 뒤에 추가:

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

### 6단계: attendance 뷰 뒤에 students 뷰 추가 (line 1804 이후)

attendance 블록 바로 뒤에 추가:

```typescript
        ) : appMode === 'students' ? (
          /* Student Management View */
          <div className="w-full flex-1 overflow-hidden">
            <StudentManagementTab />
          </div>
```

## 확인 방법

1. 터미널에서 실행: `npm run dev`
2. 브라우저에서 접속
3. 로그인 후 상단 네비게이션에 "👥 학생 관리" 버튼이 보이는지 확인
4. 버튼 클릭 시 학생 목록이 표시되는지 확인
5. 학생을 선택하여 상세 정보 탭들이 정상 작동하는지 확인

## 주의 사항

- ⚠️ 권한 설정에 따라 일부 사용자는 학생 관리 탭이 보이지 않을 수 있습니다.
- ⚠️ Firestore의 `system/config` 문서의 `tabPermissions`를 확인하여 권한을 조정할 수 있습니다.

## 구현된 기능

### 학생 목록 (좌측 40%)
- ✅ 이름, 학교, 학년으로 실시간 검색
- ✅ 학년별 필터링
- ✅ 재원 상태별 필터링 (재원/대기/퇴원)
- ✅ 수강 과목별 필터링 (수학/영어)
- ✅ 정렬 (이름순/학년순/등록일순)
- ✅ 선택된 학생 강조 표시

### 학생 상세 정보 (우측 60%)

#### 기본정보 탭
- ✅ 이름, 영어 이름, 학교, 학년, 상태 표시
- ✅ 등록일, 퇴원일 표시
- ✅ 추후 입력 필드 (생년월일, 연락처, 주소) 빈칸 표시
- ✅ 수정/퇴원처리 버튼 (UI만, "구현 예정" 툴팁)

#### 수업 탭
- ✅ 수강 중인 강좌 목록 표시
- ✅ 각 강좌별 과목, 담당 강사, 수업 요일 표시
- ✅ Class ID 표시

#### 상담 탭
- ✅ TaskMemos 컬렉션에서 학생 이름으로 필터링한 상담 이력 표시
- ✅ 읽음/읽지 않음 상태 표시
- ✅ 발신자/수신자, 메시지 내용, 작성일 표시

## 미구현 기능 (Phase 2 이후)

- 학생 정보 수정
- 퇴원 처리
- 출석률 통계
- 성적 관리
- 수납 관리
- 학부모 연락처 관리
- 전용 상담 기록 시스템

## 파일 구조

```
components/StudentManagement/
├── StudentManagementTab.tsx    # 메인 컨테이너 (좌우 분할)
├── StudentList.tsx              # 학생 목록 + 검색/필터
├── StudentDetail.tsx            # 상세 정보 + 탭 네비게이션
└── tabs/
    ├── BasicInfoTab.tsx         # 기본 정보 탭
    ├── CoursesTab.tsx           # 수업 정보 탭
    └── ConsultationsTab.tsx     # 상담 이력 탭
```

## 데이터 소스

- **학생 데이터**: `hooks/useStudents.ts` (Firestore `students` 컬렉션)
- **상담 이력**: Firestore `TaskMemos` 컬렉션 (실시간 리스너)

## 기술 스택

- React + TypeScript
- Tailwind CSS
- Lucide React Icons
- Firebase Firestore (실시간 리스너)
- 기존 useStudents 훅 활용

---

## 문제 발생 시

1. TypeScript 에러가 발생하면 `AppTab` 타입을 확인하세요.
2. 컴포넌트가 보이지 않으면 권한 설정을 확인하세요.
3. 학생 목록이 비어있으면 Firestore `students` 컬렉션에 데이터가 있는지 확인하세요.

**작성일**: 2026-01-08
**작성자**: Claude Sonnet 4.5
