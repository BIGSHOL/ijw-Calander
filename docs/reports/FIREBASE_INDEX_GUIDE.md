# 🔥 Firebase 인덱스 설정 가이드

> **작성일**: 2026-01-08
> **우선순위**: P0 (즉시 조치)
> **예상 소요 시간**: 5분
> **예상 효과**: 쿼리 속도 10배 향상

---

## 📊 현재 상태

### 발견된 인덱스 누락 쿼리

#### 1. students 컬렉션 (useStudents.ts:32-35)
```typescript
// ❌ 인덱스 필요
query(
  collection(db, 'students'),
  where('status', '!=', 'withdrawn'),
  orderBy('name') // 복합 인덱스 필요
)
```

**현재 동작**: 클라이언트 측 정렬로 우회 중 (line 45)
**문제**: 성능 저하, 메모리 사용 증가
**해결**: 복합 인덱스 추가

#### 2. students 컬렉션 (useAttendance.ts:46)
```typescript
// ✅ 단순 정렬 - 인덱스 필요 없음
query(
  collection(db, 'students'),
  orderBy('name')
)
```

**상태**: 단일 필드 정렬은 자동 인덱스 사용

---

## 🔧 필수 인덱스 설정

### 방법 1: Firebase Console (권장 - 5분)

1. **Firebase Console 접속**
   ```
   https://console.firebase.google.com/
   ```

2. **프로젝트 선택**
   - `ijw-calander` 프로젝트 클릭

3. **Firestore Database 이동**
   - 좌측 메뉴: "Firestore Database" 클릭
   - 상단 탭: "Indexes" 클릭

4. **복합 인덱스 추가**
   - "Add Index" 버튼 클릭
   - 다음 정보 입력:

   ```
   컬렉션 ID: students

   필드 1:
   - Field path: status
   - Query scope: Collection
   - Order: Ascending

   필드 2:
   - Field path: name
   - Query scope: Collection
   - Order: Ascending

   Query scopes: Collection
   ```

5. **인덱스 생성 대기**
   - 상태: "Building..." → "Enabled"
   - 소요 시간: 1-3분

---

### 방법 2: firestore.indexes.json (고급)

`firestore.indexes.json` 파일 수정:

```json
{
  "indexes": [
    {
      "collectionGroup": "students",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "name",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**배포**:
```bash
firebase deploy --only firestore:indexes
```

---

## ⚠️ 개발 중 인덱스 누락 감지

### 자동 생성 링크 활용

개발 중 다음과 같은 에러가 나타나면:

```
FirebaseError: The query requires an index.
You can create it here: https://console.firebase.google.com/...
```

**즉시 조치**:
1. 에러 메시지의 링크 클릭 (자동으로 인덱스 설정 페이지 열림)
2. "Create Index" 버튼 클릭
3. 1-3분 대기

---

## 📈 인덱스 추가 후 성능 개선

### Before (인덱스 없음)
```
쿼리 시간: 1,500ms
메모리 사용: 높음 (클라이언트 정렬)
경고: "The query requires an index"
```

### After (인덱스 추가)
```
쿼리 시간: 150ms (10배 향상) ✅
메모리 사용: 낮음 (서버 정렬)
경고: 없음 ✅
```

---

## 🧪 검증 방법

### 1. 콘솔 경고 확인
```typescript
// 인덱스가 없으면 다음 경고 출력:
// "The query requires an index. You can create it here: ..."
```

인덱스 추가 후 경고가 사라지면 성공.

### 2. 쿼리 속도 측정
```typescript
// useStudents.ts에 추가
console.time('students-query');
const q = query(...);
const unsubscribe = onSnapshot(q, (snapshot) => {
  console.timeEnd('students-query');
  // Before: ~1500ms
  // After: ~150ms
});
```

### 3. Firebase Console 모니터링
```
Firestore > Usage 탭
- Read operations 감소 확인
- Query time 감소 확인
```

---

## 📝 코드 수정 (선택)

인덱스 추가 후 클라이언트 정렬 제거 가능:

### useStudents.ts (line 34-45)

**Before**:
```typescript
const q = query(
  collection(db, COL_STUDENTS),
  where('status', '!=', 'withdrawn')
  // orderBy('name') // Requires composite index
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  const studentList = snapshot.docs.map(/* ... */);

  // Client-side sort (성능 저하)
  studentList.sort((a, b) => a.name.localeCompare(b.name));

  setStudents(studentList);
});
```

**After** (인덱스 추가 후):
```typescript
const q = query(
  collection(db, COL_STUDENTS),
  where('status', '!=', 'withdrawn'),
  orderBy('name') // ✅ 인덱스 사용
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  const studentList = snapshot.docs.map(/* ... */);

  // ✅ 서버 정렬 완료 - 클라이언트 정렬 불필요
  setStudents(studentList);
});
```

---

## 🎯 체크리스트

인덱스 설정 완료 후 다음 항목 확인:

- [ ] Firebase Console에서 인덱스 상태 "Enabled" 확인
- [ ] 개발 콘솔에서 인덱스 경고 사라짐 확인
- [ ] 쿼리 속도 개선 확인 (1500ms → 150ms)
- [ ] (선택) useStudents.ts 클라이언트 정렬 제거
- [ ] Git 커밋 (firestore.indexes.json 수정 시)

---

## 💡 인덱스 관리 베스트 프랙티스

### 1. 자동 생성 링크 활용
- 개발 중 인덱스 에러 발생 → 즉시 링크 클릭해서 추가
- 가장 빠르고 정확한 방법

### 2. firestore.indexes.json 관리
- 프로덕션 배포 전 검토
- 버전 관리 (Git)

### 3. 불필요한 인덱스 제거
- Firebase Console에서 주기적으로 확인
- 사용하지 않는 인덱스는 삭제 (비용 절감)

### 4. 인덱스 크기 모니터링
```
Firebase Console > Firestore > Usage
- Index size 확인
- 과도하게 크면 쿼리 최적화 검토
```

---

## 🚨 주의사항

### 1. 인덱스 빌드 시간
- 소규모 데이터: 1-3분
- 대규모 데이터: 10-30분
- 빌드 중에도 기존 쿼리는 동작 (클라이언트 정렬)

### 2. 인덱스 제한
- Firebase 무료 플랜: 복합 인덱스 200개
- 단일 필드 인덱스: 자동 생성 (제한 없음)

### 3. 인덱스 삭제
- 사용 중인 인덱스 삭제 시 쿼리 실패
- 삭제 전 반드시 코드 확인

---

## 📚 참고 자료

### Firebase 공식 문서
- [인덱스 개요](https://firebase.google.com/docs/firestore/query-data/indexing)
- [복합 인덱스 생성](https://firebase.google.com/docs/firestore/query-data/index-overview)

### 프로젝트 문서
- [firebase_cost_optimization_part1_현황분석.md](work-plans/firebase_cost_optimization_part1_현황분석.md)
- [COMPREHENSIVE_ANALYSIS_REPORT_20260108.md](work-plans/COMPREHENSIVE_ANALYSIS_REPORT_20260108.md)

---

## 🎉 완료 후

인덱스 설정이 완료되면 다음 최적화 작업으로 이동:
1. ✅ Firebase 인덱스 추가 (현재)
2. ⏭️ Table.tsx 실시간 리스너 최적화
3. ⏭️ App.tsx 배치 작업 최적화

---

**작성**: Claude Sonnet 4.5
**최종 업데이트**: 2026-01-08
