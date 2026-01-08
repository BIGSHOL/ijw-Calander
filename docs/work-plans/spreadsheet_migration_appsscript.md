# Google Spreadsheet → Firebase 출석부 마이그레이션

> **작성일**: 2026-01-08
> **상태**: ✅ 완성 (2단계 방식)
> **방식**: Google Apps Script

---

## 🔄 마이그레이션 흐름 (2단계)

```
Step 1: [출석 시트들] → [📋 마이그레이션 점검 시트] 생성
              ↓
        (수동 검토 및 수정)
              ↓
Step 2: [📋 점검 시트] → [🔥 Firebase] 전송
```

---

## 🚀 사용 방법

### Step 1: 마이그레이션 점검 시트 생성
1. Apps Script에서 `generateMigrationSheet` 실행
2. **"📋 마이그레이션 점검"** 시트가 자동 생성됨
3. 데이터 검토 및 수정

### Step 2: Firebase 전송
1. 점검 시트에서 데이터 확인
2. `pushToFirebase` 실행
3. ✅ 표시된 항목만 Firebase로 전송

---

## 📋 Apps Script 코드 (2단계 방식)

```javascript
// ============================================
// 🔧 설정 - 반드시 수정하세요!
// ============================================
const CONFIG = {
  // Firebase 설정 (Step 2에서 필요)
  FIREBASE_PROJECT_ID: 'ijw-calander',
  FIREBASE_API_KEY: 'YOUR_API_KEY_HERE',
  
  // 선생님 정보
  TEACHER_ID: 'TEACHER_DOC_ID',
  TEACHER_NAME: '선생님이름',
  SUBJECT: 'math',  // 'math' 또는 'english'
  
  // 점검 시트 이름
  MIGRATION_SHEET_NAME: '📋 마이그레이션 점검',
};

// 컬럼 인덱스 (0부터 시작)
const COL = {
  IS_HOMEROOM: 0,
  NAME: 1,
  CLASS_DAYS: 2,
  SCHOOL: 3,
  GRADE: 4,
  CLASS_TYPE: 5,
  DATE_START: 17,  // R열 = 인덱스 17 (A=0, B=1, ... R=17)
};

// ============================================
// 📋 STEP 1: 마이그레이션 점검 시트 생성
// ============================================
function generateMigrationSheet() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 시트 선택
  const response = ui.prompt(
    '📋 마이그레이션 시트 생성',
    '분석할 시트를 입력하세요:\n• 예: 25.12\n• 여러 개: 25.12, 25.11\n• 전체: ALL',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const input = response.getResponseText().trim();
  const sheetNames = input.toUpperCase() === 'ALL' 
    ? getAllMonthSheets() 
    : input.split(',').map(s => s.trim());
  
  Logger.log('='.repeat(50));
  Logger.log('📋 마이그레이션 점검 시트 생성 시작');
  Logger.log('='.repeat(50));
  
  // 기존 점검 시트 삭제 후 재생성
  let migrationSheet = ss.getSheetByName(CONFIG.MIGRATION_SHEET_NAME);
  if (migrationSheet) {
    ss.deleteSheet(migrationSheet);
  }
  migrationSheet = ss.insertSheet(CONFIG.MIGRATION_SHEET_NAME);
  
  // 헤더 생성
  const headers = [
    '상태', '전송', '시트', '학생명', '영어이름', '학교', '학년', 
    '담임', '요일', '수업구분', '출석일수', '총시간', 
    'Firebase매칭', '매칭ID', '문제점', '원본행'
  ];
  migrationSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  migrationSheet.getRange(1, 1, 1, headers.length)
    .setBackground('#081429')
    .setFontColor('white')
    .setFontWeight('bold');
  
  // Firebase 학생 목록 가져오기 (Optional - 오프라인에서도 동작)
  let existingStudents = [];
  try {
    existingStudents = fetchAllStudents();
    Logger.log('✅ Firebase에서 ' + existingStudents.length + '명 로드');
  } catch (e) {
    Logger.log('⚠️ Firebase 연결 실패 - 오프라인 모드');
  }
  
  // 각 시트 분석
  const allRows = [];
  
  for (const sheetName of sheetNames) {
    Logger.log('\n📊 분석 중: ' + sheetName);
    const rows = analyzeSheet(sheetName, existingStudents);
    allRows.push(...rows);
  }
  
  // 점검 시트에 데이터 쓰기
  if (allRows.length > 0) {
    migrationSheet.getRange(2, 1, allRows.length, headers.length).setValues(allRows);
    
    // 상태별 색상 적용
    for (let i = 0; i < allRows.length; i++) {
      const status = allRows[i][0];
      const range = migrationSheet.getRange(i + 2, 1, 1, headers.length);
      
      if (status === '✅') {
        range.setBackground('#e6ffe6');
      } else if (status === '⚠️') {
        range.setBackground('#fff3cd');
      } else if (status === '🆕') {
        range.setBackground('#cce5ff');
      } else if (status === '❌') {
        range.setBackground('#f8d7da');
      }
    }
    
    // 전송 컬럼에 체크박스 추가
    migrationSheet.getRange(2, 2, allRows.length, 1).insertCheckboxes();
    
    // 기본값: ✅, 🆕는 체크, ⚠️, ❌는 미체크
    for (let i = 0; i < allRows.length; i++) {
      const status = allRows[i][0];
      if (status === '✅' || status === '🆕') {
        migrationSheet.getRange(i + 2, 2).setValue(true);
      }
    }
  }
  
  // 컬럼 너비 조정
  migrationSheet.autoResizeColumns(1, headers.length);
  migrationSheet.setFrozenRows(1);
  migrationSheet.setFrozenColumns(4);
  
  // 결과 보고
  const stats = {
    total: allRows.length,
    ready: allRows.filter(r => r[0] === '✅').length,
    newStudent: allRows.filter(r => r[0] === '🆕').length,
    warning: allRows.filter(r => r[0] === '⚠️').length,
    error: allRows.filter(r => r[0] === '❌').length,
  };
  
  const report = 
    '📊 분석 완료!\n\n' +
    '✅ 전송 준비: ' + stats.ready + '명\n' +
    '🆕 신규 생성: ' + stats.newStudent + '명\n' +
    '⚠️ 확인 필요: ' + stats.warning + '명\n' +
    '❌ 오류: ' + stats.error + '명\n\n' +
    '"📋 마이그레이션 점검" 시트를 확인하세요.';
  
  ui.alert('마이그레이션 분석 완료', report, ui.ButtonSet.OK);
  
  // 점검 시트로 이동
  ss.setActiveSheet(migrationSheet);
}

// ============================================
// 📊 시트 분석
// ============================================
function analyzeSheet(sheetName, existingStudents) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log('⚠️ 시트 없음: ' + sheetName);
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // 연월 파싱
  const parts = sheetName.split('.');
  if (parts.length !== 2) return [];
  
  const yearMonth = '20' + parts[0] + '-' + parts[1].padStart(2, '0');
  
  // 날짜 컬럼 찾기 (Date 객체 및 문자열 모두 처리)
  const dateColumns = [];
  for (let i = COL.DATE_START; i < headers.length; i++) {
    const header = headers[i];
    let day = null;
    
    // Case 1: header가 Date 객체인 경우
    if (header instanceof Date) {
      day = String(header.getDate()).padStart(2, '0');
    }
    // Case 2: header가 문자열인 경우 (예: "12/01")
    else if (typeof header === 'string' || typeof header === 'number') {
      const match = String(header).match(/(\d+)\/(\d+)/);
      if (match) {
        day = match[2].padStart(2, '0');
      }
    }
    
    if (day) {
      dateColumns.push({ index: i, day: day });
    }
  }
  
  Logger.log('  날짜 컬럼 ' + dateColumns.length + '개 발견');
  
  const rows = [];
  
  for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
    const rowData = data[rowIdx];
    const name = String(rowData[COL.NAME] || '').trim();
    
    if (!name) continue;
    
    // 학생 정보
    const info = {
      name: name,
      englishName: '', // 스프레드시트에 영어이름 컬럼이 있다면 추가
      school: String(rowData[COL.SCHOOL] || '').trim(),
      grade: String(rowData[COL.GRADE] || '').trim(),
      isHomeroom: rowData[COL.IS_HOMEROOM] === true,
      classDays: String(rowData[COL.CLASS_DAYS] || '').trim(),
      classType: String(rowData[COL.CLASS_TYPE] || '').trim(),
    };
    
    // 출석 데이터 집계
    let attendanceDays = 0;
    let totalHours = 0;
    
    for (const col of dateColumns) {
      const value = rowData[col.index];
      if (value !== '' && !isNaN(value)) {
        attendanceDays++;
        totalHours += Number(value);
      }
    }
    
    // Firebase 매칭 확인
    let status = '✅';
    let matchType = '';
    let matchId = '';
    let problem = '';
    
    if (existingStudents.length > 0) {
      const matches = existingStudents.filter(s => s.name === name);
      
      if (matches.length === 1) {
        matchType = '기존 매칭';
        matchId = matches[0].id;
      } else if (matches.length > 1) {
        // 학교로 구분 시도
        const schoolShort = info.school.replace(/고등학교|중학교|초등학교/g, '');
        const bySchool = matches.find(s => s.school && s.school.includes(schoolShort));
        
        if (bySchool) {
          matchType = '학교로 매칭';
          matchId = bySchool.id;
        } else {
          status = '⚠️';
          matchType = '동명이인 ' + matches.length + '명';
          matchId = matches.map(m => m.id).join(', ');
          problem = '수동 선택 필요';
        }
      } else {
        status = '🆕';
        matchType = '신규 생성 예정';
        matchId = '-';
      }
    } else {
      status = '⚠️';
      matchType = 'Firebase 미연결';
      problem = 'Firebase 연결 후 재분석';
    }
    
    // 유효성 검사
    if (!info.school) {
      status = '⚠️';
      problem = (problem ? problem + ', ' : '') + '학교 정보 없음';
    }
    
    if (attendanceDays === 0) {
      status = '⚠️';
      problem = (problem ? problem + ', ' : '') + '출석 데이터 없음';
    }
    
    rows.push([
      status,
      false, // 전송 체크박스
      sheetName,
      info.name,
      info.englishName,
      info.school,
      info.grade,
      info.isHomeroom ? '담임' : '부담임',
      info.classDays,
      info.classType,
      attendanceDays,
      totalHours + 'T',
      matchType,
      matchId,
      problem,
      rowIdx + 1, // 원본 행 번호
    ]);
  }
  
  Logger.log('  → ' + rows.length + '명 분석됨');
  return rows;
}

// ============================================
// 🔥 STEP 2: Firebase 전송
// ============================================
function pushToFirebase() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const migrationSheet = ss.getSheetByName(CONFIG.MIGRATION_SHEET_NAME);
  
  if (!migrationSheet) {
    ui.alert('오류', '"📋 마이그레이션 점검" 시트가 없습니다.\n먼저 generateMigrationSheet를 실행하세요.', ui.ButtonSet.OK);
    return;
  }
  
  // 확인 대화상자
  const confirm = ui.alert(
    '🔥 Firebase 전송',
    '체크된 항목을 Firebase로 전송합니다.\n계속하시겠습니까?',
    ui.ButtonSet.YES_NO
  );
  
  if (confirm !== ui.Button.YES) return;
  
  const data = migrationSheet.getDataRange().getValues();
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  // 기존 학생 목록 로드
  const existingStudents = fetchAllStudents();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const shouldSend = row[1]; // 전송 체크박스
    
    if (!shouldSend) continue;
    
    const sheetName = row[2];
    const name = row[3];
    const matchId = row[13];
    const originalRow = row[15];
    
    Logger.log('처리 중: ' + name + ' (' + sheetName + ')');
    
    try {
      // 출석 데이터 가져오기
      const sourceSheet = ss.getSheetByName(sheetName);
      const sourceData = sourceSheet.getDataRange().getValues();
      const rowData = sourceData[originalRow - 1];
      const headers = sourceData[0];
      
      // 연월 파싱
      const parts = sheetName.split('.');
      const yearMonth = '20' + parts[0] + '-' + parts[1].padStart(2, '0');
      
      // 출석 데이터 수집
      const attendance = {};
      for (let j = COL.DATE_START; j < headers.length; j++) {
        const header = String(headers[j]);
        const match = header.match(/(\d+)\/(\d+)/);
        if (match) {
          const value = rowData[j];
          if (value !== '' && !isNaN(value)) {
            const dateKey = yearMonth + '-' + match[2].padStart(2, '0');
            attendance[dateKey] = Number(value);
          }
        }
      }
      
      // 학생 ID 결정
      let studentId = matchId;
      
      if (!studentId || studentId === '-' || studentId.includes(',')) {
        // 신규 생성 또는 매칭 실패 - 학생 생성
        const studentInfo = {
          name: name,
          school: row[5],
          grade: row[6],
          isHomeroom: row[7] === '담임',
          classDays: row[8],
          classType: row[9],
        };
        
        studentId = createStudent(studentInfo);
        
        if (!studentId) {
          throw new Error('학생 생성 실패');
        }
        
        Logger.log('  🆕 신규 학생 생성: ' + studentId);
      }
      
      // 출석 데이터 저장
      const result = updateStudentAttendance(studentId, yearMonth, attendance);
      
      if (result) {
        success++;
        // 점검 시트 상태 업데이트
        migrationSheet.getRange(i + 1, 1).setValue('✅완료');
        migrationSheet.getRange(i + 1, 14).setValue(studentId);
        Logger.log('  ✅ 저장 완료');
      } else {
        throw new Error('출석 저장 실패');
      }
      
    } catch (e) {
      failed++;
      errors.push(name + ': ' + e.message);
      migrationSheet.getRange(i + 1, 1).setValue('❌실패');
      migrationSheet.getRange(i + 1, 15).setValue(e.message);
      Logger.log('  ❌ 오류: ' + e.message);
    }
  }
  
  // 결과 보고
  const report = 
    '🔥 Firebase 전송 완료!\n\n' +
    '✅ 성공: ' + success + '건\n' +
    '❌ 실패: ' + failed + '건\n' +
    (errors.length > 0 ? '\n오류:\n' + errors.slice(0, 5).join('\n') : '');
  
  ui.alert('전송 완료', report, ui.ButtonSet.OK);
}

// ============================================
// 🔥 Firebase API
// ============================================
function getFirebaseUrl(path) {
  return 'https://firestore.googleapis.com/v1/projects/' + 
         CONFIG.FIREBASE_PROJECT_ID + 
         '/databases/(default)/documents/' + 
         path + '?key=' + CONFIG.FIREBASE_API_KEY;
}

function fetchAllStudents() {
  const url = getFirebaseUrl('students');
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());
  
  if (!json.documents) return [];
  
  return json.documents.map(function(doc) {
    const fields = doc.fields || {};
    return {
      id: doc.name.split('/').pop(),
      name: fields.name ? fields.name.stringValue : '',
      school: fields.school ? fields.school.stringValue : '',
    };
  });
}

function createStudent(info) {
  const url = getFirebaseUrl('students');
  const now = new Date().toISOString();
  
  const payload = {
    fields: {
      name: { stringValue: info.name },
      school: { stringValue: info.school || '' },
      grade: { stringValue: info.grade || '' },
      status: { stringValue: 'active' },
      createdAt: { stringValue: now },
      updatedAt: { stringValue: now },
      enrollments: {
        arrayValue: {
          values: [{
            mapValue: {
              fields: {
                teacherId: { stringValue: CONFIG.TEACHER_ID },
                teacherName: { stringValue: CONFIG.TEACHER_NAME },
                subject: { stringValue: CONFIG.SUBJECT },
                isHomeroom: { booleanValue: info.isHomeroom || false },
                classDays: { stringValue: info.classDays || '' },
                classType: { stringValue: info.classType || '' },
                startDate: { stringValue: now },
              }
            }
          }]
        }
      }
    }
  };
  
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  if (response.getResponseCode() === 200) {
    const result = JSON.parse(response.getContentText());
    return result.name.split('/').pop();
  }
  
  return null;
}

function updateStudentAttendance(studentId, yearMonth, attendance) {
  const attendanceFields = {};
  for (var dateKey in attendance) {
    attendanceFields[dateKey] = { doubleValue: attendance[dateKey] };
  }
  
  const url = 'https://firestore.googleapis.com/v1/projects/' + 
              CONFIG.FIREBASE_PROJECT_ID + 
              '/databases/(default)/documents/students/' + 
              studentId + '?updateMask.fieldPaths=attendance.' + yearMonth +
              '&key=' + CONFIG.FIREBASE_API_KEY;
  
  const payload = {
    fields: {
      attendance: {
        mapValue: {
          fields: {}
        }
      }
    }
  };
  
  payload.fields.attendance.mapValue.fields[yearMonth] = {
    mapValue: {
      fields: attendanceFields
    }
  };
  
  const response = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  return response.getResponseCode() === 200;
}

// ============================================
// 🛠️ 유틸리티
// ============================================
function getAllMonthSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()
    .map(function(s) { return s.getName(); })
    .filter(function(name) { return /^\d{2}\.\d{2}$/.test(name); })
    .sort()
    .reverse();
}

// ============================================
// 🧪 테스트
// ============================================
function testConnection() {
  Logger.log('🔌 Firebase 연결 테스트...');
  
  try {
    const students = fetchAllStudents();
    Logger.log('✅ 연결 성공! ' + students.length + '명의 학생 발견');
    
    students.slice(0, 5).forEach(function(s) {
      Logger.log('  • ' + s.name + ' (' + (s.school || '-') + ')');
    });
  } catch (e) {
    Logger.log('❌ 연결 실패: ' + e.message);
  }
}
```

