# 영어 시간표 백업 시스템 (English Timetable Backup System)

> 작성일: 2024-12-31
> 최종 수정: 2026-01-01
> 작성자: Antigravity 에이전트
> 버전: 3.1 (학생 데이터 통합 업데이트)

---

## 목차

1. [개요 (Overview)](#1-개요-overview)
2. [주요 기능 (Key Features)](#2-주요-기능-key-features)
   - 2.1. 자동 백업 생성
   - 2.2. 백업 조회 및 관리
   - 2.3. 백업 복원
   - 2.4. 백업 자동 정리
3. [기술 구현 (Technical Implementation)](#3-기술-구현-technical-implementation)
   - 3.1. 백업 데이터 구조
   - 3.2. 학생 수 통계 계산 로직
   - 3.3. 학생 데이터 통합
4. [권한 및 보안 (Permissions & Security)](#4-권한-및-보안-permissions--security)
5. [문제 해결 (Troubleshooting)](#5-문제-해결-troubleshooting)

---

## 1. 개요 (Overview)

### 1.1. 배경 및 목적

영어 시간표 백업 시스템은 **시뮬레이션 모드에서 실제 반영(Publish) 시 자동으로 백업을 생성**하여 데이터 손실을 방지하고, 필요 시 **이전 시점으로 복원**할 수 있도록 설계된 안전 장치입니다. 백업 시스템은 **시간표 데이터뿐만 아니라 학생 데이터(수업별 학생 목록)도 함께 백업**하여, 완전한 시점 복원을 지원합니다.

**버전 3.0**에서는 백업 이름 지정, 편집/삭제 기능, 그리고 상세 통계 표시 기능이 추가되었으며, **버전 3.1**에서는 학생 데이터 시뮬레이션 모드와 통합되어 학생 데이터도 백업/복원이 가능해졌습니다.

#### 해결하는 문제
- **휴먼 에러 방지**: 잘못된 시간표 반영 시 즉시 복구 가능
- **변경 이력 추적**: 누가, 언제, 어떤 변경을 했는지 기록 (이메일 실명제)
- **데이터 안정성**: 실수로 삭제된 시간표 데이터 복구
- **관리 편의성**: 백업에 이름을 붙여 식별 용이, 불필요한 백업 삭제 가능

### 1.2. 시스템 요구사항

| 구분 | 요구사항 |
|------|----------|
| **Firebase** | Firestore Database (영어 시간표 컬렉션 접근 권한) |
| **권한** | `timetable.english.backup.view` (조회) / `timetable.english.backup.restore` (복원) |
| **역할** | Master/Admin/Manager (조회), Master만 (복원/삭제/이름수정) |

### 1.3. 버전별 주요 변경사항

#### v3.1 (2026-01-01) - 학생 데이터 통합
- **학생 데이터 백업**: 시간표뿐 아니라 학생 데이터(`수업목록`)도 백업
- **학생 데이터 복원**: 백업 복원 시 학생 데이터도 함께 복원
- **Draft 컬렉션 지원**: `수업목록_draft` ↔ `수업목록` 동기화
- **백업 자동 정리**: 최대 50개 유지, 오래된 백업 자동 삭제

#### v3.0 (2025-01-01) - UI/UX 개선
- **백업 이름 지정**: 실제 반영 시 백업 이름 입력 가능
- **백업 관리**: 이름 수정 및 백업 삭제 기능 추가 (Master 전용)
- **직관적 UI**: 이메일 아이디 표시, 학생/수업 수 통계 표시
- **가독성 개선**: 퇴원생 툴팁 추가 및 폰트 크기 통일

---

## 2. 주요 기능 (Key Features)

### 2.1. 자동 백업 생성 (Auto Backup Creation)

#### 트리거 조건
시뮬레이션 모드에서 **"실제 반영"** 버튼 클릭 시 자동 실행됩니다.

#### 동작 흐름
```
[시뮬레이션 모드] → "실제 반영" 클릭
   ↓
사용자에게 백업 이름 입력 받음 (Prompt)
   ↓
1. 현재 Live 데이터 스냅샷 생성
   - 시간표: english_schedules 컬렉션 전체
   - 학생 데이터: 수업목록 컬렉션 전체
   ↓
2. 백업 ID 생성 (backup_{timestamp})
   ↓
3. Firestore `english_backups` 컬렉션에 저장
   - name: 백업 이름 (선택사항)
   - data: 시간표 데이터
   - studentData: 학생 데이터
   - createdAt, createdBy, createdByUid
   ↓
4. Draft → Live 데이터 복사
   4-1. 시간표 복사 (english_schedules_draft → english_schedules)
   4-2. 학생 데이터 복사 (수업목록_draft → 수업목록)
   ↓
5. 백업 자동 정리 (최대 50개 유지)
   - 50개 초과 시 오래된 백업부터 삭제
   - createdAt 기준 오름차순 정렬
   ↓
6. 성공 메시지 표시 + 실시간 모드로 전환
```

### 2.2. 백업 조회 및 관리 (Backup Management UI)

#### 접근 방법
헤더 우측 **"백업 기록"** 버튼 클릭

#### 표시 정보 개선 (v3.0)
| 항목 | 설명 | 예시 |
|------|------|------|
| **백업 이름** | 사용자가 지정한 식별 이름 | 📌 1월 정규 시간표 확정 |
| **작업자** | 이메일 아이디 표기 | st2000423@gmail.com |
| **통계** | 재원생 수 / 수업 수 | 273명 / 44수업 |
| **상태 배지** | 최신, 복원전, 손상됨 등 상태 표시 | 🔵 최신 |

#### 관리 기능 (Master Only)
- **✏️ 이름 수정**: 백업 목록에서 연필 아이콘 클릭하여 이름 변경 가능
- **🗑️ 백업 삭제**: 휴지통 아이콘 클릭하여 불필요한 백업 영구 삭제 가능

### 2.3. 백업 복원 (Restore)

#### 권한
- **Master 계정 전용** 기능
- Admin/Manager는 백업 목록 조회만 가능

#### 복원 로직
```
백업 선택 → [복원] 버튼 클릭
   ↓
1. 현재 Live 데이터를 자동 백업 (안전 장치)
   - ID: pre_restore_{timestamp}
   - 복원 실패 시 롤백 가능
   ↓
2. 시간표 복원
   2-1. 현재 시간표 중 백업에 없는 문서 삭제
   2-2. 백업 시간표 문서 전체 복원 (덮어쓰기)
   ↓
3. 학생 데이터 복원 (studentData 필드 존재 시만)
   3-1. 현재 학생 데이터 중 백업에 없는 문서 삭제
   3-2. 백업 학생 데이터 문서 전체 복원 (덮어쓰기)
   ↓
4. 복원 완료 메시지 표시
   - 시간표: 삭제 X개, 복원 Y개
   - 학생 데이터: 삭제 X개, 복원 Y개
   - 복원 전 백업 ID 표시
```

#### 하위 호환성
- `studentData` 필드가 없는 구 백업도 정상 복원 가능
- 시간표만 복원되며, 학생 데이터는 현재 상태 유지
- 복원 메시지에 "⚠️ 이 백업은 학생 데이터를 포함하지 않습니다" 표시

### 2.4. 백업 자동 정리 (Auto Cleanup)

#### 작동 방식
실제 반영 시마다 자동으로 백업 개수를 체크하고, **최대 50개**를 초과하면 오래된 백업부터 자동 삭제합니다.

#### 정리 기준
- **최대 보관 개수**: 50개
- **삭제 우선순위**: `createdAt` 기준 오래된 순
- **자동 실행**: 실제 반영(Publish) 완료 후

#### 목적
- **Firestore 스토리지 비용 절감**: 불필요한 백업 데이터 제거
- **백업 목록 관리 용이성**: 최근 50개만 유지하여 가독성 향상
- **읽기 성능 최적화**: 백업 목록 조회 속도 개선

#### 예외 사항
- 복원 전 자동백업(`pre_restore_*`)도 정리 대상에 포함됨
- Master는 수동 삭제 기능으로 언제든 백업 삭제 가능
- 정리 작업 실패 시 경고만 표시, 반영 작업은 정상 완료

---

## 3. 기술 구현 (Technical Implementation)

### 3.1. 백업 데이터 구조 (`BackupEntry`)
```typescript
interface BackupEntry {
    id: string;
    createdAt: string;
    createdBy: string;     // 이메일 또는 이름
    createdByUid: string;
    name?: string;         // (New) 백업 이름
    data: Record<string, any>;        // 시간표 데이터
    studentData?: Record<string, any>; // (New) 학생 데이터
    isPreRestoreBackup?: boolean;
    restoringTo?: string;
}
```

### 3.2. 학생 수 통계 계산 로직
단순 문서 개수가 아닌, 실제 유효한 재원생 수를 계산하여 표시합니다.
```typescript
const getStudentCount = (backup: BackupEntry) => {
    if (!backup.studentData) return 0;
    let total = 0;
    Object.values(backup.studentData).forEach((classData: any) => {
        if (classData.studentList && Array.isArray(classData.studentList)) {
            // 퇴원생 및 보류생 제외하고 계산
            total += classData.studentList.filter((s: any) => !s.withdrawalDate && !s.onHold).length;
        }
    });
    return total;
};
```

### 3.3. 학생 데이터 통합 (Student Data Integration)

#### 배경
버전 3.1부터 백업 시스템이 **학생 데이터**를 포함하도록 확장되었습니다. 이는 [student_data_simulation_mode.md](./student_data_simulation_mode.md) 기능과 통합된 결과입니다.

#### 백업 대상 컬렉션
| 데이터 유형 | Live 컬렉션 | Draft 컬렉션 | 설명 |
|------------|-------------|--------------|------|
| 시간표 | `english_schedules` | `english_schedules_draft` | 영어 시간표 스케줄 |
| 학생 데이터 | `수업목록` | `수업목록_draft` | 수업별 학생 목록 |

#### 시뮬레이션 모드와의 연동
시뮬레이션 모드에서는 Draft 컬렉션에서 작업하며, 실제 반영 시:
1. **백업 생성**: Live 컬렉션(`english_schedules`, `수업목록`) 전체를 백업
2. **Draft → Live 복사**: Draft 컬렉션 내용을 Live로 복사
3. **백업 정리**: 50개 초과 시 자동 삭제

#### 통계 계산 방식
백업 목록 UI에서 표시되는 통계:
- **재원생 수**: `studentList` 배열에서 퇴원생(`withdrawalDate`) 및 보류생(`onHold`) 제외
- **수업 수**: `studentData` 객체의 문서(키) 개수
- **예시**: "273명 / 44수업"

#### 하위 호환성
- `studentData` 필드가 없는 구 백업(v3.0 이전)도 정상 작동
- 백업 복원 시:
  - `studentData` 있음: 시간표 + 학생 데이터 모두 복원
  - `studentData` 없음: 시간표만 복원, 학생 데이터 현재 상태 유지
- 복원 완료 메시지에 하위 호환성 상태 표시

#### 관련 문서
- **학생 데이터 시뮬레이션 모드**: [student_data_simulation_mode.md](./student_data_simulation_mode.md)
- **구현 파일**:
  - `EnglishTimetable.tsx` (백업 생성 및 반영)
  - `BackupHistoryModal.tsx` (백업 복원)
  - `StudentModal.tsx` (학생 데이터 편집)

---

## 4. 권한 및 보안 (Permissions)

| 기능 | Master | Admin | Manager |
|------|:------:|:-----:|:-------:|
| 백업 목록 조회 | ✅ | ✅ | ✅ |
| 백업 생성 (반영) | ✅ | ❌ | ❌ |
| 백업 복원 | ✅ | ❌ | ❌ |
| 이름 수정 | ✅ | ❌ | ❌ |
| 백업 삭제 | ✅ | ❌ | ❌ |

---

## 5. 문제 해결 (Troubleshooting)

### 일반 문제

#### Q. 이름 수정 버튼이 안 보여요.
**A.** 이름 수정 및 삭제 권한은 **Master** 계정에게만 있습니다. Admin이나 Manager는 조회만 가능합니다.

#### Q. "권한이 부족합니다" 오류가 발생해요.
**A.** Firestore Security Rules가 업데이트되었습니다. 브라우저 새로고침을 하시거나, 로그아웃 후 다시 로그인해보세요. 최근 `강사목록` 및 한글 컬렉션 이름에 대한 규칙이 수정되었습니다.

### 학생 데이터 관련

#### Q. 백업에 학생 데이터가 포함되어 있나요?
**A.** 네, **v3.1부터** 백업 시 학생 데이터(`수업목록`)도 함께 백업됩니다. 백업 목록에서 "XXX명 / XX수업" 형태로 통계가 표시됩니다.

#### Q. 구 백업(v3.0 이전)을 복원하면 어떻게 되나요?
**A.** 시간표만 복원되며, 학생 데이터는 현재 상태가 유지됩니다. 복원 완료 메시지에 "⚠️ 이 백업은 학생 데이터를 포함하지 않습니다"라고 표시됩니다.

#### Q. 백업이 50개를 초과하면 어떻게 되나요?
**A.** 실제 반영 시 자동으로 오래된 백업부터 삭제됩니다. 최대 50개까지만 유지되며, `createdAt` 기준으로 정렬됩니다.

#### Q. 시뮬레이션 모드에서 추가한 학생이 백업에 포함되나요?
**A.** 아니요. 백업은 **Live 데이터**(`수업목록`)만 저장합니다. Draft 데이터(`수업목록_draft`)는 백업되지 않으며, 실제 반영 시 Live로 복사됩니다.

---

## 6. 참고 문서

- **학생 데이터 시뮬레이션 모드**: [student_data_simulation_mode.md](./student_data_simulation_mode.md)
- **구현 요약**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **검증 보고서**: [VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md)

---

## 7. 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 2026-01-01 | 3.1 | 학생 데이터 통합, 백업 자동 정리 추가 | AI Assistant |
| 2025-01-01 | 3.0 | 백업 이름 지정, 편집/삭제 기능, UI 개선 | Antigravity 에이전트 |
| 2024-12-31 | 1.0 | 초기 백업 시스템 구현 | Antigravity 에이전트 |

---

**문서 끝**
