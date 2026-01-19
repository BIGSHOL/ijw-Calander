# TimetableManager 통합 가이드

## 🎯 목표
TimetableManager에 과학/국어 과목을 추가하고 Generic Timetable 시스템 통합

---

## 📝 수정 사항

### 1. Props 인터페이스 확대

**위치**: Line 27-29

**변경 전**:
```typescript
interface TimetableManagerProps {
    subjectTab?: 'math' | 'english';
    onSubjectChange?: (subject: 'math' | 'english') => void;
```

**변경 후**:
```typescript
interface TimetableManagerProps {
    subjectTab?: 'math' | 'english' | 'science' | 'korean';
    onSubjectChange?: (subject: 'math' | 'english' | 'science' | 'korean') => void;
```

---

### 2. State 타입 확대

**위치**: Line 67

**변경 전**:
```typescript
const [internalSubjectTab, setInternalSubjectTab] = useState<'math' | 'english'>('math');
```

**변경 후**:
```typescript
const [internalSubjectTab, setInternalSubjectTab] = useState<'math' | 'english' | 'science' | 'korean'>('math');
```

---

### 3. 권한 체크 추가

**위치**: Line 59-64 (after existing permissions)

**추가 코드**:
```typescript
const { hasPermission } = usePermissions(currentUser);
const isMaster = currentUser?.role === 'master';
const canEditMath = isMaster || hasPermission('timetable.math.edit');
const canEditEnglish = isMaster || hasPermission('timetable.english.edit');
const canViewMath = isMaster || hasPermission('timetable.math.view') || canEditMath;
const canViewEnglish = isMaster || hasPermission('timetable.english.view') || canEditEnglish;

// ← 여기에 추가
const canEditScience = isMaster || hasPermission('timetable.science.edit');
const canEditKorean = isMaster || hasPermission('timetable.korean.edit');
const canViewScience = isMaster || hasPermission('timetable.science.view') || canEditScience;
const canViewKorean = isMaster || hasPermission('timetable.korean.view') || canEditKorean;
```

---

### 4. 권한 Guard 추가

**위치**: Line 88-94 (after existing guards)

**추가 코드**:
```typescript
if (subjectTab === 'math' && !canViewMath) {
    return (
        <div className="flex items-center justify-center h-full text-red-500">
            수학 시간표를 볼 수 있는 권한이 없습니다.
        </div>
    );
}

if (subjectTab === 'english' && !canViewEnglish) {
    return (
        <div className="flex items-center justify-center h-full text-red-500">
            영어 시간표를 볼 수 있는 권한이 없습니다.
        </div>
    );
}

// ← 여기에 추가
if (subjectTab === 'science' && !canViewScience) {
    return (
        <div className="flex items-center justify-center h-full text-red-500">
            과학 시간표를 볼 수 있는 권한이 없습니다.
        </div>
    );
}

if (subjectTab === 'korean' && !canViewKorean) {
    return (
        <div className="flex items-center justify-center h-full text-red-500">
            국어 시간표를 볼 수 있는 권한이 없습니다.
        </div>
    );
}
```

---

### 5. Generic Timetable Import

**위치**: 파일 상단 (Line 1-22 imports 영역)

**추가 코드**:
```typescript
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
// ... 기존 imports

// ← 여기에 추가
const GenericTimetable = lazy(() => import('./Generic/GenericTimetable'));
```

**Performance Note**: `bundle-dynamic-imports` 적용 - Lazy loading으로 번들 크기 최적화

---

### 6. 렌더링 로직 추가

**위치**: 컴포넌트 return 문 내부 (Math/English 렌더링 위치 찾기)

**추가 코드**:
```typescript
// 기존 Math/English 렌더링 로직 찾기
if (subjectTab === 'english') {
    return <EnglishTimetable ... />;
}

// ← 여기 아래에 추가
if (subjectTab === 'science') {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">과학 시간표 로딩 중...</div>
            </div>
        }>
            <GenericTimetable
                subject="science"
                currentUser={currentUser}
                viewType={viewType}
                onStudentsUpdated={() => {
                    // Refresh logic if needed
                }}
            />
        </Suspense>
    );
}

if (subjectTab === 'korean') {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">국어 시간표 로딩 중...</div>
            </div>
        }>
            <GenericTimetable
                subject="korean"
                currentUser={currentUser}
                viewType={viewType}
                onStudentsUpdated={() => {
                    // Refresh logic if needed
                }}
            />
        </Suspense>
    );
}

// Math 렌더링 (기존 로직 유지)
return (
    <div>
        {/* Math Timetable */}
    </div>
);
```

