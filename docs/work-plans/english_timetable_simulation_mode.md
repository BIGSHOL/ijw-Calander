# 영어 시간표 시뮬레이션 모드 (Simulation Mode)

## 1. 개요 (Overview)
영어 시간표의 **'시뮬레이션 모드'**는 현재 운영 중인 시간표(Live)에 영향을 주지 않고, **다음 달 시간표를 미리 계획하거나 구조 변경을 실험해 볼 수 있는 안전한 가상 작업 공간**입니다.

사용자는 실시간 모드와 시뮬레이션 모드를 자유롭게 오갈 수 있으며, 시뮬레이션 모드에서 작업한 내용은 **자동으로 별도 저장**됩니다. 작업이 완료되면 버튼 하나로 실제 시간표에 적용(Publish)할 수 있습니다.

---

## 2. 주요 기능 (Key Features)

### 2.1. 모드 전환 방식
- **위치**: 영어 시간표 상단 헤더 우측
- **기능**: [실시간 모드] ↔ [시뮬레이션 모드] 토글 스위치
- **UI 구분**:
    - **실시간 모드**: 회색(기본) 테두리 및 배경
    - **시뮬레이션 모드**: **주황색** 테두리, 배경, 그리고 "SIMULATION" 배너 표시로 명확히 구분

### 2.2. 데이터 제어 기능
시뮬레이션 모드 활성화 및 수정 권한이 있을 때만 아래 기능이 노출됩니다.

1.  **현재 상태 가져오기 (Copy Live to Draft)**
    - 기능: 현재 운영 중인 실시간 시간표 데이터를 그대로 복사하여 시뮬레이션 공간으로 가져옵니다.
    - 권한: `timetable.english.edit` 또는 `master` 권한 필요
    - 주의: 기존 시뮬레이션 작업 내용은 **덮어쓰기(삭제)**됩니다.
    - 확인 프롬프트: "현재 실시간 시간표를 복사해 오시겠습니까?\n기존 시뮬레이션 작업 내용은 모두 사라집니다."
2.  **실제 반영 (Publish Draft to Live)**
    - 기능: 시뮬레이션 공간에서 완성된 시간표를 실제 운영 데이터로 덮어씁니다.
    - 권한: **마스터(Master)** 계정만 가능 (`isMaster = true`)
    - 효과:
      - 반영 즉시 모든 학부모/학생/강사에게 변경된 시간표가 노출됩니다.
      - 자동으로 실시간 모드로 전환됩니다.
    - 확인 프롬프트: "⚠️ 정말로 실제 시간표에 반영하시겠습니까?\n이 작업은 되돌릴 수 없으며, 모든 사용자에게 즉시 반영됩니다."

### 2.4. UI/UX 상세 명세

**시각적 구분 요소**

| 요소 | 실시간 모드 | 시뮬레이션 모드 |
|------|------------|---------------|
| 헤더 배경 | `bg-gray-50` | `bg-orange-50` |
| 헤더 테두리 | `border-gray-200` | `border-orange-200` |
| 배너 | 없음 | "SIMULATION" (주황색, 애니메이션) |
| 토글 버튼 배경 | 흰색/회색 | 주황색 그라데이션 |
| 토글 버튼 텍스트 | "실시간 모드" | "시뮬레이션 모드" |

**버튼 배치 (헤더 우측)**
```
[실시간/시뮬레이션 토글] | [현재 상태 가져오기] [실제 반영(Master만)]
```

**버튼 스타일**
- 현재 상태 가져오기: 흰색 배경, 주황색 테두리 (`bg-white border-orange-300`)
- 실제 반영: 주황색 배경, 흰색 텍스트 (`bg-orange-600 text-white`)
- 호버 효과: 각각 `hover:bg-orange-50`, `hover:bg-orange-700`

**로딩 상태 표시**
- 복사/반영 중: `loading=true` → 전체 화면 로딩 메시지
- 완료 후: `alert()` 메시지 표시 후 loading 해제

### 2.5. 권한 및 접근 제어 (RBAC)

| 기능 | 필요 권한 | 체크 로직 |
|------|----------|----------|
| 시뮬레이션 모드 활성화 | 제한 없음 | 모든 사용자 가능 |
| 현재 상태 가져오기 | `timetable.english.edit` 또는 `master` | `canEditEnglish` |
| 실제 반영 | `master` | `isMaster` |

**구현 코드**:
```typescript
const isMaster = currentUser?.role === 'master';
const canEditEnglish = hasPermission('timetable.english.edit') || isMaster;

// 버튼 렌더링 조건
{isSimulationMode && canEditEnglish && (
    <button onClick={handleCopyLiveToDraft}>현재 상태 가져오기</button>
)}
{isSimulationMode && isMaster && (
    <button onClick={handlePublishDraftToLive}>실제 반영</button>
)}
```

