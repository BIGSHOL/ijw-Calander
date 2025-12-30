# Modal Backdrop Click Implementation

## 1. 개요 (Overview)
사용자 경험(UX) 개선을 위해 팝업(Modal) 창의 닫기 버튼(X)뿐만 아니라, **배경 영역(Backdrop)을 클릭했을 때도 창이 닫히도록** 기능을 구현했습니다. 이는 대다수의 웹 애플리케이션에서 채택하고 있는 표준적인 사용자 인터랙션 방식입니다.

## 2. 구현 방식 (Implementation Pattern)
React의 이벤트 버블링(Event Bubbling) 특성을 활용하여 다음과 같은 패턴으로 구현하였습니다.

### 핵심 로직
1. **Overlay(배경)**: 전체 화면을 덮는 `fixed` 컨테이너에 `onClick={onClose}` 핸들러를 부착하여 클릭 시 닫기 함수를 호출합니다.
2. **Content(내용)**: 실제 팝업 컨텐츠 컨테이너에는 `onClick={(e) => e.stopPropagation()}`을 추가하여, 팝업 내부 클릭 시 이벤트가 배경으로 전파(Bubble)되어 창이 닫히는 것을 방지합니다.

### 코드 예시
```tsx
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    // 1. 배경 영역: 클릭 시 onClose 실행
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose} 
    >
      {/* 2. 컨텐츠 영역: 클릭 이벤트 전파 중단 (창 닫힘 방지) */}
      <div 
        className="bg-white rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()} 
      >
        {children}
      </div>
    </div>
  );
};
```

## 3. 적용된 컴포넌트 목록 (Applied Components)
프로젝트 내 모든 모달 컴포넌트에 대해 일괄 적용을 완료했습니다.

### A. 주요 기능 모달
1. **`EventModal.tsx`** (일정 추가/수정)
   - 변경점: 배경 클릭 시 작성 취소/닫기 가능
2. **`LoginModal.tsx`** (로그인/회원가입)
   - 변경점: 로그인 창 배경 클릭 시 닫기 가능
3. **`BucketModal.tsx`** (버킷리스트)
   - 변경점: 기존 구현 유지 및 확인
4. **`MyEventsModal.tsx`** (내 일정 보기)
   - 변경점: 목록 조회 중 배경 클릭 닫기

### B. 시간표 관리 모달
1. **`StudentModal.tsx`** (학생 명단)
   - 변경점: 학생 관리 중 배경 클릭 닫기
2. **`Timetable/English/MoveSelectionModal.tsx`** (수업 이동)
   - 변경점: 이동 대상 선택 중 배경 클릭 닫기
3. **`Timetable/English/TeacherOrderModal.tsx`** (강사 순서)
   - 변경점: 순서 변경 중 배경 클릭 닫기
4. **`TimetableManager.tsx`** (인라인 모달)
   - 수업 추가 (Add Class) 팝업
   - 수업 상세 (Class Detail) 팝업
   - 보기 설정 (View Settings) 팝업

### C. 설정 및 기타
1. **`SettingsModal.tsx`** (시스템 설정)
   - 메인 설정 패널 및 내부 사용자 상세 팝업 모두 적용
2. **`IntegrationViewSettings.tsx`** (통합 뷰 설정)
   - 기존 구현 확인

## 4. 기대 효과 (Benefits)
- **직관성**: 사용자가 명시적인 '닫기' 버튼을 찾지 않아도 직관적으로 창을 닫을 수 있습니다.
- **효율성**: 마우스 이동 거리를 최소화하여 작업 속도를 높여줍니다.
- **표준 준수**: 일반적인 웹 UX 기대치에 부합하는 동작을 제공합니다.
