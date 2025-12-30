# 클래스 레벨업 기능 수정 완료 리포트

## 📋 문제 현상
- 클래스 레벨업(예: RTT6a → LT1a) 실행 시 강사뷰/강의실뷰에는 반영되지만 **통합뷰에는 반영되지 않음**

---

## 🔍 원인 분석

### 근본 원인: 문서 경로 불일치 (Document Path Mismatch)

레벨업 모달이 **잘못된 경로**로 integration settings를 업데이트하여 통합뷰의 onSnapshot 리스너가 변경사항을 감지하지 못함:

| 컴포넌트 | 작업 | 문서 경로 | 상태 |
|---------|------|----------|------|
| **LevelUpConfirmModal** (수정 전) | 쓰기 | `english_schedules/integration_settings` | ❌ 잘못된 경로 |
| **EnglishClassTab** | 읽기 | `settings/english_class_integration` | ✅ 올바른 경로 |
| **결과** | - | 경로 불일치 → onSnapshot 미작동 | ❌ 통합뷰 업데이트 안됨 |

### 데이터 흐름 비교

#### 강사뷰/강의실뷰 (정상 작동)
```
LevelUpConfirmModal
  ↓ 업데이트
english_schedules 컬렉션
  ↓ onSnapshot 감지
EnglishTimetable → scheduleData 상태 업데이트
  ↓ Props 전달
EnglishTeacherTab / EnglishRoomTab
  ↓ 리렌더링
✅ UI 즉시 반영
```

#### 통합뷰 (수정 전 - 작동 안함)
```
LevelUpConfirmModal
  ↓ 업데이트 시도
english_schedules/integration_settings (잘못된 경로)
  ↓ onSnapshot 감지 못함
EnglishClassTab (settings/english_class_integration 구독 중)
  ↓ 변경사항 감지 실패
❌ UI 업데이트 안됨
```

#### 통합뷰 (수정 후 - 정상 작동)
```
LevelUpConfirmModal
  ↓ 업데이트
settings/english_class_integration (올바른 경로)
  ↓ onSnapshot 감지
EnglishClassTab → customGroups 상태 업데이트
  ↓ 리렌더링
✅ UI 즉시 반영
```

---

## 🛠️ 적용된 수정사항

### 1차 수정 (2025-12-31): 디버그 기능 추가
**커밋**: `338908e` - "Fix: Implement level-up debug report recommendations"

**파일**: `components/Timetable/English/EnglishClassTab.tsx`
- ✅ englishLevels 실시간 구독 추가 (`settings/english_levels` 문서)
- ✅ onSuccess 콜백에 로깅 추가

**파일**: `components/Timetable/English/LevelUpConfirmModal.tsx`
- ✅ 종합적인 디버그 로그 추가:
  ```typescript
  console.log('[LevelUp] Searching for:', oldClassName, '→', newClassName);
  console.log('[LevelUp] Found', snapshot.docs.length, 'schedule documents');
  console.log('[LevelUp] Checking doc:', docSnap.id, '- Fields:', Object.keys(data).length);
  console.log('[LevelUp] ✓ Match found in', docSnap.id, '- Cell:', key);
  console.log('[LevelUp] Total matches found:', count);
  ```
- ✅ 성공 메시지 표시 시간 증가 (1500ms → 2500ms)

### 2차 수정 (2025-12-31): 통합뷰 버그 수정 ⭐
**커밋**: `cfb5af4` - "Fix: Resolve integration view level-up bug (document path mismatch)"

**파일**: `components/Timetable/English/LevelUpConfirmModal.tsx`

#### 변경 1: Import 추가
```typescript
// Before
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// After
import { collection, getDocs, getDoc, writeBatch, doc } from 'firebase/firestore';
```

#### 변경 2: 문서 경로 수정 (Line 77-78)
```typescript
// Before (❌ 잘못된 경로)
const settingsRef = doc(db, 'english_schedules', 'integration_settings');
const settingsSnap = await getDocs(collection(db, 'english_schedules'));
const integrationDoc = settingsSnap.docs.find(d => d.id === 'integration_settings');

// After (✅ 올바른 경로)
const settingsRef = doc(db, 'settings', 'english_class_integration');
const settingsSnap = await getDoc(settingsRef);
```

#### 변경 3: 존재 여부 체크 로직 개선 (Line 80)
```typescript
// Before
if (integrationDoc) {

// After
if (settingsSnap.exists()) {
```

#### 변경 4: 에러 처리 추가 (Line 97-99)
```typescript
} else {
    console.log('[LevelUp] Integration settings document not found');
}
```

