# 간트 차트 Firebase 연동 구현 계획 (Phase 4-5)

> 작성일: 2026-01-02
> 상태: **✅ 구현 완료**
> 우선순위: 🔴 높음
> 버전: v2.0

---

## 📋 개요

### 목표
간트 차트 기능의 localStorage를 Firestore로 마이그레이션하여 다음을 달성:
- 다중 기기/브라우저 동기화
- 팀원 간 템플릿 공유
- 데이터 영구 보존 및 백업
- 권한 기반 접근 제어

### 현재 상황
- ✅ Phase 1-3 완료 (컴포넌트 통합)
- ❌ Phase 4-5 미완료 (Firebase 연동)
- 📍 현재 localStorage 기반으로 작동 중

---

## 🎯 Phase 4: Firestore 연동

### 4.1 Firestore 컬렉션 설계

#### gantt_templates (템플릿 저장소)

```typescript
interface FirestoreGanttTemplate {
  id: string;                  // Firestore document ID
  title: string;               // 템플릿 이름
  description: string;         // 템플릿 설명
  tasks: GanttSubTask[];       // 작업 목록
  createdAt: Timestamp;        // 생성 시간
  createdBy: string;           // 작성자 UID
  createdByEmail: string;      // 작성자 이메일
  isShared: boolean;           // 공유 여부 (팀 전체에 공개)
  lastModified?: Timestamp;    // 마지막 수정 시간
}
```

**인덱스 필요:**
- `createdBy` (단일)
- `isShared` (단일)
- `createdAt` (단일, 정렬용)

#### gantt_projects (진행 중인 프로젝트)

```typescript
interface FirestoreGanttProject {
  id: string;                  // Firestore document ID
  templateId: string;          // 원본 템플릿 ID (참조)
  title: string;               // 프로젝트 이름
  tasks: GanttSubTask[];       // 현재 진행 상태 포함
  progress: number;            // 진행률 0-100
  startedAt: Timestamp;        // 프로젝트 시작 시간
  lastUpdated: Timestamp;      // 마지막 업데이트 시간
  ownerId: string;             // 담당자 UID
  ownerEmail: string;          // 담당자 이메일
  status: 'active' | 'completed' | 'paused';  // 프로젝트 상태
  completedAt?: Timestamp;     // 완료 시간 (선택)
}
```

**인덱스 필요:**
- `ownerId` (단일)
- `status` (단일)
- `lastUpdated` (단일, 정렬용)

---

### 4.2 서비스 파일 구현

#### 파일: `hooks/useGanttTemplates.ts`

React Query 패턴 사용 (기존 useFirebaseQueries.ts 참고)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GanttTemplate } from '../types';

// 템플릿 목록 조회 (내 템플릿 + 공유된 템플릿)
export const useGanttTemplates = (userId?: string) => {
  return useQuery({
    queryKey: ['ganttTemplates', userId],
    queryFn: async () => {
      if (!userId) return [];

      // 내 템플릿 + 공유된 템플릿
      const q = query(
        collection(db, 'gantt_templates'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const templates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toMillis() || Date.now()
      } as GanttTemplate));

      // 필터링: 내가 만든 것 또는 공유된 것
      return templates.filter(t =>
        t.createdBy === userId || t.isShared === true
      );
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 30, // 30분
  });
};

// 템플릿 생성
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<GanttTemplate, 'id' | 'createdAt'>) => {
      const docRef = await addDoc(collection(db, 'gantt_templates'), {
        ...template,
        createdAt: Timestamp.now(),
        lastModified: Timestamp.now(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTemplates'] });
    },
  });
};

// 템플릿 수정
export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GanttTemplate> }) => {
      const docRef = doc(db, 'gantt_templates', id);
      await updateDoc(docRef, {
        ...updates,
        lastModified: Timestamp.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTemplates'] });
    },
  });
};

// 템플릿 삭제
export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await deleteDoc(doc(db, 'gantt_templates', templateId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttTemplates'] });
    },
  });
};
```

---

#### 파일: `hooks/useGanttProjects.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GanttProject, GanttSubTask } from '../types';

// 내 프로젝트 목록 조회
export const useGanttProjects = (userId?: string) => {
  return useQuery({
    queryKey: ['ganttProjects', userId],
    queryFn: async () => {
      if (!userId) return [];

      const q = query(
        collection(db, 'gantt_projects'),
        where('ownerId', '==', userId),
        orderBy('lastUpdated', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startedAt: doc.data().startedAt?.toMillis() || Date.now(),
        lastUpdated: doc.data().lastUpdated?.toMillis() || Date.now(),
        completedAt: doc.data().completedAt?.toMillis() || undefined
      } as GanttProject));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2분
    gcTime: 1000 * 60 * 10, // 10분
  });
};

