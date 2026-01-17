# 테이블 행 디자인 통일 완료

**작업일**: 2026-01-17

## 변경 요약

수업 관리 테이블의 디자인을 기준으로 프로젝트 전체의 테이블 행 디자인을 통일했습니다.

---

## 변경된 파일

### [ConsultationTable.tsx](file:///f:/ijw-calander/components/RegistrationConsultation/ConsultationTable.tsx)
- 헤더 배경색: 곤색(#081429) → 연한 회색(`bg-gray-50`)
- 헤더 텍스트: 흰색 → `text-[#373d41]`
- `uppercase tracking-wider` 클래스 제거
- 행 패딩: `py-3` → `py-2.5`

render_diffs(file:///f:/ijw-calander/components/RegistrationConsultation/ConsultationTable.tsx)

---

### [StaffList.tsx](file:///f:/ijw-calander/components/Staff/StaffList.tsx)
- 헤더 `uppercase tracking-wider` 제거
- 헤더 `font-semibold` → `font-medium`
- 헤더 텍스트 색상: `text-gray-600` → `text-[#373d41]`
- 행 패딩: `py-3` → `py-2.5`

render_diffs(file:///f:/ijw-calander/components/Staff/StaffList.tsx)

---

### [GradesManager.tsx](file:///f:/ijw-calander/components/Grades/GradesManager.tsx)
- 시험 목록 헤더/행 패딩: `px-3 py-2` → `px-4 py-2.5`
- 호버 효과: `hover:bg-[#fdb813]/5` → `hover:bg-gray-50`

render_diffs(file:///f:/ijw-calander/components/Grades/GradesManager.tsx)

---

### [StudentList.tsx](file:///f:/ijw-calander/components/StudentManagement/StudentList.tsx)
- 페이지네이션 영역 배경색: 곤색 → 연한 회색(`bg-gray-50`)
- 페이지네이션 텍스트/아이콘: 회색(#gray-300) → `text-[#373d41]`
- 버튼 호버: `hover:bg-white/10` → `hover:bg-gray-100`

render_diffs(file:///f:/ijw-calander/components/StudentManagement/StudentList.tsx)

---

## 통일된 디자인 명세

| 항목 | 값 |
|------|-----|
| 헤더 배경색 | `bg-gray-50` |
| 헤더 텍스트 | `text-xs font-medium text-[#373d41]` |
| 행 패딩 | `px-4 py-2.5` |
| 행 호버 | `hover:bg-gray-50` |
| 구분선 | `divide-y divide-gray-100` |

---

## 검증

브라우저에서 각 탭을 순회하며 테이블 디자인 통일을 확인했습니다.

![검증 녹화](C:/Users/user/.gemini/antigravity/brain/7be3621f-e385-4fdf-8de2-15320c60ec55/browser_recording.webp)