---

## ✅ 실행 순서

### 1단계: 점검 시트 생성
```
함수: generateMigrationSheet
결과: "📋 마이그레이션 점검" 시트 생성
```

### 2단계: 데이터 검토
```
- ✅ 전송 준비 완료
- 🆕 신규 학생 (생성 예정)
- ⚠️ 확인 필요 (동명이인 등)
- ❌ 오류 (데이터 없음 등)
```

### 3단계: Firebase 전송
```
함수: pushToFirebase
결과: 체크된 항목만 Firebase로 전송
```

---

## 📊 점검 시트 컬럼 설명

| 컬럼 | 설명 |
|------|------|
| 상태 | ✅🆕⚠️❌ 상태 표시 |
| 전송 | ☑️ 체크된 항목만 Firebase 전송 |
| 시트 | 원본 시트 이름 (25.12 등) |
| 학생명 | 학생 이름 |
| Firebase매칭 | 기존 매칭/신규 생성/동명이인 등 |
| 매칭ID | Firebase 문서 ID |
| 문제점 | 확인 필요한 사항 |
| 원본행 | 원본 시트의 행 번호 |

---

## 🚀 사용 방법

### Step 1: Apps Script 열기
1. 스프레드시트 열기
2. **확장 프로그램 → Apps Script** 클릭