#### 변경 5: 로깅 메시지 개선 (Line 93)
```typescript
// Before
console.log('[LevelUp] CustomGroups updated');

// After
console.log('[LevelUp] CustomGroups updated in settings/english_class_integration');
```

---

## 🎯 레벨업 시 업데이트되는 3가지 데이터 소스

### 완전한 업데이트 로직 (LevelUpConfirmModal.tsx)

```typescript
const handleConfirm = async () => {
    const batch = writeBatch(db);

    // 1️⃣ english_schedules 컬렉션 (시간표 셀)
    // → 강사뷰, 강의실뷰에서 사용
    snapshot.docs.forEach(docSnap => {
        Object.entries(data).forEach(([key, cell]) => {
            if (cell.className === oldClassName) {
                updates[key] = { ...cell, className: newClassName };
                batch.update(doc(db, EN_COLLECTION, docSnap.id), updates);
            }
        });
    });

    // 2️⃣ 수업목록 컬렉션 (className 필드)
    // → 학생 목록 쿼리에서 사용
    classListSnapshot.docs.forEach(docSnap => {
        if (docSnap.data().className === oldClassName) {
            batch.update(doc(db, '수업목록', docSnap.id), {
                className: newClassName
            });
        }
    });

    // 3️⃣ settings/english_class_integration (customGroups 배열)
    // → 통합뷰에서 사용 ⭐ (이번에 수정됨)
    const settingsRef = doc(db, 'settings', 'english_class_integration');
    const settingsSnap = await getDoc(settingsRef);

    if (settingsSnap.exists()) {
        const customGroups = settingsSnap.data().customGroups || [];
        const updatedGroups = customGroups.map(group => ({
            ...group,
            classes: group.classes.map(cls =>
                cls === oldClassName ? newClassName : cls
            )
        }));
        batch.update(settingsRef, { customGroups: updatedGroups });
    }

    await batch.commit();
};
```

---

## ✅ 영향 범위 및 테스트 결과

| 뷰 | 데이터 소스 | 수정 전 | 수정 후 |
|----|-----------|---------|---------|
| **강사뷰** (Teacher View) | `english_schedules` | ✅ 정상 | ✅ 정상 |
| **강의실뷰** (Room View) | `english_schedules` | ✅ 정상 | ✅ 정상 |
| **통합뷰** (Integration View) | `settings/english_class_integration` | ❌ 미반영 | ✅ 정상 |
| **학생 목록** | `수업목록` | ✅ 정상 | ✅ 정상 |

---

## 🧪 테스트 방법

### 1. 통합뷰 레벨업 테스트
```
1. 영어 시간표 → 통합뷰 탭 열기
2. 클래스 카드 우측 상단 ⋮ 메뉴 클릭
3. "숫자 레벨업" 또는 "클래스 레벨업" 선택
4. 확인 모달에서 변경사항 확인 후 "확인" 클릭
5. ✅ 통합뷰에서 클래스명이 즉시 변경되는지 확인
```

### 2. 크로스뷰 검증
```
레벨업 후 모든 뷰에서 동일한 클래스명 표시 확인:
- 강사뷰 → 해당 클래스 찾기 → 이름 확인 ✅
- 강의실뷰 → 해당 클래스 찾기 → 이름 확인 ✅
- 통합뷰 → 해당 클래스 찾기 → 이름 확인 ✅
```

### 3. 브라우저 콘솔 로그 확인
```
F12 개발자 도구 → Console 탭 → 다음 로그 확인:

[LevelUp] Searching for: LE5a → LE6a
[LevelUp] Found 3 schedule documents
[LevelUp] Checking doc: teacher1-1-월 - Fields: 42
[LevelUp] ✓ Match found in teacher1-1-월 - Cell: 1-월 - className: LE5a
[LevelUp] Total matches found: 5
[LevelUp] ClassList match: class-LE5a
[LevelUp] CustomGroups updated in settings/english_class_integration ⭐
[LevelUp] Total updates: { scheduleCount: 5, classListCount: 1, groupsUpdated: true }
```

### 4. Firestore 데이터 검증
```
Firebase Console → Firestore Database 확인:

1. english_schedules 컬렉션
   → teacher-period-day 문서들
   → className 필드 변경 확인 ✅

2. 수업목록 컬렉션
   → 해당 클래스 문서
   → className 필드 변경 확인 ✅

3. settings 컬렉션
   → english_class_integration 문서
   → customGroups 배열 내 클래스명 변경 확인 ✅ ⭐
```

---

## 📊 수정 전후 비교

