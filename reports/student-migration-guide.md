# 학생 데이터 마이그레이션 가이드

## 개요

`data/원생목록.xlsx` 파일의 398명 학생 데이터를 Firebase `students` 컬렉션으로 마이그레이션합니다.

## 주요 특징

### 1. 스마트 병합 (Merge)
- **기존 학생 이름과 일치**: 데이터 보완 (업데이트)
- **새로운 학생**: 추가
- 기존 데이터는 보존하면서 새로운 정보 추가

### 2. 영어 수업 자동 매핑
- 엑셀의 Full Name → 시간표 약어로 자동 변환
- 예: `[EiE] Let's Talk 1` → `LT1`
- 예: `[EiE] 교재 PHONICS&ROOKIES 40,000` → `DP`

**지원 레벨:**
- Dr. Phonics → DP
- Pre Let's → PL
- Ready To Talk → RTT
- Let's Talk → LT
- Ready To Speak → RTS
- Let's Speak → LS
- Let's Express → LE
- Kopi Wang → KW
- Pre Junior → PJ
- Junior Plus → JP
- Middle School English Course → MEC

### 3. 수학 수업은 수동 매핑
- 엑셀의 수학 수업명과 시간표 수업명의 차이가 커서 자동 매핑 제외
- 마이그레이션 후 수동으로 수업 배정 필요

## 데이터 매핑

### UnifiedStudent 필드 매핑

| Excel 컬럼 | UnifiedStudent 필드 | 비고 |
|-----------|-------------------|------|
| 이름 | name | 필수 |
| 성별 | gender | 남→male, 여→female |
| 학교 | school | |
| 학년 | grade | 초3→3학년, 중1→중1 |
| 원생연락처 | studentPhone | |
| 보호자연락처 | parentPhone | |
| 기타보호자연락처 | parentPhone2 | |
| 보호자이름 | parentName | |
| 주소1, 주소2 | address | 통합 |
| 메모 | memo | 기존 메모에 추가 |
| 입학일 | enrollmentDate | YYYYMMDD → YYYY-MM-DD |
| 수업 ([EiE]) | _excelEnglishClasses | 영어 수업 리스트 (약어) |
| 기타항목1 | subjects | M→math, E→english |
| 원생고유번호 | id (없으면) | UUID로 사용 |
| 출결번호 | legacyId | 레거시 ID 보존 |

## 실행 방법

### 1단계: 개발 서버 실행

```bash
npm run dev
```

### 2단계: 브라우저 콘솔에서 데이터 로드

```javascript
// JSON 데이터 로드
const data = await fetch("/student-migration-data.json").then(r => r.json());
console.log(`${data.length}명의 학생 데이터 로드 완료`);
```

### 3단계: DRY RUN (미리보기)

```javascript
// 실제 저장 없이 미리보기
await migrateStudentsFromExcel(data, true);
```

**확인 사항:**
- 신규 학생 수
- 업데이트 학생 수
- 영어 수업 매핑 결과
- 통계 정보

### 4단계: 실제 마이그레이션

```javascript
// 실제 Firebase에 저장
await migrateStudentsFromExcel(data, false);
```

## 마이그레이션 후 작업

### 1. 영어 수업 배정

학생 데이터의 `_excelEnglishClasses` 필드를 확인하여 영어 수업에 자동 배정할 수 있습니다.

```javascript
// 예시: 영어 수업 배정 스크립트
const students = await getDocs(collection(db, 'students'));
students.forEach(async (doc) => {
  const student = doc.data();
  if (student._excelEnglishClasses?.length > 0) {
    console.log(`${student.name}: ${student._excelEnglishClasses.join(', ')}`);
    // TODO: 영어 enrollment 생성
  }
});
```

### 2. 수학 수업 수동 배정

- 학생 관리 탭에서 수동으로 수업 배정
- 또는 별도 스크립트 작성하여 일괄 배정

### 3. 데이터 검증

```javascript
// 연락처 없는 학생 확인
const students = await getDocs(collection(db, 'students'));
const noPhone = [];
students.forEach(doc => {
  const s = doc.data();
  if (!s.studentPhone && !s.parentPhone) {
    noPhone.push(s.name);
  }
});
console.log('연락처 없는 학생:', noPhone);
```

## 통계 (예상)

### 데이터 완성도
- 총 학생 수: 398명
- 학생 연락처: ~79% (316/398)
- 보호자 연락처: 100% (398/398)
- 학교 정보: ~99% (395/398)
- 학년 정보: ~99% (395/398)

### 과목별 분포
- 영어 수강생: ~50%
- 수학 수강생: ~50%
- 수학+영어 동시 수강: ~30%

### 학년별 분포
- 중1: 73명 (18%)
- 초6: 61명 (15%)
- 초5: 51명 (13%)
- 초4: 49명 (12%)
- 중2: 43명 (11%)
- 초3: 40명 (10%)
- 기타: 81명 (21%)

## 주의사항

### 1. 중복 학생 처리
- 동명이인이 있을 경우 주의
- `legacyId` (출결번호)로 구분 가능

### 2. 메모 필드
- 기존 메모에 엑셀 메모를 추가하는 방식
- `[엑셀 마이그레이션]` 구분자로 구분

### 3. 영어 이름
- 엑셀 파일에 영어 이름이 없음
- 기존 데이터의 영어 이름은 유지
- 필요시 수동으로 추가

### 4. 백업
- 마이그레이션 전 Firebase 백업 권장
- DRY RUN으로 충분히 테스트 후 실행

## 트러블슈팅

### 문제: CORS 에러
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
**해결:** 개발 서버(npm run dev)에서 실행

### 문제: migrateStudentsFromExcel is not defined
**해결:**
1. 브라우저에서 개발자 도구 → Sources 탭
2. `migrateStudentsToUnified.ts` 파일이 로드되었는지 확인
3. 또는 스크립트 내용을 직접 콘솔에 붙여넣기

### 문제: 일부 영어 수업이 매핑 안됨
**해결:**
1. `ENGLISH_LEVEL_MAP`에 레벨 추가
2. 또는 수동으로 수업 배정

## 파일 구조

```
scripts/
├── analyze-student-excel.cjs       # 엑셀 구조 분석
├── convert-student-excel-to-json.cjs  # Excel → JSON 변환
└── migrateStudentsToUnified.ts     # 마이그레이션 스크립트

data/
└── 원생목록.xlsx                    # 원본 엑셀 파일

public/
└── student-migration-data.json     # 변환된 JSON 데이터 (623KB)
```

## 관련 문서

- [상담 데이터 마이그레이션](./user-to-staff-migration-detailed-plan.md)
- [직원 관리 통합](./teacher-to-staff-migration-plan-2026-01-16.md)
- [UnifiedStudent 타입 정의](../types.ts)
