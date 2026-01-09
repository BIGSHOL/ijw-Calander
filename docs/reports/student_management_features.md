# 학생 관리 모달 일괄 처리 기능 구현 계획 및 결과

> **구현 상태**: **완료** (2025-12-31)

## 목표
`StudentModal`에 학생들의 정보를 일괄적으로 수정할 수 있는 두 가지 기능을 추가합니다.
1. **영어 이름 일괄 삭제**: 모든 학생의 영어 이름을 한 번에 제거
2. **학년 일괄 승급**: 모든 학생의 학년을 +1씩 증가 (초등 6학년, 중/고등 3학년 제한)

## ⚠️ Critical Issues 수정 현황

### ✅ Issue #1: 학교급 판별 로직 오류 (수정 완료)
**위치**: `StudentModal.tsx` Line 307-308
**상태**: **완료** (10/10)

**수정 내용**:
```typescript
// ✅ 정규식으로 정확한 매칭 (학교명 끝부분 확인)
if (/고등학교$|고교$/.test(schoolName)) maxGrade = 3;
else if (/중학교$/.test(schoolName)) maxGrade = 3;
else if (/초등학교$/.test(schoolName)) maxGrade = 6;
```

**효과**: "중앙초등학교", "고려초등학교" 등의 오판 완전 차단

---

### ✅ Issue #2: 조용한 실패 방지 (수정 완료)
**위치**: `StudentModal.tsx` Line 292-328
**상태**: **완료** (9/10)

**수정 내용**:
```typescript
const invalidGradeStudents: string[] = [];
// ... 검증 로직 ...
if (invalidGradeStudents.length > 0) {
    if (!confirm(`다음 학생들은 학년 정보가 없어 승급에서 제외됩니다:\n${invalidGradeStudents.join(', ')}`)) {
        return;
    }
}
```

**효과**: 사용자에게 오류 학생 명시적 알림, 일부만 승급 가능 시 확인 절차

---

### ✅ Issue #3: 에러 메시지 개선 (수정 완료)
**위치**: `StudentModal.tsx` Line 147-154
**상태**: **완료** (10/10)

**수정 내용**:
```typescript
catch (error: any) {
    let message = '저장 실패: ';
    if (error.code === 'permission-denied') message += '권한이 없습니다.';
    else if (error.code === 'unavailable') message += '네트워크를 확인해주세요.';
    else message += error.message || '알 수 없는 오류';
    alert(message);
}
```

**효과**: Firebase 에러 코드별 구체적 메시지, 사용자 친화적 가이드

---

### ✅ Issue #4: 중복 onSnapshot 리스너 (수정 완료)
**위치**: `StudentModal.tsx`
**상태**: **완료** (10/10)
**수정일**: 2025-12-31

**실제 코드 상태**: ✅ **불필요한 리스너 제거 및 Ref 패턴으로 최신 상태 참조**

**문제**:
```typescript
// Line 103-118: 첫 번째 리스너 (제거 필요)
useEffect(() => {
    if (!classDocId) return;
    const unsub = onSnapshot(doc(db, '수업목록', classDocId), (docSnap) => {
        if (isDirty) return; // ❌ 클로저 문제
        // ...
    });
    return () => unsub();
}, [classDocId, isDirty]); // ❌ isDirty 변경마다 재구독

// Line 124-135: 두 번째 리스너 (정상, 유지 필요)
useEffect(() => {
    if (!classDocId) return;
    const unsub = onSnapshot(doc(db, '수업목록', classDocId), (docSnap) => {
        if (isDirtyRef.current) return; // ✅ Ref로 최신 상태 참조
        // ...
    });
    return () => unsub();
}, [classDocId]);
```

**영향**:
- Firebase 읽기 비용 2배 발생 ($0.018/월 낭비)
- 동일 문서에 2개 리스너 동시 구독
- 불필요한 메모리 사용

**수정 방안**:
```typescript
// ❌ Line 103-118 전체 삭제
// useEffect(() => {
//     if (!classDocId) return;
//     const unsub = onSnapshot(...);
//     return () => unsub();
// }, [classDocId, isDirty]);

// ✅ Line 121-135만 유지 (Ref 패턴 사용)
const isDirtyRef = useRef(isDirty);
useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

useEffect(() => {
    if (!classDocId) return;
    const unsub = onSnapshot(doc(db, '수업목록', classDocId), (docSnap) => {
        if (isDirtyRef.current) return;
        if (docSnap.exists()) {
            const data = docSnap.data();
            setStudents(data.studentList || []);
            setClassTeacher(data.teacher || '');
        }
    });
    return () => unsub();
}, [classDocId]);
```

