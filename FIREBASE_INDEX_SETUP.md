# Firebase 복합 인덱스 생성 가이드

## 문제 상황
학생 목록 화면에서 다음 오류 발생:
```
The query requires an index. You can create it here: [Firebase Console Link]
```

## 해결 방법

### 방법 1: 자동 생성 (권장)
1. 오류 메시지에 표시된 링크를 클릭
2. Firebase Console이 자동으로 열리면서 인덱스 설정 페이지로 이동
3. "Create Index" 버튼 클릭
4. 인덱스 생성 완료까지 2-5분 대기

### 방법 2: 수동 생성
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택: `ijw-calander`
3. 좌측 메뉴에서 **Firestore Database** 선택
4. 상단 탭에서 **Indexes** 클릭
5. **Create Index** 버튼 클릭
6. 다음과 같이 설정:
   - **Collection ID**: `students`
   - **Fields to index**:
     - Field 1: `status` - Ascending
     - Field 2: `withdrawalDate` - Ascending
   - **Query scope**: Collection
7. **Create** 버튼 클릭
8. 인덱스 상태가 "Building" → "Enabled"로 변경될 때까지 대기 (2-5분)

## 인덱스가 필요한 이유
새로 추가된 과거 퇴원생 검색 기능에서 다음 쿼리를 사용합니다:
```typescript
// 최근 90일 퇴원생 조회
where('status', '==', 'withdrawn'),
where('withdrawalDate', '>=', cutoffString)
```

Firestore는 두 개 이상의 필드를 동시에 쿼리할 때 복합 인덱스가 필요합니다.

## 확인 방법
인덱스 생성 후:
1. 앱 새로고침 (F5)
2. "학생 관리" 탭 클릭
3. 학생 목록이 정상적으로 로드되는지 확인
4. 검색창에서 학생 이름 입력하여 과거 퇴원생 검색 테스트

## 비용 영향
- 인덱스 생성 자체는 무료
- 인덱스 유지 비용도 무료 (저장 공간만 약간 사용)
- 쿼리 비용은 기존과 동일 (인덱스로 오히려 속도 향상)
