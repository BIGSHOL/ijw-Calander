import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GanttTemplate, UserProfile } from '../types';
import { checkProjectAccess } from '../utils/ganttPermissions';

// Helper: Normalize template data from Firestore
function normalizeTemplate(docSnapshot: any): GanttTemplate {
  const data = docSnapshot.data();
  return {
    ...data,
    id: docSnapshot.id,
    assignees: data.assignees || [],
    members: data.members || [],
    departmentIds: data.departmentIds || [],
    visibility: data.visibility || (data.isShared ? 'public' : 'private'),
    ownerId: data.ownerId || data.createdBy,
    createdAt: data.createdAt?.toMillis() || Date.now(),
  } as GanttTemplate;
}

// 템플릿 목록 조회 (Phase 10: Server-side filtering with parallel queries)
export interface UseGanttTemplatesOptions {
  userId?: string;
  userProfile?: UserProfile | null;
  userDepartments?: string[];
}

export const useGanttTemplates = (options: UseGanttTemplatesOptions | string) => {
  // Backwards compatibility: accept userId string directly
  const { userId, userProfile, userDepartments } = typeof options === 'string'
    ? { userId: options, userProfile: undefined, userDepartments: undefined }
    : options;

  return useQuery({
    queryKey: ['ganttTemplates', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Master/Admin: Get all non-archived projects
      if (userProfile && ['master', 'admin'].includes(userProfile.role)) {
        const snapshot = await getDocs(query(
          collection(db, 'gantt_templates'),
          orderBy('createdAt', 'desc')
        ));
        return snapshot.docs
          .map(normalizeTemplate)
          .filter(t => !t.isArchived);
      }

      // Regular users: Use parallel queries for cost optimization (Phase 10)
      // Critical Issue #2 Fix: Added visibility='public' query (2026-01-03)
      const results = await Promise.all([
        // 1. Projects I created
        getDocs(query(
          collection(db, 'gantt_templates'),
          where('createdBy', '==', userId),
          orderBy('createdAt', 'desc')
        )),

        // 2. Legacy public projects (isShared = true)
        getDocs(query(
          collection(db, 'gantt_templates'),
          where('isShared', '==', true),
          orderBy('createdAt', 'desc')
        )),

        // 3. New public projects (visibility = 'public') - Critical Fix
        getDocs(query(
          collection(db, 'gantt_templates'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc')
        )),

        // 4. Projects I'm assigned to (legacy assignees array)
        getDocs(query(
          collection(db, 'gantt_templates'),
          where('assignees', 'array-contains', userId),
          orderBy('createdAt', 'desc')
        )),

        // 5. Projects where I am a member (Phase 10)
        getDocs(query(
          collection(db, 'gantt_templates'),
          where('memberIds', 'array-contains', userId),
          orderBy('createdAt', 'desc')
        )),

        // 6. Department Projects (Phase 6)
        ...(userDepartments && userDepartments.length > 0 ? [
          getDocs(query(
            collection(db, 'gantt_templates'),
            where('visibility', '==', 'department'),
            where('departmentIds', 'array-contains-any', userDepartments),
            orderBy('createdAt', 'desc')
          ))
        ] : []),

        // 7. Department Shared Projects (Phase 6)
        ...(userDepartments && userDepartments.length > 0 ? [
          getDocs(query(
            collection(db, 'gantt_templates'),
            where('visibility', '==', 'department_shared'),
            where('departmentIds', 'array-contains-any', userDepartments),
            orderBy('createdAt', 'desc')
          ))
        ] : []),

        // 5. Projects where I am a member (Phase 10)
        getDocs(query(
          collection(db, 'gantt_templates'),
          where('memberIds', 'array-contains', userId),
          orderBy('createdAt', 'desc')
        )),

        // 6. Department Projects (Phase 6)
        // User must be in the department AND project visibility must be 'department'
        // Since we can't easily do AND current-user-dept-check in one query without complex indices for every dept,
        // we query ALL 'department' visibility projects that target my departments.
        ...(userDepartments && userDepartments.length > 0 ? [
          getDocs(query(
            collection(db, 'gantt_templates'),
            where('visibility', '==', 'department'),
            where('departmentIds', 'array-contains-any', userDepartments),
            orderBy('createdAt', 'desc')
          ))
        ] : [])
      ]);

      // Deduplicate results (4 queries now)
      const uniqueProjects = new Map<string, GanttTemplate>();
      results.forEach(snapshot => {
        snapshot.docs.forEach(docSnapshot => {
          if (!uniqueProjects.has(docSnapshot.id)) {
            uniqueProjects.set(docSnapshot.id, normalizeTemplate(docSnapshot));
          }
        });
      });

      // Additional filtering via checkProjectAccess (for members array check)
      const allProjects = Array.from(uniqueProjects.values());
      return allProjects
        .filter(project => {
          if (!project.isArchived === false && project.isArchived) return false;
          if (!userProfile) return true; // Legacy mode: skip permission check
          const access = checkProjectAccess(project, userProfile, userDepartments);
          return access.canView;
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: true, // Collaboration: refresh on tab focus
    refetchOnReconnect: true,
    refetchOnMount: false,
  });
};

// 템플릿 생성
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<GanttTemplate, 'id' | 'createdAt'>) => {
      // Important Improvement #5: as any 제거 - 적절한 타입 정의로 교체
      // Remove 'id' from the data being saved to Firestore
      // (The template comes with a temporary ID from builder, but we want Firestore to generate one)
      const { id, ...dataToSave } = template as GanttTemplate & { id?: string };

      const docRef = await addDoc(collection(db, 'gantt_templates'), {
        ...dataToSave,
        createdAt: Timestamp.now(),
        isShared: template.isShared || false,
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
      // Important Improvement #5: as any 제거 - 적절한 타입 정의로 교체
      const { id: _id, createdAt, ...updateData } = updates as Partial<GanttTemplate> & { id?: string; createdAt?: number };
      await updateDoc(docRef, updateData);
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