### 2.3. 자동 저장 (Auto-save)
- 별도의 '저장' 버튼 없이, 시뮬레이션 모드에서 행하는 모든 작업(시간표 이동, 수정, 삭제)은 즉시 **임시 저장소(Draft DB)**에 반영됩니다.
- 브라우저를 닫거나 로그아웃 후 다시 돌아와도 작업 내용이 유지됩니다.

---

## 3. 기술적 구현 (Technical Implementation)

### 3.1. 데이터베이스 구조 (Firestore)
기존 데이터와 시뮬레이션 데이터를 컬렉션 단위로 완전히 분리하여 안정성을 확보했습니다.

| 구분 | 컬렉션 ID (Firestore) | 용도 |
| :--- | :--- | :--- |
| **Live** | `english_schedules` | 실제 서비스되는 운영 데이터 |
| **Draft** | `english_schedules_draft` | 시뮬레이션 모드 전용 임시 데이터 |

### 3.2. 컴포넌트 구조 변경

#### `EnglishTimetable.tsx` (컨테이너)

**State 관리**
```typescript
const [isSimulationMode, setIsSimulationMode] = useState(false);
const [scheduleData, setScheduleData] = useState<ScheduleData>({});
const [loading, setLoading] = useState(true);
```

**실시간 데이터 구독 (useEffect)**
```typescript
useEffect(() => {
    const targetCollection = isSimulationMode ? EN_DRAFT_COLLECTION : EN_COLLECTION;

    // Firestore 실시간 구독 시작
    const unsubscribe = onSnapshot(
        collection(db, targetCollection),
        (snapshot) => {
            const mergedData: ScheduleData = {};
            snapshot.docs.forEach((docSnap) => {
                // 데이터 병합 로직 (FLAT 및 NESTED 형식 모두 지원)
                Object.entries(docSnap.data()).forEach(([key, value]) => {
                    mergedData[key] = value as ScheduleCell;
                });
            });
            setScheduleData(mergedData);
            setLoading(false);
        },
        (error) => {
            console.error('데이터 로딩 실패:', error);
            setLoading(false);
        }
    );

    // Cleanup: 컴포넌트 언마운트 또는 모드 변경 시 구독 해제
    return () => unsubscribe();
}, [isSimulationMode]); // ⚠️ 중요: 모드 변경 시 자동 재구독
```

**하위 컴포넌트에 Props 전달**
```typescript
<EnglishTeacherTab
    {...otherProps}
    targetCollection={isSimulationMode ? EN_DRAFT_COLLECTION : EN_COLLECTION}
/>
```

#### `EnglishTeacherTab.tsx` (탭 뷰 - 편집 가능)
- **Props**: `targetCollection?: string` prop 추가 (기본값: `EN_COLLECTION`)
- **Write Logic**:
  - `saveSplitDataToFirebase`: `targetCollection` 사용하여 저장
  - `handleBatchSave`: `targetCollection`로 배치 저장
  - `handleBatchDelete`: `targetCollection`로 삭제
  - **주의**: 모든 쓰기 작업에서 `targetCollection`을 일관되게 사용해야 함

#### `EnglishClassTab.tsx` & `EnglishRoomTab.tsx` (읽기 전용 탭)
- **현재 구현**: `scheduleData`를 props로 받아 표시만 수행
- **targetCollection 불필요**: 부모 컴포넌트에서 이미 올바른 데이터를 구독하므로 자동 반영
- **향후 계획**: 편집 기능 추가 시 `targetCollection` prop 전달 필요

#### `englishUtils.ts` (유틸리티)
- 상수 추가: `EN_DRAFT_COLLECTION = 'english_schedules_draft'`

### 3.3. 데이터 동기화 메커니즘

시뮬레이션 모드는 **Firestore의 실시간 구독(onSnapshot)**을 활용하여 데이터 변경을 자동 반영합니다.

**동작 흐름**:
1. **초기 로드**: `isSimulationMode=false` → `english_schedules` 구독
2. **모드 전환**: 토글 버튼 클릭 → `isSimulationMode=true`
3. **자동 재구독**:
   - useEffect의 cleanup 함수 실행 → 기존 리스너 해제
   - 새 리스너 생성 → `english_schedules_draft` 구독
4. **데이터 변경 감지**: Draft 컬렉션 수정 시 자동으로 UI 업데이트

**장점**:
- 별도의 "새로고침" 버튼 불필요
- 여러 탭/창에서 동시 작업 시 자동 동기화
- 네트워크 상태 변화에 자동 대응

**주의사항**:
- `onSnapshot`은 초기 데이터 + 변경사항 모두 수신
- 대량 데이터 변경 시 여러 번 콜백 호출 가능 (Batch Write 사용 권장)

---

## 4. 사용 흐름 (Workflow)

