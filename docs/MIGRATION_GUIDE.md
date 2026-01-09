# 데이터 구조 마이그레이션 가이드

## 개요

학원 관리 시스템의 데이터 구조를 **수업 중심**에서 **학생 중심**으로 전환하는 마이그레이션이 완료되었습니다.

## 데이터 구조 변경

### 기존 구조 (Old Structure)
```
수업목록/{classId}
├── className: "초등M ±6 정규반2"
├── teacher: "김민주"
├── subject: "수학"
├── studentIds: ["강민준_침산초_4", "강수정_침산초_4", ...]
└── schedule: ["화 2-2", "화 2-1", ...]
```

**문제점:**
- 수업이 삭제되면 학생 이력도 사라짐
- 학생 관점에서 데이터 조회 어려움
- 시간표 → 학생 관리 단방향 흐름

### 새로운 구조 (New Structure)
```
students/{studentId}
├── name: "강민준_침산초_4"
├── createdAt: Timestamp
└── enrollments/{enrollmentId}
    ├── subject: "math"
    ├── className: "초등M ±6 정규반2"
    ├── teacherId: "김민주"
    ├── schedule: ["화 2-2", "화 2-1", ...]
    ├── startDate: "2024-03-01"
    ├── endDate: null
    ├── migratedAt: Timestamp
    ├── migratedFrom: "math_timetable"
    └── originalClassId: "..."
```

**장점:**
- 학생 중심 데이터 관리
- 수업 이력 영구 보존
- 학생 관리 → 시간표 양방향 흐름
- 입학일/퇴원일 기반 출석부 동기화 가능

## 마이그레이션 실행

### 1. UI를 통한 마이그레이션 (권장)

1. **설정 탭** 접속
2. **데이터 마이그레이션** 메뉴 선택 (Master 권한 필요)
3. **"마이그레이션 시작"** 버튼 클릭
4. 로그 확인 후 완료 대기

### 2. 스크립트를 통한 마이그레이션

```bash
# 마이그레이션 실행
npx tsx scripts/migrateToEnrollments.ts

# 검증 (선택사항)
npx tsx scripts/validateMigration.ts
```

### 3. 결과 확인

마이그레이션 완료 후 다음을 확인하세요:
- ✅ 총 enrollments 생성 개수
- ✅ 처리된 학생 수
- ✅ 에러 발생 여부

## 데이터 구조 전환

마이그레이션 후에도 **기존 데이터는 보존**됩니다. 토글로 새 구조를 테스트할 수 있습니다.

### 전환 방법

1. **설정 > 데이터 마이그레이션** 탭
2. **"데이터 구조 전환"** 토글 켜기
3. 페이지 새로고침 (권장 알림 표시됨)
4. 시간표와 학생 관리 정상 작동 확인

### 전환 시 동작

- **토글 ON**: `students/enrollments` 구조에서 데이터 조회
- **토글 OFF**: `수업목록` 컬렉션에서 데이터 조회 (기존 방식)

localStorage의 `useNewDataStructure` 값으로 제어됩니다.

## 영향을 받는 컴포넌트

다음 컴포넌트들이 자동으로 새 구조를 지원합니다:

### 1. 데이터 조회 Hooks
- ✅ `hooks/useClasses.ts` - 클래스 목록 조회
- ✅ `hooks/useEnrollments.ts` - Enrollment 조회 (신규)
- ✅ `components/Timetable/Math/hooks/useTimetableClasses.ts` - 수학 시간표

### 2. UI 컴포넌트
- ✅ 수학 시간표 (Math Timetable)
- ✅ 영어 시간표 (English Timetable)
- ✅ 통합 시간표 (Integration View)
- ✅ 학생 관리 탭 (Student Management)

### 3. 학생 관리 모달
- ⚠️ `MathStudentModal.tsx` - 아직 `수업목록` 직접 수정
- ⚠️ `English/StudentModal.tsx` - 아직 `수업목록` 직접 수정