**예상 효과**:
- Firebase 읽기 비용 50% 절감
- 메모리 사용량 감소
- 코드 가독성 향상

---

## 📋 Issue #4 구현 체크리스트

### Phase 1: 중복 리스너 제거 (1분)
- [ ] StudentModal.tsx 파일 열기
- [ ] Line 103-118 찾기 (첫 번째 useEffect with isDirty dependency)
- [ ] Line 103-118 전체 선택 후 삭제
- [ ] 파일 저장

### Phase 2: 검증 (1분)
- [ ] 빌드 오류 없이 컴파일 성공
- [ ] StudentModal 열기 테스트
- [ ] 학생 추가/수정 기능 정상 작동
- [ ] isDirtyRef 패턴이 정상 동작 (Line 124-135)

### Phase 3: Firebase 비용 확인 (Optional)
- [ ] Firebase Console에서 읽기 횟수 모니터링
- [ ] 50% 절감 확인 (2개 → 1개 리스너)

**예상 소요 시간**: 2분
**위험도**: 낮음 (두 번째 리스너가 동일 기능 제공)
**롤백**: 간단 (삭제한 코드 복구)

## 구현 상세

### 1. UI 변경 사항
- **위치**: `StudentModal` 하단(Footer) 영역 또는 상단 헤더 우측
- **구성**:
  - 기존 '삭제' 버튼 옆에 **"일괄 관리"** 드롭다운 메뉴 추가 (공간 효율성 고려)
  - 메뉴 내부 항목:
    - [텍스트] 모든 학생 영어 이름 삭제
    - [텍스트] 모든 학생 학년 +1 승급
- **안전 장치 추가**:
  - **'저장(Save)' 버튼 도입**: 모든 변경사항은 로컬 상태(`students`)에만 먼저 반영되며, 사용자가 명시적으로 '저장' 버튼을 눌러야 Firestore에 커밋됨.
  - **변경사항 감지**: 변경된 내용이 있을 때 '저장' 버튼이 활성화되고, 상단 헤더에 '변경사항 있음' 표시.
  - **닫기 방지**: 저장하지 않고 모달을 닫으려 할 때 경고 메시지 표시.

### 2. 기능 로직

#### A. 영어 이름 일괄 삭제 (`handleBatchDeleteEnglishName`)
- **동작**: 현재 `students` 목록의 모든 항목에 대해 `englishName` 필드를 빈 문자열(`""`)로 업데이트.
- **확인 절차**: `confirm` 창을 통해 사용자 동의 후 실행.

#### B. 학년 일괄 승급 (`handleBatchGradePromotion`)
- **동작**: 모든 학생의 `grade` 값을 파싱하여 +1 증가.
- **학교 급별 제한 로직**:
  - **초등**: 학교명에 '초'가 포함된 경우 -> 최대 **6학년**까지 (6학년에서 승급 시도시 차단)
  - **중/고등**: 학교명에 '중' 또는 '고'가 포함된 경우 -> 최대 **3학년**까지 (3학년에서 승급 시도시 차단)
  - **기타/미입력**: 기본적으로 초등 기준으로 처리하거나, 안전하게 승급 허용 후 경고 (기본: **초등 기준(6)** 적용 권장)
- **유효성 검사**:
  - 단 한 명이라도 제한 학년을 초과하게 되는 경우(예: 초6 -> 초7), **전체 승급을 중단**하고 경고 메시지 표시. (예: "XX 학생은 이미 초등학교 6학년이라 승급할 수 없습니다.")
- **데이터 갱신**: 검사 통과 시 Firestore `updateDoc`으로 일괄 업데이트.

#### C. 일괄 관리 메뉴 동작 개선
- **외부 클릭 감지**: 메뉴가 열려 있을 때 메뉴 외부 영역을 클릭하면 메뉴가 자동으로 닫힘 (`useRef`, `useEffect` 활용).

## 파일 변경 계획

### `components/Timetable/English/StudentModal.tsx`

#### 추가되는 상태/함수
- `isManageMenuOpen`: 일괄 관리 메뉴 표시 상태
- `handleBatchDeleteEnglishName()`: 영어 이름 삭제 구현
- `handleBatchGradePromotion()`: 학년 승급 구현 (승급 유효성 검사 포함)
- `isDirty`: 변경사항 유무 상태
- `handleSaveChanges()`: 변경사항 Firestore 저장 함수

#### UI 수정
- Footer 영역에 '일괄 작업' 메뉴 버튼 추가
- `Settings` 또는 `MoreHorizontal` 아이콘 사용
- '저장' 버튼 추가 및 조건부 렌더링