### Step 2: 코드 붙여넣기
아래 코드를 전체 복사하여 붙여넣기

### Step 3: 설정값 수정
```javascript
const CONFIG = {
  FIREBASE_PROJECT_ID: 'your-project-id',  // ← 수정 필요
  FIREBASE_API_KEY: 'your-api-key',        // ← 수정 필요
  TEACHER_ID: 'teacher-id',                // ← 수정 필요
  TEACHER_NAME: '선생님이름',               // ← 수정 필요
  SUBJECT: 'math',                         // 'math' 또는 'english'
};
```

### Step 4: 실행
1. 함수 선택: `migrateAttendanceData`
2. **실행** 클릭
3. 시트 이름 입력 (예: `25.12` 또는 `ALL`)

---

## 📋 완성된 Apps Script 코드

```javascript
// ============================================
// 🔧 설정 - 반드시 수정하세요!
// ============================================
const CONFIG = {
  // Firebase 설정
  FIREBASE_PROJECT_ID: 'ijw-calander',     // Firebase 프로젝트 ID
  FIREBASE_API_KEY: 'YOUR_API_KEY_HERE',   // Firebase Web API Key
  
  // 선생님 정보 (이 스프레드시트의 담당 선생님)
  TEACHER_ID: 'TEACHER_DOC_ID',            // Firebase teachers 컬렉션의 문서 ID
  TEACHER_NAME: '선생님이름',
  
  // 과목 ('math' 또는 'english')
  SUBJECT: 'math',
};

// 컬럼 인덱스 (0부터 시작, 스프레드시트에 맞게 조정)
const COL = {
  IS_HOMEROOM: 0,    // 담임 (체크박스)
  NAME: 1,           // 성명
  CLASS_DAYS: 2,     // 요일
  SCHOOL: 3,         // 학교
  GRADE: 4,          // 학년
  CLASS_TYPE: 5,     // 수업 (급여 단가 구분)
  // 6~10: 급여 계산 관련 컬럼들 (스킵)
  DATE_START: 17,    // R열 = 인덱스 17 (날짜 컬럼 시작)
};

// ============================================
// 🚀 메인 함수 - 이 함수를 실행하세요
// ============================================
function migrateAttendanceData() {
  const ui = SpreadsheetApp.getUi();
  
  // 마이그레이션할 시트 선택
  const response = ui.prompt(
    '📋 마이그레이션할 시트 선택',
    '시트 이름을 입력하세요:\n' +
    '• 단일: 25.12\n' +
    '• 여러 개: 25.12, 25.11, 25.10\n' +
    '• 전체: ALL',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert('취소되었습니다.');
    return;
  }
  
  const input = response.getResponseText().trim();
  const sheetNames = input.toUpperCase() === 'ALL' 
    ? getAllMonthSheets() 
    : input.split(',').map(s => s.trim());
  
  Logger.log('='.repeat(50));
  Logger.log('🚀 마이그레이션 시작');
  Logger.log('대상 시트: ' + sheetNames.join(', '));
  Logger.log('='.repeat(50));
  
  // Firebase에서 기존 학생 목록 가져오기
  Logger.log('\n📥 Firebase에서 학생 목록 가져오는 중...');
  const existingStudents = fetchAllStudents();
  Logger.log('✅ ' + existingStudents.length + '명의 학생 데이터 로드됨');
  
  // 결과 집계
  let totalMigrated = 0;
  let totalFailed = 0;
  let totalNew = 0;
  const failedStudents = [];
  const newStudents = [];
  
  // 각 시트 처리
  for (const sheetName of sheetNames) {
    Logger.log('\n' + '─'.repeat(40));
    Logger.log('📋 시트 처리 중: ' + sheetName);
    
    const result = processSheet(sheetName, existingStudents);
    
    totalMigrated += result.migrated;
    totalFailed += result.failed;
    totalNew += result.newStudents.length;
    failedStudents.push(...result.failedList);
    newStudents.push(...result.newStudents);
  }
  
  // 최종 결과 보고
  Logger.log('\n' + '='.repeat(50));
  Logger.log('📊 마이그레이션 완료!');
  Logger.log('='.repeat(50));
  
  const report = 
    '✅ 성공: ' + totalMigrated + '건\n' +
    '🆕 신규 학생: ' + totalNew + '명\n' +
    '❌ 실패: ' + totalFailed + '건\n\n' +
    (failedStudents.length > 0 
      ? '실패 목록:\n' + failedStudents.map(s => '• ' + s.name + ' (' + s.sheet + '): ' + s.reason).join('\n')
      : '');
  
  Logger.log(report);
  ui.alert('마이그레이션 완료', report, ui.ButtonSet.OK);
}

// ============================================
// 📋 시트 처리
// ============================================
function processSheet(sheetName, existingStudents) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log('⚠️ 시트를 찾을 수 없음: ' + sheetName);
    return { migrated: 0, failed: 0, failedList: [], newStudents: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // 연월 파싱 (예: "25.12" -> "2025-12")
  const parts = sheetName.split('.');
  if (parts.length !== 2) {
    Logger.log('⚠️ 시트 이름 형식 오류: ' + sheetName);
    return { migrated: 0, failed: 0, failedList: [], newStudents: [] };
  }
  
  const year = '20' + parts[0];
  const month = parts[1].padStart(2, '0');
  const yearMonth = year + '-' + month;
  
  Logger.log('연월: ' + yearMonth);
  
  // 날짜 컬럼 매핑 찾기
  const dateColumns = [];
  for (let i = COL.DATE_START; i < headers.length; i++) {
    const header = String(headers[i]);
    // "12/01", "12/1", "1" 등 다양한 형식 처리
    const match = header.match(/(\d+)\/(\d+)/);
    if (match) {
      const day = match[2].padStart(2, '0');
      const dateKey = yearMonth + '-' + day;
      dateColumns.push({ index: i, dateKey: dateKey, header: header });
    }
  }
  
  Logger.log('날짜 컬럼 ' + dateColumns.length + '개 발견');
  
  let migrated = 0;
  let failed = 0;
  const failedList = [];
  const newStudents = [];
  
  // 각 학생 행 처리 (1행은 헤더)
  for (let row = 1; row < data.length; row++) {
    const rowData = data[row];
    const name = String(rowData[COL.NAME] || '').trim();
    
    if (!name || name === '') continue; // 빈 행 스킵
    
    // 학생 정보 추출
    const studentInfo = {
      name: name,
      school: String(rowData[COL.SCHOOL] || '').trim(),
      grade: String(rowData[COL.GRADE] || '').trim(),
      isHomeroom: rowData[COL.IS_HOMEROOM] === true,
      classDays: String(rowData[COL.CLASS_DAYS] || '').trim(),
      classType: String(rowData[COL.CLASS_TYPE] || '').trim(),
    };
    
    // 학생 매칭 또는 생성
    let matchedStudent = findStudent(existingStudents, studentInfo);
    let isNew = false;
    
    if (!matchedStudent) {
      // 신규 학생 생성
      const newId = createStudent(studentInfo);
      if (newId) {
        matchedStudent = { id: newId, name: name };
        existingStudents.push(matchedStudent); // 목록에 추가
        newStudents.push({ name: name, sheet: sheetName });
        isNew = true;
        Logger.log('  🆕 신규 학생 생성: ' + name);
      } else {
        failed++;
        failedList.push({
          name: name,
          sheet: sheetName,
          reason: '학생 생성 실패'
        });
        continue;
      }
    }
    
    // 출석 데이터 수집
    const attendance = {};
    let attendanceCount = 0;
    
    for (let d = 0; d < dateColumns.length; d++) {
      const col = dateColumns[d];
      const value = rowData[col.index];
      
      // 숫자 값만 처리 (0, 0.5, 1, 1.5, 2 등)
      if (value !== '' && value !== null && !isNaN(value)) {
        attendance[col.dateKey] = Number(value);
        attendanceCount++;
      }
    }
    
    // Firebase에 출석 데이터 저장
    if (attendanceCount > 0) {
      const success = updateStudentAttendance(
        matchedStudent.id,
        yearMonth,
        attendance,
        studentInfo
      );
      
      if (success) {
        migrated++;
        const status = isNew ? '🆕' : '✓';
        Logger.log('  ' + status + ' ' + name + ': ' + attendanceCount + '일 출석 저장');
      } else {
        failed++;
        failedList.push({
          name: name,
          sheet: sheetName,
          reason: 'Firebase 저장 실패'
        });
      }
    }
  }
  
  Logger.log('📊 ' + sheetName + ': 성공 ' + migrated + ', 신규 ' + newStudents.length + ', 실패 ' + failed);
  return { migrated: migrated, failed: failed, failedList: failedList, newStudents: newStudents };
}

// ============================================
// 🔍 학생 매칭
// ============================================
function findStudent(students, info) {
  const name = info.name;
  const school = info.school;
  
  // 1순위: 이름 정확히 일치 (1명만 있을 때)
  const byName = students.filter(function(s) { 
    return s.name === name; 
  });
  
  if (byName.length === 1) {
    return byName[0];
  }
  
  // 2순위: 이름 + 학교 일치 (동명이인)
  if (byName.length > 1 && school) {
    const schoolShort = school.replace(/고등학교|중학교|초등학교/g, '');
    const bySchool = byName.find(function(s) {
      return s.school && s.school.includes(schoolShort);
    });
    if (bySchool) return bySchool;
  }
  
  // 동명이인 경고
  if (byName.length > 1) {
    Logger.log('  ⚠️ 동명이인: ' + name + ' (' + byName.length + '명) - 첫 번째 선택');
    return byName[0];
  }
  
  return null;
}

// ============================================
// 🔥 Firebase API
// ============================================
function getFirebaseUrl(path) {
  return 'https://firestore.googleapis.com/v1/projects/' + 
         CONFIG.FIREBASE_PROJECT_ID + 
         '/databases/(default)/documents/' + 
         path + '?key=' + CONFIG.FIREBASE_API_KEY;
}

function fetchAllStudents() {
  try {
    const url = getFirebaseUrl('students');
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());
    
    if (!json.documents) return [];
    
    return json.documents.map(function(doc) {
      const fields = doc.fields || {};
      return {
        id: doc.name.split('/').pop(),
        name: fields.name ? fields.name.stringValue : '',
        school: fields.school ? fields.school.stringValue : '',
        englishName: fields.englishName ? fields.englishName.stringValue : '',
      };
    });
  } catch (e) {
    Logger.log('❌ Firebase 연결 오류: ' + e.message);
    return [];
  }
}

function createStudent(info) {
  try {
    const url = getFirebaseUrl('students');
    const now = new Date().toISOString();
    
    const payload = {
      fields: {
        name: { stringValue: info.name },
        school: { stringValue: info.school },
        grade: { stringValue: info.grade },
        status: { stringValue: 'active' },
        createdAt: { stringValue: now },
        updatedAt: { stringValue: now },
        enrollments: {
          arrayValue: {
            values: [{
              mapValue: {
                fields: {
                  teacherId: { stringValue: CONFIG.TEACHER_ID },
                  teacherName: { stringValue: CONFIG.TEACHER_NAME },
                  subject: { stringValue: CONFIG.SUBJECT },
                  isHomeroom: { booleanValue: info.isHomeroom },
                  classDays: { stringValue: info.classDays },
                  classType: { stringValue: info.classType },
                  startDate: { stringValue: now },
                }
              }
            }]
          }
        }
      }
    };
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      return result.name.split('/').pop();
    }
    
    Logger.log('학생 생성 실패: ' + response.getContentText());
    return null;
  } catch (e) {
    Logger.log('학생 생성 오류: ' + e.message);
    return null;
  }
}

function updateStudentAttendance(studentId, yearMonth, attendance, studentInfo) {
  try {
    // 출석 데이터를 Firestore 형식으로 변환
    const attendanceFields = {};
    for (var dateKey in attendance) {
      attendanceFields[dateKey] = { doubleValue: attendance[dateKey] };
    }
    
    const url = 'https://firestore.googleapis.com/v1/projects/' + 
                CONFIG.FIREBASE_PROJECT_ID + 
                '/databases/(default)/documents/students/' + 
                studentId + '?updateMask.fieldPaths=attendance.' + yearMonth +
                '&key=' + CONFIG.FIREBASE_API_KEY;
    
    const payload = {
      fields: {
        attendance: {
          mapValue: {
            fields: {}
          }
        }
      }
    };
    
    payload.fields.attendance.mapValue.fields[yearMonth] = {
      mapValue: {
        fields: attendanceFields
      }
    };
    
    const response = UrlFetchApp.fetch(url, {
      method: 'PATCH',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    return response.getResponseCode() === 200;
  } catch (e) {
    Logger.log('출석 저장 오류: ' + e.message);
    return false;
  }
}

// ============================================
// 🛠️ 유틸리티
// ============================================
function getAllMonthSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()
    .map(function(s) { return s.getName(); })
    .filter(function(name) { return /^\d{2}\.\d{2}$/.test(name); })
    .sort()
    .reverse();
}

// ============================================
// 🧪 테스트 함수
// ============================================
function testConnection() {
  Logger.log('🔌 Firebase 연결 테스트...');
  Logger.log('프로젝트: ' + CONFIG.FIREBASE_PROJECT_ID);
  
  const students = fetchAllStudents();
  
  if (students.length > 0) {
    Logger.log('✅ 연결 성공! ' + students.length + '명의 학생 발견');
    Logger.log('\n처음 5명:');
    students.slice(0, 5).forEach(function(s) {
      Logger.log('  • ' + s.name + ' (' + (s.school || '-') + ')');
    });
  } else {
    Logger.log('⚠️ 학생을 찾을 수 없거나 연결 실패');
    Logger.log('API Key와 프로젝트 ID를 확인하세요.');
  }
}

function testSheetStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = getAllMonthSheets();
  
  Logger.log('📋 월별 시트 목록:');
  sheets.forEach(function(name) {
    Logger.log('  • ' + name);
  });
  
  if (sheets.length > 0) {
    const sheet = ss.getSheetByName(sheets[0]);
    const headers = sheet.getRange(1, 1, 1, 20).getValues()[0];
    
    Logger.log('\n📊 ' + sheets[0] + ' 시트 헤더:');
    headers.forEach(function(h, i) {
      if (h) Logger.log('  [' + i + '] ' + h);
    });
  }
}
```

