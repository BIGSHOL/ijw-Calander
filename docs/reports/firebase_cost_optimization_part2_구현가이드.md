# Firebase 비용 최적화 종합 분석 리포트 Part 2
## 구현 가이드 및 베스트 프랙티스

---

**작성일**: 2026-01-05
**프로젝트**: ijw-calander (학원 관리 시스템)
**분석자**: Firebase Cost Optimizer Agent
**문서 구분**: Part 2 - 구현 가이드 및 베스트 프랙티스

---

## 📋 목차

1. [실행 계획 (Phase별 로드맵)](#1-실행-계획-phase별-로드맵)
2. [구현 가이드 (코드 예제)](#2-구현-가이드-코드-예제)
3. [Firebase 인덱스 설정](#3-firebase-인덱스-설정)
4. [Cloud Functions 구현](#4-cloud-functions-구현)
5. [비용 모니터링 시스템](#5-비용-모니터링-시스템)
6. [베스트 프랙티스](#6-베스트-프랙티스)
7. [체크리스트](#7-체크리스트)

---

## 1. 실행 계획 (Phase별 로드맵)

### 📅 Phase 1: Quick Wins (1-2일) - 예상 절감 60%

**목표**: 즉시 적용 가능한 최적화로 월 $0.33 절감

#### 우선순위 1: App.tsx 최적화 (4-5시간)

**Task 1.1: 사용자 목록 React Query 마이그레이션 (2시간)**
- [ ] `hooks/useUsers.ts` 파일 생성
- [ ] React Query hook 구현
- [ ] App.tsx에서 기존 onSnapshot 제거
- [ ] 새 hook으로 교체
- [ ] 테스트: 사용자 목록 정상 로드 확인

**예상 절감**: $0.023/월

**Task 1.2: 이벤트 쿼리 범위 제한 (1시간)**
- [ ] `hooks/useEvents.ts` 파일 생성
- [ ] 날짜 범위 제한 로직 구현 (±3개월)
- [ ] App.tsx에서 적용
- [ ] 테스트: 캘린더 이벤트 정상 표시 확인

**예상 절감**: $0.288/월

**Task 1.3: Bucket Items React Query 적용 (1시간)**
- [ ] `hooks/useBucketItems.ts` 파일 생성
- [ ] 사용자 필터링 추가 (`where('userId', '==', userId)`)
- [ ] App.tsx에서 적용
- [ ] 테스트: 본인 버킷 아이템만 표시 확인

**예상 절감**: $0.016/월

**Task 1.4: Task Memos 쿼리 최적화 (1시간)**
- [ ] App.tsx의 Task Memos 쿼리에 서버 측 필터링 추가
- [ ] Firebase Console에서 복합 인덱스 생성
- [ ] 테스트: 메모 정상 로드 확인

**예상 절감**: $0.005/월

**Phase 1 총 절감**: $0.332/월 (-62%)

---

#### 우선순위 2: useGanttTemplates 최적화 (3시간)

**Task 2.1: 쿼리 수 축소 (2시간)**
- [ ] `hooks/useGanttTemplates.ts` 수정
- [ ] 7개 쿼리 → 2개로 축소
- [ ] 중복 제거 로직 개선
- [ ] 테스트: 간트 템플릿 목록 정상 확인

**Task 2.2: 캐싱 최적화 (30분)**
- [ ] staleTime 10분으로 증가
- [ ] refetchOnMount, refetchOnReconnect 비활성화
- [ ] 테스트: 캐싱 동작 확인

**예상 절감**: $0.050/월

---

**Phase 1 총 소요 시간**: 7-8시간
**Phase 1 총 절감액**: $0.382/월 (-72%)

---

### 📅 Phase 2: 구조 개선 (3-5일) - 추가 절감 15%

**목표**: Cloud Functions 및 아키텍처 개선으로 추가 $0.05 절감

#### 우선순위 3: Cloud Functions 구현 (4-6시간)

**Task 3.1: Firebase Functions 프로젝트 설정 (1시간)**
```bash
# Firebase CLI 설치 (이미 설치되어 있을 수 있음)
npm install -g firebase-tools

# Functions 초기화
firebase init functions

# TypeScript 선택
# ESLint 활성화
```

**Task 3.2: EnglishClassTab 통계 사전 계산 Function (2시간)**
- [ ] `functions/src/index.ts`에 `updateEnglishClassStats` 함수 추가
- [ ] 학생 추가/수정 시 자동 통계 계산 로직 구현
- [ ] 배포: `firebase deploy --only functions`
- [ ] 테스트: 학생 정보 변경 시 통계 자동 업데이트 확인

**Task 3.3: 클라이언트 코드 수정 (1시간)**
- [ ] `hooks/useClassStats.ts` 파일 생성
- [ ] 사전 계산된 통계 조회 hook 구현
- [ ] EnglishClassTab에서 적용
- [ ] 테스트: 통계 정상 표시 확인

**예상 절감**: $0.008/월

---

#### 우선순위 4: Timetable & Settings 통합 (2-3시간)

**Task 4.1: TimetableManager React Query 적용 (2시간)**
- [ ] `hooks/useClasses.ts` 파일 생성
- [ ] 과목별 필터링 지원
- [ ] TimetableManager에서 적용
- [ ] 테스트: 시간표 정상 로드 확인

**Task 4.2: SettingsModal 리스너 제거 (1시간)**
- [ ] 기존 3개 useEffect 제거
- [ ] useFirebaseQueries hooks로 교체
- [ ] 테스트: 설정 모달 정상 동작 확인

**예상 절감**: $0.017/월

---

**Phase 2 총 소요 시간**: 6-9시간
**Phase 2 총 절감액**: $0.025/월 (추가 -5%)

---

### 📅 Phase 3: 고급 최적화 (1-2주) - 추가 절감 5%

**목표**: 장기적 안정성 및 확장성 확보

#### Task 5.1: 복합 인덱스 생성 (1시간)
- [ ] Firebase Console에서 필요 인덱스 모두 생성
- [ ] 인덱스 빌드 완료 대기
- [ ] 쿼리 성능 개선 확인

#### Task 5.2: 페이지네이션 구현 (8시간)
- [ ] `hooks/usePaginatedQuery.ts` 헬퍼 생성
- [ ] 주요 목록 뷰에 무한 스크롤 적용
- [ ] 테스트: 페이지네이션 동작 확인

#### Task 5.3: 비용 모니터링 대시보드 (8시간)
- [ ] `utils/firestoreCostTracker.ts` 구현
- [ ] 개발 모드에서 비용 추적 활성화
- [ ] 월간 리포트 자동 생성

#### Task 5.4: 오래된 데이터 아카이빙 (16시간)
- [ ] Cloud Function으로 자동 아카이빙 구현
- [ ] 2년 이상 된 이벤트 별도 컬렉션 이동
- [ ] 아카이브 데이터 조회 UI 추가

---

**Phase 3 총 소요 시간**: 33시간 (1-2주)
**Phase 3 총 절감액**: $0.007/월 (추가 -1%)

---

## 2. 구현 가이드 (코드 예제)

### 2.1 App.tsx 최적화

#### Step 1: hooks/useUsers.ts 생성

```typescript
// hooks/useUsers.ts (새 파일)
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UserProfile } from '../types';

export const useUsers = (options: {
    status?: 'approved' | 'pending' | 'all';
    enabled?: boolean;
} = {}) => {
    const { status = 'approved', enabled = true } = options;

    return useQuery({
        queryKey: ['users', status],
        queryFn: async () => {
            let q = query(collection(db, 'users'), limit(100));

            // 승인된 사용자만 조회 (기본값)
            if (status !== 'all') {
                q = query(
                    collection(db, 'users'),
                    where('status', '==', status),
                    limit(100)
                );
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as UserProfile);
        },
        staleTime: 1000 * 60 * 10, // 10분 캐싱
        gcTime: 1000 * 60 * 30, // 30분 메모리 유지
        refetchOnWindowFocus: false,
        enabled,
    });
};
```

#### Step 2: App.tsx 수정

```typescript
// App.tsx (수정)

// ❌ 삭제할 코드 (Line 321-326)
/*
useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const loadUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
        setUsers(loadUsers);
    });
    return () => unsubscribe();
}, []);
*/

// ✅ 추가할 코드
import { useUsers } from './hooks/useUsers';

// 컴포넌트 내부
const { data: users = [] } = useUsers({ status: 'approved' });

// setUsers 호출 제거 - users는 자동으로 업데이트됨
```

---

#### Step 3: hooks/useEvents.ts 생성

```typescript
// hooks/useEvents.ts (새 파일)
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, subMonths, addMonths } from 'date-fns';
import { db } from '../firebaseConfig';
import { eventConverter } from '../converters';
import { CalendarEvent } from '../types';

export const useEvents = (options: {
    startDate: string;
    endDate: string;
    departmentIds?: string[];
    enabled?: boolean;
}) => {
    const { startDate, endDate, departmentIds, enabled = true } = options;

    return useQuery({
        queryKey: ['events', startDate, endDate, departmentIds],
        queryFn: async () => {
            // 날짜 범위 쿼리 (시작일 기준)
            let q = query(
                collection(db, "일정").withConverter(eventConverter),
                where("시작일", ">=", startDate),
                where("시작일", "<=", endDate),
                orderBy("시작일", "desc"),
                limit(200) // 최대 200개로 제한
            );

            const snapshot = await getDocs(q);
            let events = snapshot.docs.map(doc => doc.data());

            // 부서 필터링 (클라이언트 측)
            if (departmentIds && departmentIds.length > 0) {
                events = events.filter(e => departmentIds.includes(e.부서id));
            }

            return events;
        },
        staleTime: 1000 * 60 * 2, // 2분 캐싱 (실시간성 유지)
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: false,
        enabled,
    });
};

// 실시간 리스너가 정말 필요한 경우 (선택적)
export const useRealtimeEvents = (
    enabled: boolean,
    startDate: string,
    endDate: string
) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        if (!enabled) return;

        const q = query(
            collection(db, "일정").withConverter(eventConverter),
            where("시작일", ">=", startDate),
            where("시작일", "<=", endDate),
            limit(200)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEvents(snapshot.docs.map(doc => doc.data()));
        });

        return () => unsubscribe();
    }, [enabled, startDate, endDate]);

    return events;
};
```

#### Step 4: App.tsx에서 useEvents 적용

```typescript
// App.tsx (수정)
import { useEvents } from './hooks/useEvents';
import { format, subMonths, addMonths } from 'date-fns';
import { useMemo } from 'react';

// ❌ 삭제할 코드 (Line 405-420)
/*
useEffect(() => {
    const queryStartDate = format(subYears(new Date(), lookbackYears), 'yyyy-MM-dd');
    const q = query(...);
    const unsubscribe = onSnapshot(q, ...);
    return () => unsubscribe();
}, [lookbackYears]);
*/

// ✅ 추가할 코드
// 현재 보기 범위 계산 (캘린더 현재 월 ±3개월)
const currentView = useMemo(() => {
    const today = new Date();
    return {
        startDate: format(subMonths(today, 3), 'yyyy-MM-dd'),
        endDate: format(addMonths(today, 3), 'yyyy-MM-dd')
    };
}, []); // 페이지 로드 시 1회만 계산

const { data: events = [] } = useEvents({
    startDate: currentView.startDate,
    endDate: currentView.endDate,
    departmentIds: selectedDepartmentIds
});

// setEvents 호출 제거 - events는 자동으로 업데이트됨
```

---

#### Step 5: hooks/useBucketItems.ts 생성

```typescript
// hooks/useBucketItems.ts (새 파일)
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { BucketItem } from '../types';

export const useBucketItems = (userId: string | undefined) => {
    return useQuery({
        queryKey: ['bucketItems', userId],
        queryFn: async () => {
            if (!userId) return [];

            // 본인의 아이템만 조회
            const q = query(
                collection(db, "bucketItems"),
                where('userId', '==', userId),
                orderBy("createdAt", "desc"),
                limit(50) // 최근 50개만
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BucketItem[];
        },
        staleTime: 1000 * 60 * 5, // 5분 캐싱
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        enabled: !!userId,
    });
};
```

#### Step 6: App.tsx에서 useBucketItems 적용

```typescript
// App.tsx (수정)
import { useBucketItems } from './hooks/useBucketItems';

// ❌ 삭제할 코드 (Line 435-445)
/*
useEffect(() => {
    const q = query(collection(db, "bucketItems"), ...);
    const unsubscribe = onSnapshot(q, ...);
    return () => unsubscribe();
}, []);
*/

// ✅ 추가할 코드
const { data: bucketItems = [] } = useBucketItems(currentUser?.uid);

// setBucketItems 호출 제거
```

---

#### Step 7: Task Memos 쿼리 최적화

```typescript
// App.tsx (수정)

// ❌ 기존 코드 (Line 456-480)
/*
const q = query(
    collection(db, "taskMemos"),
    where("to", "==", currentUser.uid)
);
const unsubscribe = onSnapshot(q, (snapshot) => {
    const memos = snapshot.docs.map(...);
    const sortedMemos = memos
        .filter(m => !m.isDeleted)  // ❌ 클라이언트 필터링
        .sort(...);  // ❌ 클라이언트 정렬
    setTaskMemos(sortedMemos);
});
*/

// ✅ 개선 코드
useEffect(() => {
    if (!currentUser) {
        setTaskMemos([]);
        return;
    }

    const q = query(
        collection(db, "taskMemos"),
        where("to", "==", currentUser.uid),
        where("isDeleted", "==", false), // ✅ 서버 측 필터링
        orderBy("createdAt", "desc"), // ✅ 서버 측 정렬
        limit(50) // ✅ 최근 50개만
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const memos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as TaskMemo[];

        setTaskMemos(memos); // 필터링/정렬 불필요
    });

    return () => unsubscribe();
}, [currentUser]);
```

---

### 2.2 useGanttTemplates 최적화

```typescript
// hooks/useGanttTemplates.ts (수정)

export const useGanttTemplates = (options: UseGanttTemplatesOptions) => {
    const { userId, userProfile, userDepartments } = options;

    return useQuery({
        queryKey: ['ganttTemplates', userId],
        queryFn: async () => {
            if (!userId) return [];

            // Master/Admin: 단일 쿼리
            if (userProfile && ['master', 'admin'].includes(userProfile.role)) {
                const q = query(
                    collection(db, 'gantt_templates'),
                    where('isArchived', '!=', true),
                    orderBy('isArchived'),
                    orderBy('createdAt', 'desc'),
                    limit(200) // 페이지네이션
                );
                const snapshot = await getDocs(q);
                return snapshot.docs.map(normalizeTemplate);
            }

            // ✅ 일반 사용자: 7개 → 2개 쿼리로 축소
            const [myProjects, publicProjects] = await Promise.all([
                // 1. 내가 생성한 프로젝트
                getDocs(query(
                    collection(db, 'gantt_templates'),
                    where('createdBy', '==', userId),
                    orderBy('createdAt', 'desc')
                )),

                // 2. 공개 프로젝트만
                getDocs(query(
                    collection(db, 'gantt_templates'),
                    where('visibility', 'in', ['public']),
                    orderBy('createdAt', 'desc'),
                    limit(100)
                ))
            ]);

            // 중복 제거
            const uniqueProjects = new Map<string, GanttTemplate>();
            [...myProjects.docs, ...publicProjects.docs].forEach(doc => {
                if (!uniqueProjects.has(doc.id)) {
                    uniqueProjects.set(doc.id, normalizeTemplate(doc));
                }
            });

            // 클라이언트 측 멤버십 필터링
            return Array.from(uniqueProjects.values()).filter(project => {
                if (project.isArchived) return false;

                // 권한 체크
                const access = checkProjectAccess(
                    project,
                    userProfile,
                    userDepartments
                );
                return access.canView;
            });
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 10, // ✅ 10분으로 증가 (기존 5분)
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false, // ✅ 재연결 시 자동 재조회 비활성화
        refetchOnMount: false, // ✅ 마운트 시 재조회 비활성화
    });
};
```

---

### 2.3 TimetableManager & SettingsModal 최적화

#### hooks/useClasses.ts 생성

```typescript
// hooks/useClasses.ts (새 파일)
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TimetableClass } from '../types';

export const useClasses = (subject?: string) => {
    return useQuery({
        queryKey: ['classes', subject],
        queryFn: async () => {
            let q = query(
                collection(db, 'classes'),
                orderBy('subject')
            );

            // 과목별 필터링 (선택적)
            if (subject) {
                q = query(
                    collection(db, 'classes'),
                    where('subject', '==', subject),
                    orderBy('subject')
                );
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TimetableClass));
        },
        staleTime: 1000 * 60 * 5, // 5분 캐싱
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });
};
```

#### TimetableManager.tsx 수정

```typescript
// components/Timetable/TimetableManager.tsx (수정)
import { useClasses } from '../../hooks/useClasses';

// ❌ 삭제할 코드 (Line 328)
/*
useEffect(() => {
    const q = query(collection(db, 'classes'), orderBy('subject'));
    const unsubscribe = onSnapshot(q, ...);
    return () => unsubscribe();
}, []);
*/

// ✅ 추가할 코드
const { data: classes = [], isLoading } = useClasses();

// setClasses, setLoading 호출 제거
```

#### SettingsModal.tsx 수정

```typescript
// components/SettingsModal.tsx (수정)
import { useSystemConfig, useClassKeywords, useRolePermissions } from '../hooks/useFirebaseQueries';

// ❌ 삭제할 코드 (3개 useEffect 모두 제거)
/*
useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'system', 'config'), ...);
    return () => unsubscribe();
}, [isOpen]);

useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'classKeywords'), ...);
    return () => unsubscribe();
}, [isOpen]);

useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'rolePermissions'), ...);
    return () => unsubscribe();
}, [isOpen]);
*/

// ✅ 추가할 코드 (hooks/useFirebaseQueries.ts에 이미 존재)
const { data: systemConfig } = useSystemConfig(isOpen);
const { data: classKeywords } = useClassKeywords(isOpen);
const { data: rolePermissions } = useRolePermissions(isOpen);

// 각종 setState 호출 제거
```

---

## 3. Firebase 인덱스 설정

### 3.1 필요한 복합 인덱스

Firebase Console에서 아래 인덱스를 생성하세요.

**방법 1: Firebase Console에서 수동 생성**
1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택
3. Firestore Database → 인덱스 탭
4. "인덱스 만들기" 클릭

**방법 2: 자동 링크 클릭**
- 쿼리 실행 시 Firebase가 자동으로 인덱스 생성 링크 제공
- 콘솔에 표시된 링크 클릭하여 자동 생성

---

#### 인덱스 1: Task Memos (to + isDeleted + createdAt)

```javascript
Collection ID: taskMemos
Fields indexed:
  - to (Ascending)
  - isDeleted (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

**사용 쿼리**:
```typescript
query(
    collection(db, "taskMemos"),
    where("to", "==", currentUser.uid),
    where("isDeleted", "==", false),
    orderBy("createdAt", "desc")
)
```

---

#### 인덱스 2: 이벤트 날짜 범위 (시작일 + 부서id)

```javascript
Collection ID: 일정
Fields indexed:
  - 시작일 (Ascending)
  - 부서id (Ascending)
Query scope: Collection
```

**사용 쿼리**:
```typescript
query(
    collection(db, "일정"),
    where("시작일", ">=", startDate),
    where("시작일", "<=", endDate),
    where("부서id", "in", departmentIds) // 필요 시
)
```

---

#### 인덱스 3: Gantt Templates (visibility + createdAt)

```javascript
Collection ID: gantt_templates
Fields indexed:
  - visibility (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

**사용 쿼리**:
```typescript
query(
    collection(db, 'gantt_templates'),
    where('visibility', 'in', ['public']),
    orderBy('createdAt', 'desc')
)
```

---

#### 인덱스 4: Gantt Templates (isArchived + createdAt)

```javascript
Collection ID: gantt_templates
Fields indexed:
  - isArchived (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

**사용 쿼리**:
```typescript
query(
    collection(db, 'gantt_templates'),
    where('isArchived', '!=', true),
    orderBy('isArchived'),
    orderBy('createdAt', 'desc')
)
```

---

#### 인덱스 5: Bucket Items (userId + createdAt)

```javascript
Collection ID: bucketItems
Fields indexed:
  - userId (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

**사용 쿼리**:
```typescript
query(
    collection(db, "bucketItems"),
    where('userId', '==', userId),
    orderBy("createdAt", "desc")
)
```

---

### 3.2 인덱스 생성 명령어 (Firebase CLI)

**firestore.indexes.json** 파일 생성:

```json
{
  "indexes": [
    {
      "collectionGroup": "taskMemos",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "to", "order": "ASCENDING" },
        { "fieldPath": "isDeleted", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "일정",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "시작일", "order": "ASCENDING" },
        { "fieldPath": "부서id", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gantt_templates",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "visibility", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "gantt_templates",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isArchived", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "bucketItems",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**배포 명령어**:
```bash
firebase deploy --only firestore:indexes
```

---

## 4. Cloud Functions 구현

### 4.1 Firebase Functions 프로젝트 초기화

```bash
# Firebase CLI 설치 (이미 설치되어 있을 수 있음)
npm install -g firebase-tools

# 로그인
firebase login

# Functions 초기화
firebase init functions

# 선택 사항:
# - Language: TypeScript
# - ESLint: Yes
# - Install dependencies: Yes
```

---

### 4.2 EnglishClassTab 통계 사전 계산 Function

**functions/src/index.ts** 파일 수정:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * 영어 반 학생 정보 변경 시 통계 자동 계산
 * 트리거: english_classes 컬렉션의 문서 생성/수정/삭제
 */
export const updateEnglishClassStats = functions.firestore
    .document('english_classes/{classId}')
    .onWrite(async (change, context) => {
        const classId = context.params.classId;

        // 문서 삭제된 경우
        if (!change.after.exists()) {
            console.log(`Class ${classId} deleted, skipping stats update`);
            return;
        }

        const students = change.after.data()?.studentList || [];
        const now = new Date();

        // 통계 계산
        const stats = {
            active: 0,
            new1: 0,
            new2: 0,
            withdrawn: 0,
            lastUpdated: admin.firestore.Timestamp.now()
        };

        students.forEach((student: any) => {
            // 탈퇴한 학생 처리
            if (student.withdrawalDate) {
                const daysSince = Math.floor(
                    (now.getTime() - new Date(student.withdrawalDate).getTime())
                    / (1000 * 60 * 60 * 24)
                );
                if (daysSince <= 30) {
                    stats.withdrawn++;
                }
                return;
            }

            // 휴원 중인 학생 제외
            if (student.onHold) return;

            // 활성 학생
            stats.active++;

            // 신규 학생 분류
            if (student.enrollmentDate) {
                const daysSince = Math.floor(
                    (now.getTime() - new Date(student.enrollmentDate).getTime())
                    / (1000 * 60 * 60 * 24)
                );
                if (daysSince <= 30) {
                    stats.new1++;
                } else if (daysSince <= 60) {
                    stats.new2++;
                }
            }
        });

        // 통계를 문서에 저장 (merge)
        await change.after.ref.set({ stats }, { merge: true });

        console.log(`Updated stats for class ${classId}:`, stats);
    });

/**
 * 시뮬레이션 모드 반 통계 계산
 * 트리거: english_classes_draft 컬렉션
 */
export const updateEnglishClassDraftStats = functions.firestore
    .document('english_classes_draft/{classId}')
    .onWrite(async (change, context) => {
        // 동일한 로직 사용
        return updateEnglishClassStats(change as any, context);
    });
```

---

### 4.3 클라이언트 코드 (통계 조회)

**hooks/useClassStats.ts** 파일 생성:

```typescript
// hooks/useClassStats.ts (새 파일)
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const CLASS_COLLECTION = 'english_classes';
const CLASS_DRAFT_COLLECTION = 'english_classes_draft';

export const useClassStats = (isSimulationMode: boolean) => {
    return useQuery({
        queryKey: ['classStats', isSimulationMode],
        queryFn: async () => {
            const targetCollection = isSimulationMode
                ? CLASS_DRAFT_COLLECTION
                : CLASS_COLLECTION;

            // 모든 반의 통계 합산
            const snapshot = await getDocs(collection(db, targetCollection));

            const totalStats = {
                active: 0,
                new1: 0,
                new2: 0,
                withdrawn: 0
            };

            snapshot.docs.forEach(doc => {
                const stats = doc.data().stats || {};
                totalStats.active += stats.active || 0;
                totalStats.new1 += stats.new1 || 0;
                totalStats.new2 += stats.new2 || 0;
                totalStats.withdrawn += stats.withdrawn || 0;
            });

            return totalStats;
        },
        staleTime: 1000 * 60 * 5, // 5분 캐싱
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });
};
```

**EnglishClassTab.tsx 수정**:

```typescript
// components/Timetable/English/EnglishClassTab.tsx (수정)
import { useClassStats } from '../../../hooks/useClassStats';

// ❌ 삭제할 코드 (Line 155-221: 실시간 배치 구독)
/*
batches.forEach((batch) => {
    const q = query(...);
    const unsub = onSnapshot(q, ...);
    unsubscribes.push(unsub);
});
*/

// ✅ 추가할 코드
const { data: stats = { active: 0, new1: 0, new2: 0, withdrawn: 0 } } = useClassStats(isSimulationMode);

// 통계 표시
return (
    <div>
        <div>활성: {stats.active}</div>
        <div>신규1: {stats.new1}</div>
        <div>신규2: {stats.new2}</div>
        <div>탈퇴: {stats.withdrawn}</div>
    </div>
);
```

---

### 4.4 Cloud Functions 배포

```bash
# Functions 배포
cd functions
npm install
cd ..
firebase deploy --only functions

# 특정 함수만 배포
firebase deploy --only functions:updateEnglishClassStats

# 로그 확인
firebase functions:log
```

---

## 5. 비용 모니터링 시스템

### 5.1 개발 모드 비용 추적기

**utils/firestoreCostTracker.ts** 파일 생성:

```typescript
// utils/firestoreCostTracker.ts (새 파일)

export class FirestoreCostTracker {
    private static instance: FirestoreCostTracker;
    private reads = 0;
    private writes = 0;
    private deletes = 0;
    private startTime = new Date();

    private constructor() {}

    static getInstance() {
        if (!FirestoreCostTracker.instance) {
            FirestoreCostTracker.instance = new FirestoreCostTracker();
        }
        return FirestoreCostTracker.instance;
    }

    trackRead(count = 1, source?: string) {
        this.reads += count;
        if (import.meta.env.DEV) {
            console.log(`📖 Firestore Read: +${count} (Total: ${this.reads})${source ? ` - ${source}` : ''}`);
        }
    }

    trackWrite(count = 1, source?: string) {
        this.writes += count;
        if (import.meta.env.DEV) {
            console.log(`✍️ Firestore Write: +${count} (Total: ${this.writes})${source ? ` - ${source}` : ''}`);
        }
    }

    trackDelete(count = 1, source?: string) {
        this.deletes += count;
        if (import.meta.env.DEV) {
            console.log(`🗑️ Firestore Delete: +${count} (Total: ${this.deletes})${source ? ` - ${source}` : ''}`);
        }
    }

    getReport() {
        const sessionDuration = (new Date().getTime() - this.startTime.getTime()) / 1000 / 60; // 분

        // Firestore 가격 (2026년 기준)
        const readCost = (this.reads / 100000) * 0.06;
        const writeCost = (this.writes / 100000) * 0.18;
        const deleteCost = (this.deletes / 100000) * 0.02;
        const totalCost = readCost + writeCost + deleteCost;

        return {
            sessionDuration: sessionDuration.toFixed(1) + ' 분',
            reads: this.reads,
            writes: this.writes,
            deletes: this.deletes,
            totalCost: totalCost.toFixed(4),
            monthlyCost: (totalCost * 30 * (24 * 60 / sessionDuration)).toFixed(2), // 예상 월 비용
            breakdown: {
                readCost: readCost.toFixed(4),
                writeCost: writeCost.toFixed(4),
                deleteCost: deleteCost.toFixed(4)
            }
        };
    }

    printReport() {
        const report = this.getReport();
        console.log('\n📊 Firestore 비용 리포트');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`세션 시간: ${report.sessionDuration}`);
        console.log(`읽기: ${report.reads}회 ($${report.breakdown.readCost})`);
        console.log(`쓰기: ${report.writes}회 ($${report.breakdown.writeCost})`);
        console.log(`삭제: ${report.deletes}회 ($${report.breakdown.deleteCost})`);
        console.log(`현재 세션 비용: $${report.totalCost}`);
        console.log(`예상 월 비용: $${report.monthlyCost}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    reset() {
        this.reads = 0;
        this.writes = 0;
        this.deletes = 0;
        this.startTime = new Date();
        console.log('🔄 Firestore 비용 추적기 리셋');
    }
}

// 개발 모드에서 window 객체에 추가
if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).firestoreCost = FirestoreCostTracker.getInstance();
}
```

---

### 5.2 React Query에서 비용 추적

**hooks/useFirebaseQueries.ts** 수정 (모든 쿼리에 적용):

```typescript
// hooks/useFirebaseQueries.ts (수정)
import { FirestoreCostTracker } from '../utils/firestoreCostTracker';

const costTracker = FirestoreCostTracker.getInstance();

export const useSystemConfig = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['systemConfig'],
        queryFn: async () => {
            const snapshot = await getDoc(doc(db, 'system', 'config'));

            // 비용 추적
            costTracker.trackRead(1, 'useSystemConfig');

            return snapshot.data() as SystemConfig;
        },
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
        refetchOnWindowFocus: false,
        enabled,
    });
};

// 다른 모든 쿼리에도 동일하게 적용
export const useEvents = (...) => {
    return useQuery({
        queryKey: ['events', ...],
        queryFn: async () => {
            const snapshot = await getDocs(q);

            // 비용 추적
            costTracker.trackRead(snapshot.size, 'useEvents');

            return snapshot.docs.map(...);
        },
        ...
    });
};
```

---

### 5.3 개발 중 사용법

**브라우저 콘솔에서**:

```javascript
// 현재 세션 비용 확인
window.firestoreCost.printReport();

// 비용 추적 리셋
window.firestoreCost.reset();

// 상세 정보 확인
window.firestoreCost.getReport();
```

---

### 5.4 Firebase Console 예산 알림 설정

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택
3. **Usage and billing** → **Details & Settings**
4. **Budgets & alerts** 클릭
5. 예산 설정:
   - **경고 (50%)**: $5/월
   - **위험 (80%)**: $8/월
   - **긴급 (100%)**: $10/월

6. 알림 이메일 추가

---

## 6. 베스트 프랙티스

### 6.1 DO ✅ (권장 사항)

#### 1. React Query 적극 활용
```typescript
// ✅ GOOD: 정적 데이터는 React Query
const { data: departments } = useDepartments();
const { data: teachers } = useTeachers();

// ❌ BAD: 정적 데이터를 실시간 구독
useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'departments'), ...);
}, []);
```

**적용 대상**:
- 부서, 강사, 휴일, 키워드
- 시스템 설정, 역할 권한
- 간트 템플릿, 카테고리
- 상담 기록

**캐싱 시간**:
- 거의 변경 안 됨: `staleTime: 1000 * 60 * 30` (30분)
- 가끔 변경: `staleTime: 1000 * 60 * 10` (10분)
- 자주 변경: `staleTime: 1000 * 60 * 5` (5분)
- 실시간성 필요: `staleTime: 1000 * 60 * 2` (2분)

---

#### 2. 실시간 리스너 제한적 사용
```typescript
// ✅ GOOD: 정말 실시간이 필요한 경우만
const useRealtimeNotifications = (userId: string) => {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('isRead', '==', false),
            limit(10) // 반드시 limit 사용
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotifications(snapshot.docs.map(...));
        });

        return () => unsubscribe();
    }, [userId]);

    return notifications;
};