## 향후 작업 (Phase 2)

학생 관리 모달을 새 구조로 전환해야 합니다:

### 필요한 변경사항

1. **학생 추가/삭제 시 enrollment 생성/삭제**
   - 현재: `수업목록/{classId}` 문서의 `studentList` 배열 수정
   - 변경: `students/{studentId}/enrollments` 서브컬렉션에 문서 추가/삭제

2. **양방향 동기화**
   - 학생 관리 탭에서 수업 등록 → 시간표에 자동 반영
   - 시간표에서 학생 추가 → 학생 관리에 자동 반영

3. **Cloud Functions (옵션)**
   ```javascript
   // enrollment 생성 시 수업목록 자동 업데이트
   exports.onEnrollmentCreated = functions.firestore
     .document('students/{studentId}/enrollments/{enrollmentId}')
     .onCreate((snap, context) => {
       // 수업목록 동기화 로직
     });
   ```

## 롤백 방법

문제 발생 시 즉시 롤백 가능:

1. **설정 탭에서 토글 OFF**
2. 페이지 새로고침
3. 기존 `수업목록` 구조로 자동 복귀

**중요:** 기존 데이터는 절대 삭제되지 않습니다!

## 성능 고려사항

### collectionGroup 쿼리

새 구조는 `collectionGroup(db, 'enrollments')`를 사용합니다.

**복합 인덱스 필요:**
```
컬렉션: enrollments (collectionGroup)
필드:
  - className (Ascending)
  - subject (Ascending)
```

Firebase Console에서 인덱스 생성이 자동으로 요청될 수 있습니다.

### 캐싱 전략

- React Query로 5분 캐싱
- 토글 전환 시 자동 캐시 무효화
- 페이지 새로고침으로 완전한 데이터 리로드

## 테스트 체크리스트

마이그레이션 후 다음을 테스트하세요:

- [ ] 수학 시간표 정상 표시
- [ ] 영어 시간표 정상 표시
- [ ] 통합 시간표 정상 표시
- [ ] 학생 관리 탭에서 학생 목록 조회
- [ ] 학생 관리 탭에서 수업 목록 조회
- [ ] 토글 OFF → 기존 구조로 복귀 확인
- [ ] 토글 ON → 새 구조로 전환 확인

## FAQ

### Q: 마이그레이션 중 데이터가 삭제되나요?
**A:** 아니요. 기존 `수업목록` 데이터는 그대로 유지됩니다. 새로운 `students/enrollments` 구조가 추가로 생성됩니다.

### Q: 마이그레이션 실패 시 어떻게 하나요?
**A:** 토글을 OFF로 두면 기존 구조를 계속 사용할 수 있습니다. 마이그레이션 로그에서 에러를 확인하고 수정 후 재실행하세요.

### Q: 725개 enrollment가 맞나요?
**A:** `수업목록` 컬렉션의 모든 클래스 × 각 클래스의 학생 수 = 총 enrollment 개수입니다. 432명 학생에 대해 725개는 정상 범위입니다.

### Q: 영어 데이터도 마이그레이션되나요?
**A:** 네. `수업목록` 컬렉션에 수학과 영어 수업이 모두 포함되어 있어, 모두 자동으로 마이그레이션됩니다.

### Q: 언제 완전히 새 구조로 전환하나요?
**A:** Phase 2 작업(학생 모달 수정) 완료 후, 충분한 테스트를 거쳐 토글을 제거하고 새 구조만 사용하게 됩니다.

## 관련 파일

- `components/settings/MigrationTab.tsx` - 마이그레이션 UI
- `hooks/useEnrollments.ts` - Enrollment 조회 Hook
- `hooks/useClasses.ts` - 클래스 조회 Hook (듀얼 모드)
- `scripts/migrateToEnrollments.ts` - CLI 마이그레이션 스크립트
- `scripts/validateMigration.ts` - 검증 스크립트

## 문의

마이그레이션 관련 문제는 개발팀에 문의하세요.
