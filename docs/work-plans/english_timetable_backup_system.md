# 영어 시간표 백업 시스템 (English Timetable Backup System)

> 작성일: 2024-12-31
> 최종 수정: 2025-01-01
> 작성자: Antigravity 에이전트
> 버전: 3.0 (UI/UX 개선 업데이트)

---

## 목차

1. [개요 (Overview)](#1-개요-overview)
2. [주요 기능 (Key Features)](#2-주요-기능-key-features)
3. [기술 구현 (Technical Implementation)](#3-기술-구현-technical-implementation)
4. [사용 방법 (Usage Guide)](#4-사용-방법-usage-guide)
5. [권한 및 보안 (Permissions & Security)](#5-권한-및-보안-permissions--security)
6. [데이터 구조 (Data Structure)](#6-데이터-구조-data-structure)
7. [문제 해결 (Troubleshooting)](#7-문제-해결-troubleshooting)

---

## 1. 개요 (Overview)

### 1.1. 배경 및 목적

영어 시간표 백업 시스템은 **시뮬레이션 모드에서 실제 반영(Publish) 시 자동으로 백업을 생성**하여 데이터 손실을 방지하고, 필요 시 **이전 시점으로 복원**할 수 있도록 설계된 안전 장치입니다. **버전 3.0**에서는 백업 이름 지정, 편집/삭제 기능, 그리고 상세 통계 표시 기능이 추가되었습니다.

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

### 1.3. 3.0 버전 주요 변경사항
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
1. 현재 Live 데이터 스냅샷 생성 (시간표 + 학생 데이터)
   ↓
2. 백업 ID 생성 (backup_{timestamp})
   ↓
3. Firestore `english_backups` 컬렉션에 저장 (이름 포함)
   ↓
4. Draft 데이터를 Live에 복사
   ↓
5. 성공 메시지 표시 + 실시간 모드로 전환
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
- **Master 계정 전용** 기능
- 복원 시 현재 상태가 "복원 전 자동백업"으로 안전하게 저장됨
- 전체 시간표 및 학생 데이터가 해당 시점으로 롤백됨

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

#### Q. 이름 수정 버튼이 안 보여요.
**A.** 이름 수정 및 삭제 권한은 **Master** 계정에게만 있습니다. Admin이나 Manager는 조회만 가능합니다.

#### Q. "권한이 부족합니다" 오류가 발생해요.
**A.** Firestore Security Rules가 업데이트되었습니다. 브라우저 새로고침을 하시거나, 로그아웃 후 다시 로그인해보세요. 최근 `강사목록` 및 한글 컬렉션 이름에 대한 규칙이 수정되었습니다.