1.  **시작하기**: [시뮬레이션 모드]를 켭니다. 배경이 주황색으로 변합니다.
2.  **초기화 (선택)**: [현재 상태 가져오기] 버튼을 눌러, 현재 시간표를 복사해옵니다. (다음 달 작업을 시작할 때 유용)
3.  **작업 수행**: 강의 이동, 시간 변경, 강사 배정 등을 자유롭게 수행합니다. 이 내용은 실제 앱에 반영되지 않습니다.
4.  **중단/재개**: 작업을 멈추고 [실시간 모드]로 돌아가거나 로그아웃해도 내역은 시뮬레이션 DB에 안전하게 보관됩니다.
5.  **반영하기**: 작업이 최종 완료되면 [실제 반영] 버튼을 눌러 라이브 서버에 적용합니다.

---

## 5. 에러 처리 및 제약사항

### 5.1. 에러 처리

#### Firebase 작업 실패 시

```typescript
try {
    await batch.commit();
    alert('성공적으로 반영되었습니다.');
} catch (e) {
    console.error(e);
    alert('반영 중 오류가 발생했습니다.');
    setLoading(false); // Loading 상태 복구
}
```

**오류 유형**:
- 네트워크 오류: 인터넷 연결 끊김
- 권한 오류: Firestore 규칙 위반
- 용량 초과: Batch Write 500개 제한 (현재는 해당 없음)

**사용자 피드백**:
- 간단한 `alert` 메시지 표시
- 콘솔 로그로 디버깅 정보 기록

### 5.2. 알려진 이슈 (Known Issues)

#### 🐛 Issue #1: EnglishTeacherTab의 targetCollection 미사용

**현상**:
시뮬레이션 모드에서 일부 편집 작업 시 Draft가 아닌 Live 데이터가 수정될 수 있음

**원인**:
```typescript
// EnglishTeacherTab.tsx 488, 504, 550번째 줄 (수정 필요)
await setDoc(doc(db, EN_COLLECTION, teacherName), ...);
//                  ^^^^^^^^^^^^^ 하드코딩됨!

// 올바른 코드
await setDoc(doc(db, targetCollection, teacherName), ...);
```

**영향**:
- `handleBatchSave` 및 `handleBatchDelete` 함수 사용 시 시뮬레이션 모드 무효화
- 데이터 정합성 위험

**임시 해결**:
시뮬레이션 모드 사용 시 Teacher Tab 편집 기능 주의 필요

**수정 예정**: 즉시 수정 필요 (Critical)

#### ⚠️ Issue #2: Draft 컬렉션 완전 삭제 로직 부재

**현상**:
"현재 상태 가져오기" 시 기존 Draft 문서가 완전히 삭제되지 않고 덮어쓰기만 됨

**예시**:
1. Draft에 "강사A" 데이터 존재
2. Live에는 "강사A" 데이터 없음
3. 복사 후에도 Draft에 "강사A" 남아있음 (예상: 삭제되어야 함)

**임시 해결**:
현재는 큰 문제 없으나, 향후 Draft 전체 초기화 기능 추가 권장

**개선 계획**:
```typescript
// 1. Draft 기존 문서 모두 삭제
const draftSnapshot = await getDocs(collection(db, EN_DRAFT_COLLECTION));
const batch1 = writeBatch(db);
draftSnapshot.docs.forEach(doc => batch1.delete(doc.ref));
await batch1.commit();

// 2. Live 데이터 복사
const liveSnapshot = await getDocs(collection(db, EN_COLLECTION));
const batch2 = writeBatch(db);
liveSnapshot.docs.forEach(docSnap => {
    batch2.set(doc(db, EN_DRAFT_COLLECTION, docSnap.id), docSnap.data());
});
await batch2.commit();
```

### 5.3. 제약사항

| 제약 | 설명 | 우선순위 |
|------|------|---------|
| 동시 편집 불가 | 여러 사용자가 동시에 Draft 편집 시 마지막 저장만 반영 | Low |
| Undo 기능 없음 | "실제 반영" 후 되돌리기 불가 (수동 재편집 필요) | Medium |
| 버전 관리 없음 | 여러 Draft 시안 저장 불가 (1개만 유지) | Low |
| 모바일 미지원 | 1024px 이하 화면에서 UI 깨짐 가능 | Low |

---

## 6. 향후 고려사항 (Future Improvements)
- **변경 이력(Diff) 보기**: 실제 반영 전, Live 데이터와 Draft 데이터의 차이점을 요약해서 보여주는 기능
- **버전 관리**: 여러 개의 시안(Draft A, Draft B)을 저장하고 관리하는 기능
- **Draft 완전 삭제**: "현재 상태 가져오기" 시 기존 Draft 문서 전체 삭제 후 복사
- **비용 최적화**:
  - 수업목록 쿼리 서버 필터링 (WHERE IN 사용)
  - 레벨 설정 중복 구독 제거 (부모에서 한 번만 구독)
  - Firestore 인덱스 최적화