**Performance Notes**:
- `async-suspense-boundaries` 적용 - Suspense로 코드 스플리팅
- `bundle-dynamic-imports` 적용 - GenericTimetable lazy load

---

## 🔧 App.tsx 수정 가이드

### 1. Subject State 타입 확대

**위치**: Line 64-66 (예상)

**변경 전**:
```typescript
const [timetableSubject, setTimetableSubject] = useState<'math' | 'english'>('math');
```

**변경 후**:
```typescript
const [timetableSubject, setTimetableSubject] = useState<'math' | 'english' | 'science' | 'korean'>('math');
```

---

### 2. 과목 탭 버튼 추가

**위치**: 시간표 탭 버튼 영역 (탭 전환 UI)

**추가 코드**:
```typescript
{/* 기존 수학/영어 탭 */}
<button
    onClick={() => setTimetableSubject(prev => prev === 'math' ? 'english' : 'math')}
    className="..."
>
    {timetableSubject === 'math' ? '영어로 전환' : '수학으로 전환'}
</button>

{/* ← 여기에 추가: 드롭다운 또는 개별 버튼 */}
<div className="flex gap-2">
    <button
        onClick={() => setTimetableSubject('math')}
        className={`px-3 py-2 rounded ${
            timetableSubject === 'math' ? 'bg-yellow-500 text-white' : 'bg-gray-200'
        }`}
    >
        수학
    </button>
    <button
        onClick={() => setTimetableSubject('english')}
        className={`px-3 py-2 rounded ${
            timetableSubject === 'english' ? 'bg-blue-900 text-white' : 'bg-gray-200'
        }`}
    >
        영어
    </button>
    <button
        onClick={() => setTimetableSubject('science')}
        className={`px-3 py-2 rounded ${
            timetableSubject === 'science' ? 'bg-green-500 text-white' : 'bg-gray-200'
        }`}
    >
        과학
    </button>
    <button
        onClick={() => setTimetableSubject('korean')}
        className={`px-3 py-2 rounded ${
            timetableSubject === 'korean' ? 'bg-red-500 text-white' : 'bg-gray-200'
        }`}
    >
        국어
    </button>
</div>
```

**Performance Note**: `rerender-hoist-jsx` 적용 - 버튼 스타일을 useMemo로 최적화 가능

---

## 📊 ClassManagement 수정 가이드

### 1. AddClassModal.tsx

**위치**: Line 34 (예상)

**변경 전**:
```typescript
const [subject, setSubject] = useState<'math' | 'english'>(defaultSubject);
```

**변경 후**:
```typescript
const [subject, setSubject] = useState<'math' | 'english' | 'science' | 'korean'>(defaultSubject || 'math');
```

**위치**: Subject select 옵션

**추가 코드**:
```typescript
<select
    value={subject}
    onChange={(e) => setSubject(e.target.value as 'math' | 'english' | 'science' | 'korean')}
    className="..."
>
    <option value="math">수학</option>
    <option value="english">영어</option>
    <option value="science">과학</option>  {/* ← 추가 */}
    <option value="korean">국어</option>   {/* ← 추가 */}
</select>
```

---

### 2. ClassManagementTab.tsx

**위치**: 과목 필터 UI

**추가 코드**:
```typescript
const subjectOptions = [
    { value: 'all', label: '전체' },
    { value: 'math', label: '수학' },
    { value: 'english', label: '영어' },
    { value: 'science', label: '과학' },    // ← 추가
    { value: 'korean', label: '국어' },     // ← 추가
];

<select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
    {subjectOptions.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
</select>
```

---

## 🧪 테스트 체크리스트