// 프로젝트 생성 (템플릿에서 시작)
export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (project: Omit<GanttProject, 'id' | 'startedAt' | 'lastUpdated'>) => {
      const docRef = await addDoc(collection(db, 'gantt_projects'), {
        ...project,
        startedAt: Timestamp.now(),
        lastUpdated: Timestamp.now(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttProjects'] });
    },
  });
};

// 프로젝트 업데이트 (작업 완료 토글 등)
export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GanttProject> }) => {
      const docRef = doc(db, 'gantt_projects', id);
      await updateDoc(docRef, {
        ...updates,
        lastUpdated: Timestamp.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttProjects'] });
    },
  });
};

// 프로젝트 삭제
export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await deleteDoc(doc(db, 'gantt_projects', projectId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ganttProjects'] });
    },
  });
};
```

---

### 4.3 GanttManager 리팩토링

#### 변경 사항

**Before (localStorage):**
```typescript
// Load from localStorage
useEffect(() => {
  const savedTemplates = localStorage.getItem('custom-gantt-templates');
  if (savedTemplates) {
    setTemplates(JSON.parse(savedTemplates));
  }
}, []);

// Save to localStorage
const saveNewTemplate = (newTemplate: GanttTemplate) => {
  const updatedTemplates = [newTemplate, ...templates];
  setTemplates(updatedTemplates);
  localStorage.setItem('custom-gantt-templates', JSON.stringify(updatedTemplates));
};
```

**After (Firestore):**
```typescript
import { useGanttTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '../../hooks/useGanttTemplates';

const GanttManager: React.FC<GanttManagerProps> = ({ userProfile }) => {
  const { data: templates = [], isLoading } = useGanttTemplates(userProfile?.uid);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const saveNewTemplate = (newTemplate: GanttTemplate) => {
    createTemplate.mutate({
      ...newTemplate,
      createdBy: userProfile?.uid || '',
      createdByEmail: userProfile?.email || '',
    });
    setViewMode('home');
  };

  const handleUpdateTemplate = (updatedTemplate: GanttTemplate) => {
    updateTemplate.mutate({
      id: updatedTemplate.id,
      updates: updatedTemplate,
    });
    setViewMode('home');
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm("정말로 이 템플릿을 삭제하시겠습니까?")) {
      deleteTemplate.mutate(templateId);
    }
  };

  // Loading state
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // ... rest of component
};
```

---

## 🔒 Phase 5: Security Rules

### 5.1 firestore.rules 업데이트

파일: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // === Helper Functions ===
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    function hasRole(roles) {
      return isAuthenticated() && getUserRole() in roles;
    }

    // === Gantt Templates ===
    match /gantt_templates/{templateId} {
      // 모든 인증된 사용자가 읽기 가능 (본인 것 + 공유된 것)
      allow read: if isAuthenticated();

      // 생성: master, admin, manager 권한 필요
      allow create: if isAuthenticated() &&
                       hasRole(['master', 'admin', 'manager']) &&
                       request.resource.data.createdBy == request.auth.uid;

      // 수정: 본인이 만든 것 또는 master/admin
      allow update: if isAuthenticated() &&
                       (resource.data.createdBy == request.auth.uid ||
                        hasRole(['master', 'admin']));

      // 삭제: 본인이 만든 것 또는 master/admin
      allow delete: if isAuthenticated() &&
                       (resource.data.createdBy == request.auth.uid ||
                        hasRole(['master', 'admin']));
    }

    // === Gantt Projects ===
    match /gantt_projects/{projectId} {
      // 읽기: 본인 프로젝트만 또는 master/admin
      allow read: if isAuthenticated() &&
                     (resource.data.ownerId == request.auth.uid ||
                      hasRole(['master', 'admin']));

      // 생성: master, admin, manager, editor 권한
      allow create: if isAuthenticated() &&
                       hasRole(['master', 'admin', 'manager', 'editor']) &&
                       request.resource.data.ownerId == request.auth.uid;

      // 수정: 본인 프로젝트만 또는 master/admin
      allow update: if isAuthenticated() &&
                       (resource.data.ownerId == request.auth.uid ||
                        hasRole(['master', 'admin']));

      // 삭제: 본인 프로젝트만 또는 master/admin
      allow delete: if isAuthenticated() &&
                       (resource.data.ownerId == request.auth.uid ||
                        hasRole(['master', 'admin']));
    }

    // ... (기존 다른 규칙들)
  }
}
```

---

## 🗂️ 파일 구조 (Phase 4-5 완료 후)

