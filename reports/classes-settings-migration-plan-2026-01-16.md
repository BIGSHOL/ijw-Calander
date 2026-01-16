# 설정 > 수업 관리 → 수업 관리 탭 통합 계획서

**작성일**: 2026-01-16  
**작성자**: AI Assistant  
**상태**: 계획 수립 (사용자 검토 필요)

---

## 1. 현황 분석

### 1.1 두 컴포넌트 비교

| 구분 | Settings/ClassesTab | ClassManagementTab |
|------|---------------------|-------------------|
| **위치** | 설정 > 시간표 > 수업 관리 | 수업 관리 탭 (메인) |
| **파일** | `components/Settings/ClassesTab.tsx` | `components/ClassManagement/ClassManagementTab.tsx` |
| **라인수** | 387줄 | 293줄 |

### 1.2 Settings/ClassesTab.tsx 기능 (이동 대상)

이 컴포넌트는 **"수업 설정"** 성격의 기능을 담당합니다:

#### 1) 스케줄 표기 방식 설정
```typescript
type ScheduleDisplayMode = 'period' | 'time';

interface ScheduleDisplaySettings {
    math: ScheduleDisplayMode;    // 수학: 교시 또는 시간대
    english: ScheduleDisplayMode; // 영어: 교시 또는 시간대
}
```
- **교시 표시**: "월목 4교시"
- **시간대 표시**: "월목 20:10~22:00"
- Firestore: `settings/scheduleDisplay`

#### 2) 수업 키워드 색상 관리
```typescript
interface ClassKeywordColor {
  id: string;
  keyword: string;      // 예: 'Phonics', 'Grammar'
  bgColor: string;      // 배경색
  textColor: string;    // 글자색
  order?: number;
}
```
- Firestore: `classKeywords` 컬렉션
- 기능: 추가, 수정, 삭제

### 1.3 ClassManagementTab.tsx 기능 (현재)

이 컴포넌트는 **"수업 CRUD"** 성격의 기능을 담당합니다:

- 수업 목록 조회 (`useClasses` 훅)
- 수업 필터링 (과목, 강사, 요일)
- 수업 검색
- 수업 정렬 (수업명, 학생수, 강사명)
- 수업 상세 모달 (`ClassDetailModal`)
- 새 수업 추가 모달 (`AddClassModal`)

### 1.4 핵심 차이점

| 기능 | ClassesTab (설정) | ClassManagementTab |
|------|-------------------|-------------------|
| 스케줄 표기 설정 | ✅ | ❌ |
| 키워드 색상 관리 | ✅ | ❌ |
| 수업 목록 조회 | ❌ | ✅ |
| 수업 CRUD | ❌ | ✅ |
| 필터/검색/정렬 | ❌ | ✅ |

> **결론**: 두 컴포넌트는 **기능이 완전히 다름**. "합치기"가 아닌 **"설정 기능 이동"** 개념으로 접근 필요.

---

## 2. 통합 설계

### 2.1 통합 방안 비교

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. 설정 버튼 추가** | ClassManagementTab 헤더에 ⚙️ 버튼 추가, 클릭 시 설정 모달 표시 | UI 깔끔, 기능 분리 유지 | 모달 중첩 가능성 |
| **B. 탭 내 섹션** | ClassManagementTab에 접이식 설정 섹션 추가 | 한 화면에서 모두 관리 | 화면 복잡해질 수 있음 |
| **C. 서브탭** | 수업 관리 탭 내에 [목록 / 설정] 서브탭 | 명확한 기능 분리 | 서브탭 추가 작업 필요 |

### 2.2 권장안: 옵션 A (설정 버튼)

```
┌─────────────────────────────────────────────────────────┐
│ 수업 관리                                    [⚙️ 설정]  │
├─────────────────────────────────────────────────────────┤
│ [전체] [수학] [영어] | [강사▼] | [월화수목금토일] | 검색 │
├─────────────────────────────────────────────────────────┤
│ 수업 목록...                                            │
└─────────────────────────────────────────────────────────┘
                        ↓ 클릭
┌─────────────────────────────────────────────────────────┐
│              수업 설정                           [X]    │
├─────────────────────────────────────────────────────────┤
│ 📅 스케줄 표기 방식                                     │
│   수학: [교시] [시간대]                                 │
│   영어: [교시] [시간대]                                 │
├─────────────────────────────────────────────────────────┤
│ 🎨 수업 키워드 색상                                     │
│   [Phonics] [Grammar] [+추가]                          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 구현 계획

### Phase 1: 설정 모달 컴포넌트 생성 (Day 1)

#### 1.1 새 컴포넌트 생성
- [ ] `ClassManagement/ClassSettingsModal.tsx` 생성
- [ ] `Settings/ClassesTab.tsx`의 로직을 모달 형태로 리팩토링
- [ ] 스케줄 표기 설정 UI 이동
- [ ] 키워드 색상 관리 UI 이동

### Phase 2: ClassManagementTab에 설정 버튼 추가 (Day 1)

#### 2.1 UI 수정
- [ ] 헤더 우측에 ⚙️ 설정 버튼 추가
- [ ] 설정 모달 상태 관리 (`showSettingsModal`)
- [ ] `ClassSettingsModal` 연결

### Phase 3: 설정 모달에서 ClassesTab 제거 (Day 2)

#### 3.1 SettingsModal.tsx 수정
- [ ] "시간표" 섹션에서 "수업 관리" 탭 제거
- [ ] (또는) "수업 관리 탭으로 이동됨" 안내 문구 표시
- [ ] 관련 import 정리

### Phase 4: 정리 및 테스트 (Day 2)

#### 4.1 레거시 정리
- [ ] `Settings/ClassesTab.tsx` deprecated 마킹 또는 삭제
- [ ] 관련 export 정리 (`Settings/index.ts`)

#### 4.2 테스트
- [ ] 스케줄 표기 설정 변경 테스트
- [ ] 키워드 색상 CRUD 테스트
- [ ] 기존 시간표에서 설정 적용 확인

---

## 4. 데이터 영향 분석

### 4.1 영향받는 Firestore 컬렉션

| 컬렉션 | 변경사항 |
|--------|----------|
| `settings/scheduleDisplay` | 변경 없음 (읽기/쓰기 위치만 변경) |
| `classKeywords` | 변경 없음 (읽기/쓰기 위치만 변경) |

### 4.2 영향받는 컴포넌트

| 컴포넌트 | 영향 |
|----------|------|
| `Settings/SettingsModal.tsx` | 탭 제거 또는 리다이렉트 |
| `ClassManagement/ClassManagementTab.tsx` | 설정 버튼 및 모달 추가 |
| `Timetable/*` | 변경 없음 (classKeywords 훅은 동일) |

---

## 5. 예상 일정

| 단계 | 예상 소요 | 시작일 | 완료일 |
|------|-----------|--------|--------|
| Phase 1-2 | 1일 | TBD | TBD |
| Phase 3-4 | 1일 | TBD | TBD |
| **총합** | **2일** | | |

---

## 6. 결론

Settings/ClassesTab의 기능은 **순수한 설정 기능**이므로, ClassManagementTab에 **설정 버튼 + 모달** 형태로 통합하는 것이 가장 깔끔합니다.

핵심 작업:
1. ClassSettingsModal 컴포넌트 생성 (ClassesTab 로직 리팩토링)
2. ClassManagementTab에 설정 버튼 추가
3. SettingsModal에서 수업 관리 탭 제거

**다음 단계**: 사용자 승인 후 Phase 1 구현 시작
