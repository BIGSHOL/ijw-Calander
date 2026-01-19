/**
 * Generic Timetable Classes Hook
 *
 * Performance Optimizations Applied:
 * - async-parallel: Firebase listener runs independently
 * - client-swr-dedup: Real-time Firebase subscription with automatic deduplication
 * - rerender-dependencies: Stable dependency (subject) prevents unnecessary re-subscriptions
 */

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { listenerRegistry } from '../../../../utils/firebaseCleanup';
import { convertToLegacyPeriodId } from '../../constants';
import type { TimetableClass, SubjectKey } from '../types';
import { getSubjectConfig } from '../utils/subjectConfig';

const COL_CLASSES = 'classes';

/**
 * Hook to fetch timetable classes for a specific subject
 *
 * @param subject - Subject key (math, english, science, korean)
 * @returns Classes data and loading state
 *
 * Performance Notes:
 * - Uses Firebase real-time listener for instant updates
 * - Automatically cleans up subscription on unmount
 * - Subject filter at Firebase level (not in-memory)
 */
export function useTimetableClasses(subject: SubjectKey) {
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Performance Note (js-cache-property-access):
    // Cache config lookup outside snapshot callback
    const config = getSubjectConfig(subject);

    // Query classes filtered by subject at Firebase level
    // Performance Note (server-side-filter):
    // Filter at database level, not in-memory
    const q = query(
      collection(db, COL_CLASSES),
      where('isActive', '==', true),
      where('subject', '==', config.firebaseSubjectKey)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Performance Note (js-cache-property-access):
      // Cache frequently accessed values
      const hasGrouping = config.hasGrouping;

      const loadedClasses: TimetableClass[] = snapshot.docs.map(doc => {
        const data = doc.data();

        // Convert schedule to legacy string format if needed
        // Performance Note (js-early-exit):
        // Check for existence before processing
        let scheduleStrings: string[] = [];
        if (data.schedule && Array.isArray(data.schedule)) {
          scheduleStrings = data.schedule.map((slot: any) => {
            // For grouped subjects (Math/Science/Korean), convert to legacy format
            const periodId = hasGrouping
              ? convertToLegacyPeriodId(slot.periodId)
              : slot.periodId;
            return `${slot.day} ${periodId}`;
          });
        } else if (data.legacySchedule) {
          scheduleStrings = data.legacySchedule;
        }

        return {
          id: doc.id,
          className: data.className || '',
          subject: config.subject,
          teacher: data.teacher || '',
          assistants: data.assistants,
          room: data.room,
          schedule: scheduleStrings,
          color: data.color,
          isActive: data.isActive ?? true,
          studentCount: data.studentCount,
          slotTeachers: data.slotTeachers,
          slotRooms: data.slotRooms,
          memo: data.memo,
        };
      });

      setClasses(loadedClasses);
      setLoading(false);
    });

    // Register listener for cleanup (returns cleanup function)
    const cleanupListener = listenerRegistry.register(`timetable-classes-${subject}`, unsubscribe);

    // Cleanup on unmount
    return cleanupListener;
  }, [subject]); // Performance Note (rerender-dependencies): Stable primitive dependency

  return { classes, loading };
}