---

## ⚙️ 설정 안내

### Firebase 프로젝트 ID 찾기
1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택
3. 프로젝트 설정 → 일반 → **프로젝트 ID**

### Firebase API Key 찾기
1. Firebase Console → 프로젝트 설정
2. 일반 → 하단 **Web API Key**

### 선생님 ID 찾기
1. ijw-calander 앱에서 설정 → 사용자 관리
2. 해당 선생님의 문서 ID

---

## 📊 컬럼 인덱스 조정

스프레드시트 구조가 다르면 `COL` 설정을 수정하세요:

```javascript
const COL = {
  IS_HOMEROOM: 0,    // 담임 체크박스 컬럼
  NAME: 1,           // 성명 컬럼
  CLASS_DAYS: 2,     // 요일 컬럼
  SCHOOL: 3,         // 학교 컬럼
  GRADE: 4,          // 학년 컬럼
  CLASS_TYPE: 5,     // 수업(단가구분) 컬럼
  DATE_START: 11,    // 날짜 시작 컬럼 (12/01 등)
};
```

---

## ✅ 실행 순서

1. `testConnection` 실행 → Firebase 연결 확인
2. `testSheetStructure` 실행 → 시트 구조 확인
3. `migrateAttendanceData` 실행 → 마이그레이션

