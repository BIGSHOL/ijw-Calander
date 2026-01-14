# 🧪 새 구조 수업 등록 테스트 가이드

## 준비 단계

### 1. 데이터 구조 전환 활성화

1. 앱 로그인
2. **설정** → **데이터 마이그레이션** 탭
3. **"데이터 구조 전환"** 토글을 **새 구조(ON)** 로 변경
4. 페이지 새로고침 (F5)

### 2. 기존 데이터 확인

- Firebase Console → `classes` 컬렉션 확인
- 비어있거나 테스트 데이터만 있어야 함

---

## 테스트 시나리오

### 시나리오 1: 단독 수업 등록 ✅

**목표**: 합반이 아닌 일반 수업이 정상 등록되고 시간표에 표시되는지 확인

#### 등록 단계
1. **수업 관리** → **새 수업 추가** 클릭
2. 입력:
   - 수업명: `DP3`
   - 과목: `영어`
   - 담임 강사: `Ellen`
   - 강의실: `302`
3. 스케줄: `화요일 2교시` 선택
4. 합반 수업 체크박스: **체크 안 함** (단독 수업)
5. 학생 최소 1명 선택
6. **저장**

#### 검증
- [ ] classes 컬렉션에 `english_DP3_Ellen` 문서 생성됨
- [ ] `classGroupId` 필드 **없음**
- [ ] **영어 시간표** → **통합뷰** 확인
- [ ] Ellen 선생님의 화요일 2교시에 `DP3` 표시됨
- [ ] 수업 카드에 학생 수 정상 표시

---

### 시나리오 2: 합반 수업 등록 ⚠️ (핵심 테스트)

**목표**: LT1a + LT1b 합반이 정상 등록되고, 두 반 모두 시간표에 표시되는지 확인

#### 등록 단계 - 리더반 (LT1a)
1. **수업 관리** → **새 수업 추가** 클릭
2. 입력:
   - 수업명: `LT1a`
   - 과목: `영어`
   - 담임 강사: `Ellen`
   - 강의실: `302`
3. 스케줄: `화요일 2교시` 선택
4. **☑ 합반 수업** 체크
5. 함께 수업할 반 이름: `LT1b`
6. 학생 최소 1명 선택
7. **저장**

#### 자동 생성 확인
저장하면 **두 개의 수업이 자동으로 생성**됩니다:

**1. LT1a (리더)**
```json
{
  "id": "english_LT1a_Ellen",
  "className": "LT1a",
  "teacher": "Ellen",
  "room": "302",
  "schedule": [{ "day": "화", "periodId": "2" }],
  "classGroupId": "Ellen-2-화",
  "isGroupLeader": true,
  "groupMembers": ["english_LT1a_Ellen", "english_LT1b_Ellen"],
  "studentIds": [...]
}
```

**2. LT1b (멤버)** - 자동 생성!
```json
{
  "id": "english_LT1b_Ellen",
  "className": "LT1b",
  "teacher": "Ellen",
  "room": "302",
  "schedule": [{ "day": "화", "periodId": "2" }],
  "classGroupId": "Ellen-2-화",
  "isGroupLeader": false,
  "studentIds": [...]
}
```

#### 검증
- [ ] classes 컬렉션에 **2개 문서** 생성됨
- [ ] `english_LT1a_Ellen` (리더): `isGroupLeader: true`
- [ ] `english_LT1b_Ellen` (멤버): `isGroupLeader: false`
- [ ] 두 문서 모두 `classGroupId: "Ellen-2-화"` 동일
- [ ] **영어 시간표** → **통합뷰** 확인
- [ ] Ellen 선생님의 화요일 2교시에 **LT1a** 표시
- [ ] LT1a 카드 클릭 → 상세 정보에 `합반: LT1b` 표시 (향후 개선)
- [ ] **중요**: 시간표에서 LT1a가 사라지지 않음! ✅

---

### 시나리오 3: 여러 교시 수업 등록

**목표**: 같은 수업이 여러 요일/교시에 걸쳐 있을 때 정상 작동 확인