// ❌ BAD: 전체 컬렉션 실시간 구독
useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'notifications'), ...);
}, []);
```

**실시간 구독이 필요한 경우**:
- 실시간 알림 (읽지 않은 메시지)
- 채팅 메시지
- 협업 문서 (동시 편집)

---

#### 3. 서버 측 필터링
```typescript
// ✅ GOOD: Firestore에서 필터링
const q = query(
    collection(db, 'events'),
    where('departmentId', '==', deptId),
    where('status', '==', 'active'),
    orderBy('startDate', 'desc'),
    limit(50)
);

// ❌ BAD: 클라이언트에서 필터링
const allEvents = await getDocs(collection(db, 'events'));
const filtered = allEvents.docs
    .filter(doc => doc.data().departmentId === deptId)
    .filter(doc => doc.data().status === 'active')
    .sort((a, b) => b.data().startDate - a.data().startDate)
    .slice(0, 50);
```

---

#### 4. 복합 인덱스 미리 생성
```typescript
// 복합 쿼리 사용 전에 인덱스 생성 확인
const q = query(
    collection(db, 'events'),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
);

// 필요 인덱스: status (Ascending) + createdAt (Descending)
```

---

#### 5. 배치 작업 사용
```typescript
// ✅ GOOD: writeBatch 사용
const batch = writeBatch(db);
events.forEach(event => {
    const ref = doc(collection(db, 'events'));
    batch.set(ref, event);
});
await batch.commit(); // 1회 쓰기 비용