---

## ⚠️ 주의사항

- 먼저 **1개 월 시트**로 테스트 후 전체 실행
- 실행 시간 제한: 6분 (대량 데이터는 나눠서 실행)
- 기존 데이터는 **덮어쓰기**됨 (같은 월)

---

## 📊 현황 분석

### 스프레드시트 구조

**시트 명명 규칙**: `YY.MM` (예: 26.01, 25.12, 25.11)

**컬럼 구조**:
| 인덱스 | 컬럼명 | 용도 |
|--------|--------|------|
| 0 | 이름 | 학생 이름 |
| 1 | 영어이름 | 영문명 |
| 2 | 학교 | 학교명 |
| 3 | 학년 | 학년 |
| 4 | 3M 반영 | 반 정보 |
| 5 | 가격기준적용 | 급여 설정 |
| 6 | 원비청구 | 청구 정보 |
| 7 | KMID월 | (기타) |
| 8+ | MM/DD | 일별 출석 값 (0, 0.5, 1, 1.5, 2...) |

### Firebase 데이터 구조

**students 컬렉션**:
```javascript
{
  id: "auto-generated",
  name: "김민준",
  englishName: "Kevin",
  school: "서울고",
  grade: "고1",
  attendance: {
    "2025-12": {
      "2025-12-01": 1,
      "2025-12-02": 0.5,
      "2025-12-03": 1.5,
      // ...
    }
  }
}
```