#### 등록 단계
1. **수업 관리** → **새 수업 추가**
2. 입력:
   - 수업명: `PL6`
   - 과목: `영어`
   - 담임 강사: `Sarah`
   - 강의실: `301`
3. 스케줄: `월요일 5교시`, `수요일 5교시` 선택
4. 학생 선택
5. **저장**

#### 검증
- [ ] `schedule` 배열에 2개 슬롯:
  ```json
  [
    { "day": "월", "periodId": "5", "teacher": "Sarah" },
    { "day": "수", "periodId": "5", "teacher": "Sarah" }
  ]
  ```
- [ ] 시간표에서 월요일 5교시, 수요일 5교시 모두 표시

---

### 시나리오 4: 교시별 강사 다르게 설정

**목표**: 같은 수업이지만 요일마다 다른 강사가 수업할 때

#### 등록 단계
1. 새 수업 추가
2. 기본 정보 입력
3. 스케줄 선택 후
4. **"교시별 강사 설정"** 펼치기
5. 각 교시마다 다른 강사 입력
6. 저장

#### 검증
- [ ] `schedule` 배열의 각 슬롯마다 `teacher` 다름
- [ ] 시간표에서 각 교시에 올바른 강사 표시

---

## 예상 문제 및 해결

### ❌ 문제 1: "Missing or insufficient permissions" 오류

**원인**: Firestore Rules 미배포

**해결**:
```bash
firebase deploy --only firestore:rules
```

### ❌ 문제 2: "Index required" 오류

**원인**: Firestore Indexes 미배포

**해결**:
```bash
firebase deploy --only firestore:indexes
```

콘솔 에러 메시지의 링크 클릭해도 자동으로 인덱스 생성됨

### ❌ 문제 3: 합반 수업 중 한 반이 사라짐

**원인**:
- AddClassModal 코드가 수정되지 않음
- 또는 localStorage 설정이 `useNewDataStructure: false`

**해결**:
1. `localStorage.getItem('useNewDataStructure')` 확인 → `"true"`여야 함
2. 브라우저 개발자 도구 → Application → Local Storage 확인

### ❌ 문제 4: 시간표가 비어 있음

**원인**: EnglishTimetable이 여전히 `english_schedules` 읽으려 함

**해결**:
1. 브라우저 새로고침 (F5)
2. 캐시 삭제 (Ctrl + Shift + Del)

---

## 디버깅 팁

### 1. Console 로그 확인

```javascript
// 브라우저 개발자 도구 → Console
console.log(localStorage.getItem('useNewDataStructure'));
// "true"여야 함
```

### 2. Firestore 데이터 직접 확인

Firebase Console → Firestore Database → `classes` 컬렉션

**확인 사항**:
- 문서 ID 형식: `english_LT1a_Ellen`
- `schedule` 배열 존재
- 합반의 경우 `classGroupId` 동일

### 3. 네트워크 요청 확인

개발자 도구 → Network 탭 → `firestore.googleapis.com` 필터

- `RunQuery` 요청 확인
- Query 파라미터에 `subject == 'english'` 확인

---

## 성공 기준

### ✅ 시나리오 1 통과
- 단독 수업이 정상 표시됨

### ✅ 시나리오 2 통과 (가장 중요!)
- 합반 수업 LT1a, LT1b 모두 시간표에 표시
- 하나가 사라지지 않음
- 합반 관계 유지됨

### ✅ 추가 확인
- 수업 관리 페이지에서 목록 정상 표시
- 학생 enrollments 생성됨
- 수업 편집/삭제 정상 작동

---

## 다음 단계

테스트 성공 후:

1. **실제 데이터 등록**: 기존 영어 수업들을 새 구조로 등록
2. **수업 관리 개선**: 합반 표시 UI 개선
3. **EditClassModal 업데이트**: 합반 편집 기능 추가
4. **수학 과목 통합**: 수학도 동일한 구조로 마이그레이션

---

**마지막 업데이트**: 2026-01-13
**작성자**: Claude Code Assistant
