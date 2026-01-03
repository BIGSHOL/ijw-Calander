# 사용자 부서 설정 기능 구현 보고서

**작성일**: 2026년 01월 03일  
**작성자**: AI Assistant  
**관련 Phase**: Phase 6  
**최종 수정**: 2026년 01월 03일 - GanttBuilder 동적 부서 로딩 추가

---

## 📋 개요

간트 차트의 "부서 공개" 기능을 위해 사용자별 부서 지정 시스템을 구현했습니다.

### 구현 배경
- 간트 프로젝트의 `visibility='department'` 옵션 선택 시, 특정 부서에만 공개하는 기능 필요
- 기존에는 부서 목록이 하드코딩(`constants/ganttTheme.ts`)되어 있었음
- 사용자에게 부서를 지정하는 UI가 없었음

---

## ✅ 완료된 작업

### 1. UserProfile 타입 확장
**파일**: `types.ts` (Line 313)

```typescript
// Phase 6: User's own department for Gantt visibility='department' feature
departmentId?: string;  // User's primary department (e.g., 'math', 'english')
```

---

### 2. DepartmentsTab 컴포넌트 생성
**파일**: `components/settings/DepartmentsTab.tsx` (신규)

**기능**:
- 부서 추가/수정/삭제 (CRUD)
- 8가지 프리셋 색상 선택
- 드래그 앤 드롭 순서 변경
- Firestore `gantt_departments` 컬렉션 연동
- React Query 기반 데이터 관리

**인터페이스**:
```typescript
interface GanttDepartment {
    id: string;
    label: string;
    color: string;
    order: number;
    createdAt?: number;
}
```

---

### 3. SettingsModal 통합
**파일**: `components/SettingsModal.tsx`

**변경 내용**:
- `DepartmentsTab` 컴포넌트 import 추가
- `TabMode` 타입에 `'gantt_departments'` 추가
- 시스템 설정 > "🏢 부서 관리" 탭 버튼 추가
- 탭 콘텐츠 렌더링 블록 추가

---

### 4. 사용자 부서 선택 UI
**파일**: `components/SettingsModal.tsx` (renderUserDetail 함수)

**추가 UI**:
- 사용자 상세 모달에 "소속 부서" 드롭다운 추가
- 미지정/수학부/영어부/행정팀/시설관리 선택 가능
- `handleUserUpdate`로 Firestore 저장

---

## 📁 변경된 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `types.ts` | 수정 | `departmentId` 필드 추가 |
| `components/settings/DepartmentsTab.tsx` | 신규 | 부서 관리 컴포넌트 |
| `components/settings/index.ts` | 수정 | export 추가 |
| `components/SettingsModal.tsx` | 수정 | import, 탭, UI 추가 |

---

## 🔧 사용 방법

### 관리자 설정
1. **시스템 관리** 모달 열기
2. **시스템 설정** > **🏢 부서 관리** 탭 클릭
3. 새 부서 이름 입력 및 색상 선택
4. **추가** 버튼 클릭

### 사용자 부서 지정
1. **시스템 설정** > **사용자 관리** 탭 클릭
2. 사용자 클릭하여 상세 모달 열기
3. **소속 부서** 드롭다운에서 부서 선택
4. **변경사항 저장** 클릭

### 간트 차트 부서 공개 사용
1. 간트 프로젝트 생성/수정 화면 열기
2. **공개 범위**에서 **부서 공개** 선택
3. 공개할 부서 선택
4. 저장 시 해당 부서 사용자만 프로젝트 조회 가능

---

## 🔗 연관 Phase

| Phase | 내용 | 상태 |
|-------|------|------|
| Phase 1 | 기반 구조 (types, permissions) | ✅ 완료 |
| Phase 2 | 보안 강화 (Security Rules, Indexes) | ✅ 완료 |
| Phase 3 | UI 개선 (visibility 선택, 멤버 역할) | ✅ 완료 |
| Phase 4 | 부서 연동 | ✅ 완료 |
| Phase 5 | 마이그레이션 스크립트 | ✅ 완료 |
| **Phase 6** | **사용자 부서 설정** | ✅ **완료** |

---

## 📌 참고사항

- 현재 사용자 부서 선택 옵션은 하드코딩되어 있음 (수학부, 영어부, 행정팀, 시설관리)
- 향후 `gantt_departments` Firestore 컬렉션과 연동하면 동적 부서 목록 표시 가능
- GanttBuilder의 부서 선택 UI도 동일하게 동적 로딩 적용 필요