---

## 🔄 매칭 전략

### 학생 매칭 우선순위

```
1순위: 이름 정확히 일치
2순위: 이름 + 학교 일치 (동명이인 처리)
3순위: 영어이름 일치
실패 시: 로그에 기록 → 수동 처리
```

### 주의사항
- 동명이인 처리 (학교 정보로 구분)
- 이름 공백/특수문자 정규화
- 대소문자 무시 (영어이름)

---

## 🛠️ Apps Script 구현

### 1. 스크립트 설정

**스프레드시트 → 확장 프로그램 → Apps Script**

### 2. 전체 코드

```javascript
// ============================================
// 설정
// ============================================
const FIREBASE_PROJECT_ID = 'your-project-id'; // Firebase 프로젝트 ID
const FIREBASE_API_KEY = 'your-api-key';       // Firebase Web API Key
const STUDENTS_COLLECTION = 'students';

// 컬럼 인덱스 (0-based)
const COL = {
  NAME: 0,
  ENGLISH_NAME: 1,
  SCHOOL: 2,
  GRADE: 3,
  CLASS: 4,
  SALARY_SETTING: 5,
  BILLING: 6,
  KMID: 7,
  DATE_START: 8  // 날짜 컬럼 시작
};

// ============================================
// 메인 함수
// ============================================
function migrateAttendanceData() {
  const ui = SpreadsheetApp.getUi();
  
  // 마이그레이션할 시트 선택
  const response = ui.prompt(
    '마이그레이션할 시트',
    '시트 이름을 입력하세요 (예: 25.12)\n여러 개는 쉼표로 구분 (예: 25.12, 25.11, 25.10)\n전체는 "ALL" 입력',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const input = response.getResponseText().trim();
  const sheetNames = input === 'ALL' 
    ? getAllMonthSheets() 
    : input.split(',').map(s => s.trim());
  
  // Firebase에서 기존 학생 목록 가져오기
  Logger.log('📥 Firebase에서 학생 목록 가져오는 중...');
  const existingStudents = fetchAllStudents();
  Logger.log(`✅ ${Object.keys(existingStudents).length}명의 학생 데이터 로드됨`);
  
  // 각 시트 처리
  let totalMigrated = 0;
  let totalFailed = 0;
  const failedStudents = [];
  
  for (const sheetName of sheetNames) {
    Logger.log(`\n📋 시트 처리 중: ${sheetName}`);
    const result = processSheet(sheetName, existingStudents);
    totalMigrated += result.migrated;
    totalFailed += result.failed;
    failedStudents.push(...result.failedList);
  }
  
  // 결과 보고
  const report = `
