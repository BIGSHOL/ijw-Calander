# App.tsx 수정 가이드

## 필요한 수정 사항

### 1. Import 추가 (line 18 뒤)
```typescript
import ConsultationManager from './components/Consultation/ConsultationManager';
import StudentManagementTab from './components/StudentManagement/StudentManagementTab'; // 추가
```

### 2. appMode 타입 수정 (line 42)
```typescript
// 기존
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | null>(null);

// 수정 후
const [appMode, setAppMode] = useState<'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students' | null>(null);
```

### 3. priority 배열 수정 (line 204 근처)
```typescript
// 기존
const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation'];

// 수정 후
const priority: ('calendar' | 'timetable' | 'attendance' | 'payment' | 'gantt' | 'consultation' | 'students')[] = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'];
```

### 4. preferredTab 타입 수정 (line 213 근처)
```typescript
// 기존
setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance');

// 수정 후
setAppMode(preferredTab as 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students');
```

### 5. 네비게이션 버튼 추가 (line 1269 뒤, 상담 관리 버튼 다음)
```typescript
              {/* Consultation */}
              {canAccessTab('consultation') && (
                <button
                  onClick={() => setAppMode('consultation')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${appMode === 'consultation'
                    ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  📝 상담 관리
                </button>
              )}
              {/* Student Management - 추가 */}
              {canAccessTab('students' as AppTab) && (
                <button
                  onClick={() => setAppMode('students')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${appMode === 'students'
                    ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  👥 학생 관리
                </button>
              )}
            </div>
```

### 6. 뷰 렌더링 추가 (line 1804 뒤, attendance 뷰 다음)
```typescript
        ) : appMode === 'attendance' ? (
          /* Attendance Manager View */
          <div className="w-full flex-1 overflow-auto">
            <AttendanceManager userProfile={userProfile} teachers={teachers} />
          </div>
        ) : appMode === 'students' ? (
          /* Student Management View */
          <div className="w-full flex-1 overflow-hidden">
            <StudentManagementTab />
          </div>
        ) : null}
```

## 수동 수정 방법

1. VS Code에서 App.tsx 열기
2. 위의 각 섹션을 찾아서 수정
3. Ctrl+S로 저장

## types.ts 수정도 필요

`types.ts`의 `AppTab` 타입에 'students' 추가:
```typescript
export type AppTab = 'calendar' | 'timetable' | 'payment' | 'gantt' | 'consultation' | 'attendance' | 'students';

export const APP_TABS: { id: AppTab; label: string }[] = [
  { id: 'calendar', label: '연간 일정' },
  { id: 'timetable', label: '시간표' },
  { id: 'attendance', label: '출석부' },
  { id: 'payment', label: '전자 결제' },
  { id: 'gantt', label: '간트 차트' },
  { id: 'consultation', label: '상담 관리' },
  { id: 'students', label: '학생 관리' }, // 추가
];
```

### DEFAULT_TAB_PERMISSIONS에 students 추가:
```typescript
export const DEFAULT_TAB_PERMISSIONS: TabPermissionConfig = {
  master: ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation', 'students'],
  admin: ['calendar', 'timetable', 'attendance', 'payment', 'students'],
  manager: ['calendar', 'attendance', 'students'],
  // ... 나머지는 필요에 따라 추가
};
```