// ❌ BAD: 개별 쓰기
for (const event of events) {
    await setDoc(doc(collection(db, 'events')), event); // N회 쓰기 비용
}
```

---

### 6.2 DON'T ❌ (피해야 할 사항)

#### 1. 전체 컬렉션 구독
```typescript
// ❌ BAD
onSnapshot(collection(db, 'users'), ...);

// ✅ GOOD
query(collection(db, 'users'), where('status', '==', 'active'), limit(100));
```

---

#### 2. 클라이언트 측 필터링/정렬
```typescript
// ❌ BAD
const snapshot = await getDocs(collection(db, 'events'));
const sorted = snapshot.docs
    .map(doc => doc.data())
    .filter(e => !e.isDeleted)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

// ✅ GOOD
const q = query(
    collection(db, 'events'),
    where('isDeleted', '==', false),
    orderBy('date', 'desc')
);
```

---

#### 3. 중복 쿼리
```typescript
// ❌ BAD: 같은 데이터를 여러 번 조회
const [result1, result2, result3] = await Promise.all([
    getDocs(query(collection(db, 'templates'), where('visibility', '==', 'public'))),
    getDocs(query(collection(db, 'templates'), where('isShared', '==', true))),
    getDocs(query(collection(db, 'templates'), where('status', '==', 'active')))
]);

