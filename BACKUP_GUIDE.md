# 🔐 Firebase 백업 & 복원 가이드

Firebase 데이터 손실에 대비한 백업 및 복원 가이드입니다.

## 📋 목차
- [방법 1: 브라우저 콘솔 백업 (권장)](#방법-1-브라우저-콘솔-백업-권장)
- [방법 2: Firebase Console Export](#방법-2-firebase-console-export)
- [방법 3: Cloud Functions 자동 백업](#방법-3-cloud-functions-자동-백업)
- [복원하기](#복원하기)
- [백업 파일 관리](#백업-파일-관리)

---

## 📦 방법 1: 브라우저 콘솔 백업 (권장)

가장 간단하고 빠른 방법입니다. 로그인된 상태에서 실행하므로 권한 문제가 없습니다.

### 1. 앱에 로그인

1. 브라우저에서 앱 열기
2. 관리자 계정으로 로그인

### 2. 개발자 도구 열기

- **Windows/Linux**: `F12` 또는 `Ctrl + Shift + I`
- **Mac**: `Cmd + Option + I`

### 3. Console 탭 선택

### 4. 백업 스크립트 실행

아래 코드를 Console에 붙여넣고 **Enter**:

```javascript
// Firebase Backup Script
(async function backupFirestore() {
  console.log('🔄 Starting Firestore backup...\n');

  const collections = [
    'students', 'classes', 'teachers', 'departments',
    'ganttProjects', 'ganttCategories', 'ganttTemplates',
    'events', 'archivedEvents', 'attendance', 'consultations',
    'grades', 'exams', 'examSeries', 'settings',
    'rolePermissions', 'tabAccess', 'holidays', 'hashtags'
  ];

  const backup = {
    timestamp: new Date().toISOString(),
    collections: {},
    metadata: { totalDocuments: 0, collections: {} }
  };

  const { getFirestore, collection, getDocs } = await import('firebase/firestore');
  const db = getFirestore();

  for (const colName of collections) {
    console.log(`📥 Backing up ${colName}...`);
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      backup.collections[colName] = data;
      backup.metadata.collections[colName] = data.length;
      backup.metadata.totalDocuments += data.length;

      console.log(`   ✅ ${data.length} documents backed up`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      backup.collections[colName] = [];
      backup.metadata.collections[colName] = 0;
    }
  }

  // 다운로드
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `firestore_backup_${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log('\n✅ Backup completed!');
  console.log(`📊 Total documents: ${backup.metadata.totalDocuments}`);
  console.log('\n📈 Collection Statistics:');
  Object.entries(backup.metadata.collections).forEach(([name, count]) => {
    if (count > 0) console.log(`   - ${name}: ${count} documents`);
  });
})();
```

### 5. 다운로드 확인

- 브라우저 다운로드 폴더에 `firestore_backup_2026-01-09T15-30-00.json` 파일 생성됨
- 파일 크기 확인 (약 5-10 MB)

### 6. 안전한 곳에 보관

- Google Drive, OneDrive, USB 외장 하드 등에 복사
- 최소 2곳 이상 보관 권장

---

## 📦 방법 2: Firebase Console Export

Google Cloud Platform을 통한 공식 백업 방법입니다.

### 1. Firebase Console 접속

[Firebase Console](https://console.firebase.google.com/) → `ijw-calander` 프로젝트 선택

### 2. Firestore Database로 이동

좌측 메뉴: **Firestore Database** 클릭

### 3. 데이터 내보내기

1. 상단 메뉴: **⋮** (더보기) → **Import/Export** → **Export data** 클릭
2. Export type: **All collections** 선택
3. Google Cloud Storage 버킷 선택 (자동 생성됨)
4. **Export** 버튼 클릭
5. 내보내기 완료까지 5-10분 대기

### 4. 백업 파일 다운로드

1. [Google Cloud Storage](https://console.cloud.google.com/storage/) 접속
2. 버킷에서 export 폴더 찾기
3. 파일 다운로드 (`.overall_export_metadata`, `.export_metadata` 파일들)

**비용:**
- Export 작업: 무료
- Cloud Storage 저장: $0.026/GB/월 (약 30원/GB/월)
- 네트워크 다운로드: $0.12/GB (약 140원/GB)

**장점:**
- 공식 백업 방법
- 대용량 데이터도 안정적

**단점:**
- 비용 발생
- 복원이 복잡함
- JSON 파일 읽기 어려움

---

## 📦 방법 3: Cloud Functions 자동 백업

### 1. Firebase Extensions 설치

1. [Firebase Console](https://console.firebase.google.com/) → `ijw-calander`
2. 좌측 메뉴: **Extensions** 클릭
3. **Install Extension** 버튼
4. 검색: **"Firestore Export"**
5. **Install** 클릭

### 2. 설정

- **Schedule**: `0 0 * * *` (매일 자정)
- **Collections**: `students,classes,teachers,...` (전체)
- **Output location**: Cloud Storage 버킷

### 3. 비용

- Extension 사용료: 무료 (월 50회까지)
- Cloud Storage: $0.026/GB/월
- 월 예상 비용: 약 50-100원

---

## 🔄 복원하기

### 방법 A: 브라우저 콘솔에서 복원 (간단)

1. 브라우저에서 앱 로그인
2. 개발자 도구 (`F12`) → Console
3. 아래 코드 붙여넣기:

```javascript
// Firebase Restore Script
(async function restoreFirestore() {
  // 1. 백업 파일 업로드
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
      const backup = JSON.parse(event.target.result);
      console.log('🔄 Starting restore...');
      console.log(`📅 Backup date: ${new Date(backup.timestamp).toLocaleString('ko-KR')}`);
      console.log(`📊 Total documents: ${backup.metadata.totalDocuments}`);

      // 사용자 확인
      if (!confirm('정말 복원하시겠습니까? 기존 데이터가 덮어써질 수 있습니다.')) {
        console.log('❌ Cancelled');
        return;
      }

      const { getFirestore, doc, setDoc } = await import('firebase/firestore');
      const db = getFirestore();

      let restored = 0;

      for (const [colName, docs] of Object.entries(backup.collections)) {
        if (docs.length === 0) continue;

        console.log(`\n📤 Restoring ${colName}...`);

        for (const docData of docs) {
          const { id, ...data } = docData;
          try {
            await setDoc(doc(db, colName, id), data);
            console.log(`   ✅ Restored ${id}`);
            restored++;

            // Rate limit 방지 (100ms 대기)
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`   ❌ Error restoring ${id}:`, error.message);
          }
        }
      }

      console.log(`\n✅ Restore completed!`);
      console.log(`📊 Total restored: ${restored}`);
    };

    reader.readAsText(file);
  };

  input.click();
})();
```

4. 백업 파일 선택
5. 확인 다이얼로그에서 **확인** 클릭
6. 복원 완료까지 대기 (5-10분)

### 방법 B: Firebase Console Import

1. [Firebase Console](https://console.firebase.google.com/) → Firestore Database
2. 상단: **⋮** → **Import/Export** → **Import data**
3. Cloud Storage에서 백업 파일 선택
4. **Import** 클릭

**주의:** Cloud Storage Export 형식만 지원 (브라우저 백업 JSON은 지원 안 됨)

---

## 📂 백업 파일 관리

### 1. 백업 주기 권장

| 백업 유형 | 주기 | 보관 기간 |
|----------|------|----------|
| **일일 백업** | 매일 자정 | 7일 |
| **주간 백업** | 매주 일요일 | 4주 |
| **월간 백업** | 매월 1일 | 12개월 |
| **수동 백업** | 중요 작업 전 | 영구 보관 |

### 2. 파일 명명 규칙

```
firestore_backup_2026-01-09T15-30-00.json
                └─── 날짜 ──┘└─ 시간 ─┘
```

### 3. 저장 위치

#### 로컬:
```
다운로드/
├── firestore_backup_2026-01-09T15-30-00.json
├── firestore_backup_2026-01-08T10-00-00.json
└── firestore_backup_2026-01-07T18-45-00.json
```

#### 클라우드:
- **Google Drive**: `IJW 학원/백업/Firestore/`
- **OneDrive**: `문서/IJW-Backups/`
- **USB 외장 하드**: `E:\IJW-Backups\`

### 4. 백업 확인

열어서 확인:
```json
{
  "timestamp": "2026-01-09T15:30:00.000Z",
  "metadata": {
    "totalDocuments": 1234,
    "collections": {
      "students": 432,
      "classes": 28,
      ...
    }
  }
}
```

**확인 사항:**
- ✅ `totalDocuments`가 0이 아님
- ✅ 파일 크기가 5-10 MB 정도
- ✅ `students` 개수가 실제 학생 수와 일치

---

## 🚨 긴급 복원 시나리오

### 시나리오 1: 전체 데이터 손실

```
1. 최신 백업 파일 찾기 (Google Drive, 다운로드 폴더)
2. 브라우저 콘솔에서 복원 스크립트 실행
3. 백업 파일 선택
4. 복원 완료 후 데이터 확인
```

### 시나리오 2: 특정 학생만 복원

```javascript
// 특정 학생만 복원하는 스크립트
(async function restoreStudent() {
  const studentName = prompt('복원할 학생 이름:');
  // ... (위 복원 스크립트 수정)
})();
```

### 시나리오 3: 백업 파일 손실

1. Google Drive / OneDrive 확인
2. USB 외장 하드 확인
3. 팀원에게 백업 파일 요청
4. Firebase Console Export 기록 확인

---

## 📊 백업 모니터링

### 체크리스트

- [ ] 주 1회 이상 백업
- [ ] 백업 파일 크기 확인 (5-10 MB)
- [ ] 2곳 이상 보관
- [ ] 최근 7일치 백업 보관
- [ ] 월 1회 복원 테스트

### 백업 알림 설정

**Google Calendar 이벤트:**
- 제목: `Firebase 백업`
- 반복: 매일 자정
- 알림: 30분 전

---

## ❓ FAQ

### Q1: 백업은 얼마나 자주 해야 하나요?
**A:** 최소 **주 2-3회**, 중요한 작업 전에는 **수동 백업**

### Q2: 백업 파일 크기가 너무 큽니다
**A:**
- 정상 크기: 5-10 MB (학생 500명 기준)
- 100 MB 이상: 이미지/파일 데이터 확인 필요

### Q3: 복원 시 기존 데이터는?
**A:**
- 브라우저 콘솔 복원: **덮어쓰기** (기존 데이터 대체)
- Firebase Console Import: **병합** (기존 데이터 유지)

### Q4: 백업 중 오류 발생
**A:**
- 권한 오류: 관리자 계정으로 로그인 확인
- 네트워크 오류: 인터넷 연결 확인
- 브라우저 멈춤: 새로고침 후 재시도

### Q5: Firebase Console Export 복원 방법
**A:**
```bash
# gcloud CLI 설치 후
gcloud firestore import gs://[BUCKET]/[EXPORT_PATH]
```

### Q6: 비용이 얼마나 드나요?
**A:**
- **브라우저 백업**: 무료
- **Cloud Storage Export**: 월 50-100원
- **Firebase Extensions**: 월 50회까지 무료

---

## 🎯 빠른 시작

### 지금 당장 백업하기 (2분)

1. ✅ 앱에 로그인
2. ✅ `F12` 눌러서 Console 열기
3. ✅ [방법 1 백업 스크립트](#4-백업-스크립트-실행) 복사/붙여넣기
4. ✅ Enter 누르기
5. ✅ 다운로드 폴더에서 파일 확인
6. ✅ Google Drive에 복사

### 정기 백업 습관 만들기

- **매주 월요일 오전**: 백업 실행
- **Google Calendar 알림**: 설정
- **백업 체크리스트**: 출력해서 벽에 붙이기

---

## 📞 지원

문제가 있으면:
1. 이 가이드의 FAQ 확인
2. Firebase Console에서 직접 Export 시도
3. 팀원에게 도움 요청

---

**⚠️ 중요:**
- 백업 파일에는 **민감한 학생 정보**가 포함되어 있습니다
- 공개 저장소(GitHub 등)에 **절대 업로드하지 마세요**
- USB/외장 하드는 **안전한 장소에 보관**하세요

**마지막 업데이트:** 2026-01-09
**작성자:** Claude Code Assistant
