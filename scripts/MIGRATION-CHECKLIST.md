# 강사 → 직원 마이그레이션 체크리스트

## 마이그레이션 실행 전 체크리스트

- [ ] `.env.local` 파일에 Firebase 설정이 올바른가?
- [ ] Firestore 읽기/쓰기 권한이 있는가?
- [ ] `강사목록` 컬렉션에 약 22명의 강사가 있는가?
- [ ] 현재 `staff` 컬렉션 상태 확인 (중복 체크용)

## 1단계: Dry-run으로 미리보기

```bash
npm run migrate:teachers -- --dry-run
```

**확인 사항:**
- [ ] 마이그레이션될 강사 수가 예상과 일치하는가? (약 22명)
- [ ] 스킵되는 강사가 있는가? (중복)
- [ ] 각 강사의 정보가 올바르게 매핑되는가?
  - [ ] 이름
  - [ ] 과목 (subjects)
  - [ ] 원어민 여부 (isNative)
  - [ ] 색상 (bgColor, textColor)
  - [ ] 기본 교실 (defaultRoom)

## 2단계: 실제 마이그레이션 실행

```bash
npm run migrate:teachers
```

**확인 사항:**
- [ ] 백업 파일 생성됨 (`backups/teachers-backup.json`)
- [ ] 마이그레이션 완료 메시지 확인
- [ ] 에러 없이 완료되었는가?

## 3단계: Firebase Console에서 검증

**Firebase Console > Firestore Database > `staff` 컬렉션**

- [ ] 22명의 강사가 모두 추가되었는가?
- [ ] `role` 필드가 모두 `'teacher'`인가?
- [ ] 각 문서의 필드 확인:
  - [ ] `name` (이름)
  - [ ] `role` = 'teacher'
  - [ ] `email` = '' (빈 문자열)
  - [ ] `phone` = '' (빈 문자열)
  - [ ] `hireDate` (오늘 날짜)
  - [ ] `status` = 'active'
  - [ ] `subjects` (배열: ['math', 'english'] 등)
  - [ ] `isHiddenInTimetable` (boolean)
  - [ ] `isNative` (boolean)
  - [ ] `bgColor` (색상 코드)
  - [ ] `textColor` (색상 코드)
  - [ ] `defaultRoom` (강의실)
  - [ ] `timetableOrder` (숫자)
  - [ ] `createdAt` (ISO 날짜)
  - [ ] `updatedAt` (ISO 날짜)

## 4단계: 애플리케이션 테스트

### 4.1 직원 관리 탭
- [ ] 직원 관리 탭에서 강사 목록 확인
- [ ] `role='teacher'` 필터 적용 시 22명 표시
- [ ] 각 강사의 정보 확인 (이름, 과목, 색상 등)

### 4.2 시간표
- [ ] 수학 시간표에서 강사 이름 표시 확인
- [ ] 영어 시간표에서 강사 이름 표시 확인
- [ ] 강사별 색상이 올바르게 표시되는가?
- [ ] 원어민 강사 표시 확인

### 4.3 수업 관리
- [ ] 수업 추가/수정 시 강사 선택 드롭다운 확인
- [ ] 강사 목록이 올바르게 표시되는가?

### 4.4 출석부
- [ ] 강사 필터가 작동하는가?
- [ ] 강사별 색상이 표시되는가?

## 5단계: 롤백 테스트 (선택사항)

**주의: 이 단계는 마이그레이션이 실패했을 경우에만 실행**

```bash
npm run migrate:teachers -- --rollback
```

**확인 사항:**
- [ ] 모든 `role='teacher'` 직원이 삭제되었는가?
- [ ] `강사목록` 컬렉션은 그대로 유지되는가?

## 6단계: 코드 업데이트 (마이그레이션 성공 후)

### Phase 2: 훅 및 API 변경
- [ ] `useStaffTeachers()` 훅 추가
- [ ] `App.tsx`에서 `useTeachers` → `useStaffTeachers` 교체
- [ ] 각 컴포넌트에서 `useTeachers` 호출 업데이트
- [ ] 필드명 변경 반영:
  - [ ] `isHidden` → `isHiddenInTimetable`
  - [ ] `order` → `timetableOrder`

### Phase 3: UI 통합
- [ ] `StaffManager` 컴포넌트에 강사 전용 필드 표시
- [ ] `role='teacher'` 선택 시 추가 필드 표시 (색상, 강의실 등)
- [ ] 강사 관리 탭 제거 또는 리다이렉트

### Phase 4: 레거시 정리 (30일 후)
- [ ] `강사목록` 컬렉션 삭제
- [ ] `useTeachers` 훅 deprecated 처리 또는 삭제
- [ ] `Teacher` 타입 deprecated 처리 (StaffMember로 통합)

## 문제 발생 시 대응

### 마이그레이션 실패
1. 에러 메시지 확인
2. Firebase Console에서 수동 확인
3. 필요시 롤백: `npm run migrate:teachers -- --rollback`
4. 문제 해결 후 재실행

### 중복 데이터
- 이미 `staff` 컬렉션에 존재하는 강사는 자동으로 스킵됨
- 필요시 Firebase Console에서 수동 삭제 후 재실행

### 백업 파일 손실
- `backups/teachers-backup.json` 파일을 안전한 곳에 백업
- 원본 `강사목록` 컬렉션은 자동으로 보존됨 (삭제하지 않음)

## 완료 확인

- [ ] 모든 강사가 `staff` 컬렉션에 마이그레이션됨
- [ ] 애플리케이션의 모든 기능이 정상 작동함
- [ ] 백업 파일이 안전하게 보관됨
- [ ] 문서 업데이트 (마이그레이션 완료 날짜 기록)

## 참고 문서

- [마이그레이션 스크립트 README](./README-migrate-teachers.md)
- [Teacher to Staff 통합 계획서](../reports/teacher-to-staff-migration-plan-2026-01-16.md)