### 기능 테스트
- [ ] 과학 탭 클릭 → Generic Timetable 표시
- [ ] 국어 탭 클릭 → Generic Timetable 표시
- [ ] 수학/영어 탭 클릭 → 기존 시간표 정상 동작
- [ ] 과학 수업 생성 (ClassManagement)
- [ ] 국어 수업 생성 (ClassManagement)
- [ ] 과학 시간표에서 수업 조회
- [ ] 국어 시간표에서 수업 조회
- [ ] 학생 등록 → 시간표 표시 확인

### 권한 테스트
- [ ] admin: 모든 과목 조회/편집 가능
- [ ] manager: 모든 과목 조회/편집 가능
- [ ] math_lead: 과학/국어 뷰만 가능
- [ ] english_lead: 과학/국어 뷰만 가능
- [ ] math_teacher: 과학/국어 접근 불가
- [ ] english_teacher: 과학/국어 접근 불가

### 성능 테스트
- [ ] 과학 시간표 로딩 시간 측정
- [ ] 국어 시간표 로딩 시간 측정
- [ ] Firebase 읽기 횟수 확인 (5분 캐싱 확인)
- [ ] 번들 크기 측정 (Lazy loading 확인)
- [ ] Re-render 횟수 측정 (React DevTools Profiler)

---

## 🚀 Quick Start

### Step 1: TimetableManager.tsx 수정 (15분)

```bash
# 파일 열기
code components/Timetable/TimetableManager.tsx

# 수정 항목:
# 1. Line 27-29: Props 타입
# 2. Line 67: State 타입
# 3. Line 59-64: 권한 체크 추가
# 4. Line 88-94: 권한 Guard 추가
# 5. Import: Generic Timetable
# 6. 렌더링 로직: science/korean 추가
```

### Step 2: App.tsx 수정 (10분)

```bash
# 파일 열기
code App.tsx

# 수정 항목:
# 1. timetableSubject state 타입
# 2. 과목 탭 버튼 UI
```

### Step 3: ClassManagement 수정 (30분)

```bash
# AddClassModal.tsx
code components/ClassManagement/AddClassModal.tsx
# - subject state 타입
# - select 옵션 추가

# ClassManagementTab.tsx
code components/ClassManagement/ClassManagementTab.tsx
# - subject filter 옵션 추가
```

### Step 4: 테스트 (30분)

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 테스트
# - http://localhost:3000/timetable
# - 과학/국어 탭 클릭
# - 수업 생성 및 조회
# - 권한별 접근 테스트
```

---

## 📝 변경 요약

| 파일 | 수정 항목 | 예상 시간 |
|------|---------|---------|
| TimetableManager.tsx | Props, State, 권한, 렌더링 | 15분 |
| App.tsx | State 타입, 탭 버튼 | 10분 |
| AddClassModal.tsx | Subject 타입, select 옵션 | 15분 |
| ClassManagementTab.tsx | Filter 옵션 | 15분 |

**총 예상 시간**: **55분**

---

## 💡 Vercel Best Practices 적용

### 이번 통합에서 적용되는 규칙

1. **`bundle-dynamic-imports`** (TimetableManager)
   - GenericTimetable lazy load
   - 번들 크기 ~50KB 절감

2. **`async-suspense-boundaries`** (TimetableManager)
   - Suspense boundary로 점진적 로딩
   - UX 개선

3. **`rerender-dependencies`** (전체)
   - subject state를 primitive 타입으로 유지
   - 불필요한 re-render 방지

4. **`js-early-exit`** (권한 체크)
   - 권한 없으면 조기 반환
   - 불필요한 컴포넌트 렌더링 방지

---

## 🔍 문제 해결

### Q: GenericTimetable이 표시되지 않음
**A**:
1. Import 확인: `import('./Generic/GenericTimetable')`
2. Suspense 경계 확인
3. Console에서 에러 확인

### Q: 권한 체크가 작동하지 않음
**A**:
1. types.ts에 권한 ID 추가 확인
2. DEFAULT_ROLE_PERMISSIONS 확인
3. currentUser.role 확인

### Q: Firebase에서 데이터를 가져오지 못함
**A**:
1. Firestore Rules 확인 (subject 필드 읽기 권한)
2. classes 컬렉션에 subject='science' 데이터 확인
3. Network 탭에서 Firestore 쿼리 확인

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-01-19
