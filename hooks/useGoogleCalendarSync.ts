import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebaseConfig';
import { GCalSyncSettings, GCalSyncMapping } from '../types/system';
import { useSystemConfig } from './useFirebaseQueries';

/**
 * Google Calendar 다중 캘린더 동기화 설정 및 수동 동기화 훅
 */
export function useGoogleCalendarSync() {
  const queryClient = useQueryClient();
  const { data: systemConfig } = useSystemConfig(true);
  const syncSettings = systemConfig?.gcalSync || null;

  // 매핑 목록 (레거시 호환)
  const mappings: GCalSyncMapping[] = syncSettings?.mappings
    || (syncSettings?.calendarId
      ? [{ calendarId: syncSettings.calendarId, departmentId: syncSettings.syncDepartmentId || '' }]
      : []);

  // 설정 저장
  const saveSettings = useMutation({
    mutationFn: async (settings: Partial<GCalSyncSettings>) => {
      const merged = { ...syncSettings, ...settings };
      await setDoc(
        doc(db, 'system', 'config'),
        { gcalSync: merged },
        { merge: true }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
    },
  });

  // 수동 전체 동기화
  const triggerSync = useMutation({
    mutationFn: async () => {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const callable = httpsCallable(functions, 'triggerGcalSync');
      const result = await callable();
      return result.data as {
        success: boolean;
        created: number;
        updated: number;
        deleted: number;
        errorCount: number;
        message: string;
        details: Array<{ calendar: string; created?: number; updated?: number; deleted?: number; errors?: number; total?: number; error?: string }>;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] });
    },
  });

  return {
    syncSettings,
    mappings,
    saveSettings,
    triggerSync,
  };
}