=== 마이그레이션 완료 ===
✅ 성공: ${totalMigrated}건
❌ 실패: ${totalFailed}건

실패 목록:
${failedStudents.map(s => `- ${s.name} (${s.sheet}): ${s.reason}`).join('\n')}
  `;
  
  Logger.log(report);
  ui.alert('마이그레이션 완료', report, ui.ButtonSet.OK);
}

// ============================================
// 시트 처리
// ============================================
function processSheet(sheetName, existingStudents) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log(`⚠️ 시트를 찾을 수 없음: ${sheetName}`);
    return { migrated: 0, failed: 0, failedList: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // 연월 파싱 (예: "25.12" -> "2025-12")
  const [yy, mm] = sheetName.split('.');
  const yearMonth = `20${yy}-${mm.padStart(2, '0')}`;
  
  // 날짜 컬럼 매핑
  const dateColumns = [];
  for (let i = COL.DATE_START; i < headers.length; i++) {
    const header = headers[i];
    if (header && /\d+\/\d+/.test(String(header))) {
      const [month, day] = String(header).match(/(\d+)\/(\d+)/).slice(1);
      const dateKey = `${yearMonth}-${day.padStart(2, '0')}`;
      dateColumns.push({ index: i, dateKey });
    }
  }
  
  let migrated = 0;
  let failed = 0;
  const failedList = [];
  
  // 각 학생 행 처리
  for (let row = 1; row < data.length; row++) {
    const rowData = data[row];
    const name = String(rowData[COL.NAME]).trim();
    
    if (!name) continue; // 빈 행 스킵
    
    const englishName = String(rowData[COL.ENGLISH_NAME] || '').trim();
    const school = String(rowData[COL.SCHOOL] || '').trim();
    
    // 학생 매칭
    const matchedStudent = findStudent(existingStudents, name, englishName, school);
    
    if (!matchedStudent) {
      failed++;
      failedList.push({
        name,
        sheet: sheetName,
        reason: '매칭되는 학생 없음'
      });
      continue;
    }
    
    // 출석 데이터 수집
    const attendance = {};
    for (const { index, dateKey } of dateColumns) {
      const value = rowData[index];
      if (value !== '' && !isNaN(value)) {
        attendance[dateKey] = Number(value);
      }
    }
    
    // Firebase 업데이트
    if (Object.keys(attendance).length > 0) {
      const success = updateStudentAttendance(
        matchedStudent.id, 
        yearMonth, 
        attendance
      );
      
      if (success) {
        migrated++;
        Logger.log(`  ✓ ${name}: ${Object.keys(attendance).length}일 출석 데이터 저장`);
      } else {
        failed++;
        failedList.push({
          name,
          sheet: sheetName,
          reason: 'Firebase 저장 실패'
        });
      }
    }
  }
  
  Logger.log(`📊 ${sheetName}: 성공 ${migrated}, 실패 ${failed}`);
  return { migrated, failed, failedList };
}

// ============================================
// 학생 매칭
// ============================================
function findStudent(students, name, englishName, school) {
  // 1순위: 이름 정확히 일치 (1명만 있을 때)
  const byName = students.filter(s => s.name === name);
  if (byName.length === 1) return byName[0];
  
  // 2순위: 이름 + 학교 일치
  if (byName.length > 1 && school) {
    const bySchool = byName.find(s => 
      s.school && s.school.includes(school.replace('고등학교', '').replace('중학교', ''))
    );
    if (bySchool) return bySchool;
  }
  
  // 3순위: 영어이름 일치
  if (englishName) {
    const byEnglish = students.find(s => 
      s.englishName && s.englishName.toLowerCase() === englishName.toLowerCase()
    );
    if (byEnglish) return byEnglish;
  }
  
  // 동명이인이 있고 구분 불가
  if (byName.length > 1) {
    Logger.log(`  ⚠️ 동명이인 발견: ${name} (${byName.length}명)`);
  }
  
  return null;
}

// ============================================
// Firebase API
// ============================================
function fetchAllStudents() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${STUDENTS_COLLECTION}?key=${FIREBASE_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());
  
  if (!json.documents) return [];
  
  return json.documents.map(doc => {
    const fields = doc.fields;
    return {
      id: doc.name.split('/').pop(),
      name: fields.name?.stringValue || '',
      englishName: fields.englishName?.stringValue || '',
      school: fields.school?.stringValue || '',
    };
  });
}

function updateStudentAttendance(studentId, yearMonth, attendance) {
  // attendance 필드 업데이트 (merge)
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${STUDENTS_COLLECTION}/${studentId}?updateMask.fieldPaths=attendance.${yearMonth}&key=${FIREBASE_API_KEY}`;
  
  const payload = {
    fields: {
      attendance: {
        mapValue: {
          fields: {
            [yearMonth]: {
              mapValue: {
                fields: Object.fromEntries(
                  Object.entries(attendance).map(([k, v]) => [k, { doubleValue: v }])
                )
              }
            }
          }
        }
      }
    }
  };
  
  const response = UrlFetchApp.fetch(url, {
    method: 'PATCH',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  return response.getResponseCode() === 200;
}

function getAllMonthSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets()
    .map(s => s.getName())
    .filter(name => /^\d{2}\.\d{2}$/.test(name))
    .sort()
    .reverse();
}