// ✅ GOOD: 1번 조회 후 클라이언트 필터링 (데이터가 적을 때)
const templates = await getDocs(collection(db, 'templates'));
const filtered = templates.docs.filter(doc => {
    const data = doc.data();
    return data.visibility === 'public' || data.isShared || data.status === 'active';
});
```

---

#### 4. 인덱스 없는 복합 쿼리
```typescript
// ❌ BAD: 인덱스 없이 실행
const q = query(
    collection(db, 'events'),
    where('status', '==', 'active'),
    where('departmentId', '==', deptId),
    orderBy('startDate', 'desc')
);
// 에러: The query requires an index

// ✅ GOOD: 인덱스 먼저 생성 후 실행
```

---

#### 5. 페이지네이션 없는 무한 목록
```typescript
// ❌ BAD: 전체 데이터 로드
const allEvents = await getDocs(collection(db, 'events'));

// ✅ GOOD: 페이지네이션
const q = query(collection(db, 'events'), limit(20));
const firstPage = await getDocs(q);

// 다음 페이지
const nextQ = query(
    collection(db, 'events'),
    startAfter(lastVisible),
    limit(20)
);
```

---

## 7. 체크리스트

### 7.1 즉시 적용 (오늘 완료)

Phase 1 Quick Wins:

- [ ] **App.tsx 사용자 목록 최적화**
  - [ ] `hooks/useUsers.ts` 생성
  - [ ] App.tsx에서 적용
  - [ ] 테스트: 사용자 목록 정상 로드

- [ ] **App.tsx 이벤트 쿼리 최적화**
  - [ ] `hooks/useEvents.ts` 생성
  - [ ] 날짜 범위 제한 (±3개월)
  - [ ] App.tsx에서 적용
  - [ ] 테스트: 이벤트 정상 표시

- [ ] **Bucket Items React Query 적용**
  - [ ] `hooks/useBucketItems.ts` 생성
  - [ ] App.tsx에서 적용
  - [ ] 테스트: 본인 아이템만 표시

- [ ] **Task Memos 최적화**
  - [ ] App.tsx 쿼리 수정 (서버 측 필터링)
  - [ ] Firebase Console에서 인덱스 생성
  - [ ] 테스트: 메모 정상 로드

- [ ] **useGanttTemplates 쿼리 축소**
  - [ ] 7개 → 2개 쿼리로 수정
  - [ ] staleTime 10분으로 증가
  - [ ] 테스트: 템플릿 목록 정상 확인

**예상 절감**: $0.382/월 (-72%)

---

### 7.2 이번 주 완료

Phase 2 구조 개선:

- [ ] **Cloud Functions 구현**
  - [ ] Firebase Functions 프로젝트 초기화
  - [ ] `updateEnglishClassStats` 함수 구현
  - [ ] 배포 및 테스트
  - [ ] `hooks/useClassStats.ts` 생성
  - [ ] EnglishClassTab에서 적용

- [ ] **TimetableManager 최적화**
  - [ ] `hooks/useClasses.ts` 생성
  - [ ] TimetableManager에서 적용
  - [ ] 테스트: 시간표 정상 로드

- [ ] **SettingsModal 최적화**
  - [ ] 3개 실시간 리스너 제거
  - [ ] React Query hooks로 교체
  - [ ] 테스트: 설정 모달 정상 동작

**예상 절감**: $0.025/월 (추가 -5%)

---

### 7.3 이번 달 완료

Phase 3 고급 최적화:

- [ ] **복합 인덱스 생성**
  - [ ] taskMemos (to + isDeleted + createdAt)
  - [ ] 일정 (시작일 + 부서id)
  - [ ] gantt_templates (visibility + createdAt)
  - [ ] gantt_templates (isArchived + createdAt)
  - [ ] bucketItems (userId + createdAt)

- [ ] **페이지네이션 구현**
  - [ ] `hooks/usePaginatedQuery.ts` 생성
  - [ ] 주요 목록 뷰에 적용
  - [ ] 무한 스크롤 UI 추가

- [ ] **비용 모니터링**
  - [ ] `utils/firestoreCostTracker.ts` 구현
  - [ ] React Query에서 비용 추적 연동
  - [ ] Firebase 예산 알림 설정

- [ ] **데이터 아카이빙**
  - [ ] Cloud Function으로 자동 아카이빙
  - [ ] 2년 이상 된 데이터 별도 보관
  - [ ] 아카이브 조회 UI

**예상 절감**: $0.007/월 (추가 -1%)

---

## 📊 최종 요약

### 비용 절감 효과

| Phase | 소요 시간 | 절감액 (월) | 절감률 | 누적 절감 |
|-------|---------|------------|--------|----------|
| Phase 1 | 1-2일 | $0.382 | -72% | $0.382 |
| Phase 2 | 3-5일 | $0.025 | -5% | $0.407 |
| Phase 3 | 1-2주 | $0.007 | -1% | $0.414 |
| **총계** | **2-3주** | **$0.414** | **-78%** | **$0.414** |

### 연간 절감액
```
현재 비용:    $0.534/월 × 12개월 = $6.41/년
최적화 후:    $0.120/월 × 12개월 = $1.44/년

절감액:       $4.97/년 (-77%)
```

### 무료 할당량 안전 마진 확보
```
현재:      889,000회/월 (59% 사용) ⚠️ 경고
최적화 후:  198,500회/월 (13% 사용) ✅ 안전
```

### 사용자 확장성
```
현재 아키텍처:  20명 이상 시 유료 전환
최적화 후:      100명까지 무료 범위 가능
```

---

## 🎯 다음 단계

1. **즉시 시작**: Phase 1 Quick Wins부터 시작
2. **단계별 적용**: 한 번에 하나씩 테스트하며 적용
3. **비용 모니터링**: 각 단계마다 Firebase Usage 확인
4. **성능 측정**: 최적화 전후 성능 비교
5. **문서화**: 변경사항 기록 및 팀 공유

---

**작성 완료**: 2026-01-05
**다음 리뷰**: Phase 1 완료 후 (1주일 후)
**문의**: Firebase 최적화 관련 문의는 개발팀 회의에서 논의

---

**이전 문서**: [Firebase 비용 최적화 Part 1 - 현황 분석](./firebase_cost_optimization_part1_현황분석.md)