```
ijw-calander/
├── components/
│   └── Gantt/
│       ├── GanttManager.tsx         ✅ (리팩토링 완료)
│       ├── GanttBuilder.tsx         ✅
│       ├── GanttChart.tsx           ✅
│       ├── GanttTaskList.tsx        ✅
│       ├── GanttProgressBar.tsx     ✅
│       └── GanttTemplateSelector.tsx ✅
├── hooks/
│   ├── useGanttTemplates.ts         🆕 NEW
│   ├── useGanttProjects.ts          🆕 NEW
│   ├── useFirebaseQueries.ts        ✅
│   └── usePermissions.ts            ✅
├── services/
│   └── geminiService.ts             ✅
├── types.ts                         ✅
└── firestore.rules                  🔄 (업데이트 필요)
```

---

## 📝 구현 순서

### Step 1: Hooks 작성
1. `hooks/useGanttTemplates.ts` 생성
2. `hooks/useGanttProjects.ts` 생성
3. TypeScript 타입 검증

### Step 2: GanttManager 리팩토링
1. localStorage 로직 제거
2. Firestore hooks로 교체
3. Loading/Error 상태 추가
4. 테스트

### Step 3: Security Rules 업데이트
1. `firestore.rules`에 간트 규칙 추가
2. Firebase Console에서 배포
3. 규칙 테스트 (Firestore Rules Playground)

### Step 4: 데이터 마이그레이션 (선택)
1. 기존 localStorage 데이터 읽기
2. Firestore로 일괄 업로드
3. localStorage 정리

---

## 🧪 테스트 시나리오

### 기능 테스트

1. **템플릿 CRUD (Firestore)**
   - ✅ 템플릿 생성 → Firestore 저장 확인
   - ✅ 템플릿 목록 조회 → 내 것 + 공유된 것
   - ✅ 템플릿 수정 → 실시간 반영
   - ✅ 템플릿 삭제 → Firestore에서 제거

2. **프로젝트 CRUD (Firestore)**
   - ✅ 템플릿에서 프로젝트 시작
   - ✅ 작업 완료 토글 → Firestore 업데이트
   - ✅ 진행률 계산 및 저장
   - ✅ 프로젝트 목록 조회

3. **권한 테스트**
   - ✅ MASTER: 모든 작업 가능
   - ✅ ADMIN: 모든 작업 가능
   - ✅ MANAGER: 생성/수정 가능, 타인 삭제 불가
   - ✅ EDITOR: 프로젝트만 생성 가능
   - ✅ USER: 조회만 가능

4. **공유 기능**
   - ✅ isShared=true 템플릿 → 모든 사용자 조회 가능
   - ✅ isShared=false 템플릿 → 작성자만 조회

---

## ⚠️ 주의사항

### 1. Firestore 쿼리 비용 최적화
- React Query 캐싱 활용 (staleTime 설정)
- 불필요한 리스너 제거 (getDocs 사용, onSnapshot 최소화)
- 인덱스 생성으로 복합 쿼리 최적화

### 2. 오프라인 지원
- Firestore Offline Persistence 활성화됨 (firebaseConfig.ts 참고)
- 네트워크 오류 처리 (React Query retry 설정)

### 3. 데이터 마이그레이션
- localStorage 데이터가 있는 사용자를 위한 안내 메시지
- 자동 마이그레이션 스크립트 (선택)

---

## 📊 예상 소요 시간

| Step | 작업 | 소요 시간 |
|------|------|----------|
| 1 | useGanttTemplates.ts 작성 | 1시간 |
| 2 | useGanttProjects.ts 작성 | 1시간 |
| 3 | GanttManager 리팩토링 | 1.5시간 |
| 4 | Security Rules 작성 및 배포 | 30분 |
| 5 | 테스트 및 디버깅 | 1시간 |
| **총계** | | **~5시간** |

---

## 🚀 배포 체크리스트

- [x] `hooks/useGanttTemplates.ts` 구현 완료
- [x] `hooks/useGanttProjects.ts` 구현 완료
- [x] GanttManager localStorage 제거
- [x] GanttManager Firestore 연동 완료
- [x] firestore.rules 업데이트
- [x] Firebase Console에서 규칙 배포
- [x] 인덱스 생성 (Firestore Console)
- [x] 권한별 테스트 완료
- [x] 프로덕션 배포

---

## 관련 문서

- [gantt_chart_integration.md](./gantt_chart_integration.md) - Phase 1-3 구현 완료
- [types.ts](../../../types.ts) - 타입 정의
- [useFirebaseQueries.ts](../../../hooks/useFirebaseQueries.ts) - React Query 패턴 참고
- [firebaseConfig.ts](../../../firebaseConfig.ts) - Firebase 설정

---

**문서 끝**