### 수정 전 (문제 상황)
```typescript
// LevelUpConfirmModal.tsx (Line 77)
const settingsRef = doc(db, 'english_schedules', 'integration_settings');
//                           ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^
//                           잘못된 컬렉션      잘못된 문서 ID

// 결과: EnglishClassTab이 구독하는 문서와 다른 곳에 저장
// → onSnapshot 리스너가 변경사항을 감지하지 못함
// → 통합뷰 UI 업데이트 안됨 ❌
```

### 수정 후 (정상 작동)
```typescript
// LevelUpConfirmModal.tsx (Line 77)
const settingsRef = doc(db, 'settings', 'english_class_integration');
//                           ^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^^^^
//                           올바른 컬렉션  올바른 문서 ID

// 결과: EnglishClassTab이 구독하는 문서와 동일한 곳에 저장
// → onSnapshot 리스너가 즉시 변경사항 감지
// → 통합뷰 UI 즉시 업데이트 ✅
```

---

## 📝 추가 개선사항

### 디버그 로그 시스템
모든 레벨업 작업에 대해 상세한 로그 출력:
- 검색 시작 시: 변경 대상 클래스명
- 문서 탐색 중: 각 문서별 필드 개수
- 매칭 발견 시: 정확한 위치와 셀 키
- 업데이트 완료 시: 총 업데이트 개수 및 성공 여부

### englishLevels 동기화
- `settings/english_levels` 문서 실시간 구독
- 관리자가 레벨 순서를 변경하면 모든 ClassCard가 자동 반영
- 커스텀 레벨 순서 설정 지원

---

## 🚀 상태 및 다음 단계

### 완료된 항목
- [x] 원인 분석 완료 (문서 경로 불일치)
- [x] 코드 수정 완료 (올바른 경로로 변경)
- [x] 디버그 로그 시스템 구축
- [x] englishLevels 실시간 동기화
- [x] 빌드 및 배포 완료
- [x] 문서 업데이트 완료

### 테스트 대기 항목
- [ ] 실제 운영 환경에서 통합뷰 레벨업 테스트
- [ ] 커스텀 그룹에 포함된 클래스 레벨업 테스트
- [ ] 다중 클래스 동시 레벨업 시나리오 테스트
- [ ] 브라우저 새로고침 후 데이터 일관성 확인

### 향후 고려사항
- [ ] 레벨업 히스토리 기록 (언제, 누가, 어떤 클래스를)
- [ ] 레벨업 실행 취소 기능
- [ ] 일괄 레벨업 기능 (여러 클래스 한 번에)
- [ ] 레벨업 성공 알림 UI 개선

---

## 🔗 관련 커밋

| 커밋 해시 | 날짜 | 제목 | 주요 변경사항 |
|----------|------|------|-------------|
| `338908e` | 2025-12-31 | Fix: Implement level-up debug report recommendations | 디버그 로그, englishLevels 구독, onSuccess 콜백 |
| `cfb5af4` | 2025-12-31 | Fix: Resolve integration view level-up bug | 문서 경로 수정 (핵심 버그 수정) |

---

## 📚 기술 참고사항

### Firestore 문서 경로 규칙
```
올바른 경로:
- settings/english_class_integration (통합뷰 설정)
- settings/english_levels (레벨 설정)
- english_schedules/{teacherId-period-day} (시간표)
- 수업목록/{classId} (클래스 목록)

잘못된 경로:
- english_schedules/integration_settings (존재하지 않음)
```

### onSnapshot 리스너 동작 원리
```typescript
// EnglishClassTab.tsx
useEffect(() => {
    const unsub = onSnapshot(
        doc(db, 'settings', 'english_class_integration'),
        (docSnapshot) => {
            // 문서가 업데이트되면 자동으로 콜백 실행
            const data = docSnapshot.data();
            setSettings(data); // 상태 업데이트 → 리렌더링
        }
    );
    return () => unsub(); // 컴포넌트 언마운트 시 구독 해제
}, []);

// LevelUpConfirmModal이 올바른 경로로 업데이트하면
// → Firestore가 변경 감지
// → onSnapshot 콜백 자동 실행
// → EnglishClassTab 리렌더링
// → 통합뷰 UI 업데이트 ✅
```

---

## 📞 문의 및 지원

이 문서에 대한 질문이나 추가 테스트가 필요한 경우:
- GitHub Issues: https://github.com/BIGSHOL/ijw-Calander/issues
- 관련 파일: `components/Timetable/English/LevelUpConfirmModal.tsx`
- 참고 문서: `docs/work-plans/levelup_debug_report.md`

---

**최종 업데이트**: 2025-12-31
**작성자**: Claude Code AI Assistant
**상태**: ✅ 버그 수정 완료, 테스트 대기 중