// ============================================
// 유틸리티
// ============================================
function testConnection() {
  const students = fetchAllStudents();
  Logger.log(`연결 성공! ${students.length}명의 학생 발견`);
  students.slice(0, 5).forEach(s => Logger.log(`  - ${s.name} (${s.school})`));
}
```

---

## 🚀 사용 방법

### Step 1: Apps Script 설정

1. 스프레드시트 열기
2. **확장 프로그램 → Apps Script** 클릭
3. 위 코드 전체 복사 → 붙여넣기
4. 상단 설정값 수정:
   ```javascript
   const FIREBASE_PROJECT_ID = 'ijw-calander'; // 실제 프로젝트 ID
   const FIREBASE_API_KEY = 'AIza...';         // 실제 API Key
   ```

### Step 2: 연결 테스트

1. 함수 선택: `testConnection`
2. **실행** 클릭
3. 로그 확인 (View → Logs)

### Step 3: 마이그레이션 실행

1. 함수 선택: `migrateAttendanceData`
2. **실행** 클릭
3. 시트 이름 입력 (예: `25.12` 또는 `ALL`)
4. 완료 대기

---

## ⚠️ 주의사항

### 1. API Key 보안
- Apps Script 코드에 API Key 노출됨
- 마이그레이션 완료 후 스크립트 삭제 또는 Key 재생성 권장

### 2. 대용량 처리
- Google Apps Script 실행 시간 제한: 6분
- 월별로 나눠서 실행 권장

### 3. 중복 실행 방지
- 같은 시트 재실행 시 덮어쓰기됨
- 기존 출석 데이터 백업 권장

---

## ✅ 체크리스트

- [ ] Firebase 프로젝트 ID 확인
- [ ] Firebase Web API Key 획득
- [ ] Apps Script에 코드 붙여넣기
- [ ] `testConnection` 테스트
- [ ] 샘플 시트 (1개월) 테스트 마이그레이션
- [ ] 결과 확인 후 전체 마이그레이션

---

## 📞 다음 단계

1. **Firebase 프로젝트 정보 확인** (프로젝트 ID, API Key)
2. 스크립트 설정 완료
3. 테스트 실행 후 전체 마이그레이션