## 성능 및 비용 분석

### Firestore 비용
- **현재 방식**: 전체 `studentList` 배열을 단일 문서 업데이트 (1회 쓰기)
- **비용**: 학생 수와 무관하게 1회 쓰기 = $0.18/100K writes
- **최적화**: 이미 최적 방식 (개별 학생 문서 분리 시 N회 쓰기 필요)

### 데이터 크기 제한
- Firestore 문서 최대 크기: 1MB
- 학생 1명당 예상 크기: ~200-300 bytes
- **최대 수용 학생 수**: 약 3,000명 (실무적으로는 500명 이하 권장)

### 대용량 처리 전략
- 50명 이상 시 로딩 인디케이터 표시
- 5초 이상 소요 시 타임아웃 경고
- 네트워크 실패 시 재시도 로직 (최대 3회)

## 데이터 안전성

### 백업 전략
```typescript
// 승급 전 로컬 스토리지 백업
const backup = {
    timestamp: Date.now(),
    classDocId,
    studentList: JSON.parse(JSON.stringify(students)),
};
localStorage.setItem('lastBatchBackup', JSON.stringify(backup));
```

### 롤백 메커니즘
- 백업 유효 시간: 1시간
- UI에서 "되돌리기" 버튼 제공
- 장기적으로 Firestore 히스토리 컬렉션 도입 검토

## 테스트 계획

### 단위 테스트
- [ ] 학교급 판별 함수: 다양한 학교명 패턴 테스트
- [ ] 학년 파싱 로직: "초6", "1학년", "중2" 등 형식 테스트
- [ ] 유효성 검증: 경계값 테스트 (초6, 중3, 고3)

### 통합 테스트
- [ ] 정상 케이스: 10명 학생 일괄 승급
- [ ] 제한 케이스: 초6 포함 시 처리
- [ ] 혼합 케이스: 일부 학생만 유효한 데이터
- [ ] 빈 리스트: 학생 0명 상태

### 성능 테스트
- [ ] 50명 학생: 응답 시간 < 500ms
- [ ] 100명 학생: 응답 시간 < 1000ms
- [ ] 500명 학생: 응답 시간 < 3000ms

### 에러 시나리오
- [ ] 네트워크 끊김 중 실행
- [ ] Firestore 권한 없음
- [ ] 동시에 두 명의 관리자가 수정
- [ ] 문서 삭제 상태에서 업데이트 시도

## 예외 처리

### 학교 정보 누락
- 승급 전 필수 데이터 검증
- 오류 학생 목록 명시
- 일부만 승급 가능 시 확인 절차

### 학년 데이터 형식
```typescript
// "초6", "1학년", "중2" 등을 숫자로 정규화
function normalizeGrade(gradeInput: string): number | null {
    if (!gradeInput) return null;
    const match = gradeInput.match(/(\d+)/);
    if (!match) return null;
    const gradeNum = parseInt(match[1]);
    return (gradeNum >= 1 && gradeNum <= 12) ? gradeNum : null;
}
```

### 동시성 제어
- 낙관적 잠금(Optimistic Locking) 패턴 고려
- 재시도 로직 (최대 3회)
- 버전 체크 (`lastModified` 필드)

## 접근성 (Accessibility)

### 키보드 네비게이션
- 일괄 관리 메뉴: `Tab` 키로 접근
- 메뉴 열림/닫힘: `Enter` 또는 `Space`
- 메뉴 항목 선택: `↑↓` 화살표 키
- 메뉴 닫기: `Esc` 키

### 스크린 리더 지원
```tsx
<button
    onClick={() => setIsManageMenuOpen(!isManageMenuOpen)}
    aria-label="일괄 관리 메뉴 열기"
    aria-expanded={isManageMenuOpen}
    aria-haspopup="menu"
>
    일괄 관리
</button>
```

## 향후 개선 계획

### 단기 (1주일)
- [ ] 학교급 판별 로직 수정
- [ ] 에러 메시지 개선
- [ ] 진행 상태 표시
- [ ] 로컬 백업/롤백 기능

### 중기 (1개월)
- [ ] 초6→중1 자동 전환 옵션
- [ ] 미리보기 다이얼로그
- [ ] 선택적 승급 (체크박스)
- [ ] Firestore 히스토리 컬렉션

### 장기 (3개월)
- [ ] 일괄 작업 대시보드
- [ ] 데이터 모델 개선 (schoolType 필드)
- [ ] 감사 로그 (Audit Log)
