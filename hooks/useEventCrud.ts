/**
 * useEventCrud - Event CRUD operations extracted from App.tsx
 *
 * Handles: Save (single/recurring/multi-dept), Delete (single/recurring/linked), Batch attendance
 */

import { CalendarEvent } from '../types';
import { db } from '../firebaseConfig';
import { doc, collection, query, where, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { eventConverter } from '../converters';
import {
  parseISO, format, differenceInDays, addDays, addWeeks, addMonths, addYears,
  getDay, getDate, endOfMonth,
} from 'date-fns';

interface UseEventCrudParams {
  events: CalendarEvent[];
  pendingBucketId: string | null;
  onDeleteBucketItem: (id: string) => Promise<void>;
  onResetBucketState: () => void;
}

// Firestore 문서 ID에 '/'가 포함되면 경로 구분자로 해석되므로 치환
export const safeDeptId = (deptId: string) => deptId.replace(/\//g, '_');

export const useEventCrud = ({
  events,
  pendingBucketId,
  onDeleteBucketItem,
  onResetBucketState,
}: UseEventCrudParams) => {

  const handleSaveEvent = async (event: CalendarEvent) => {
    try {
      // 0. Auto-Restore from Archive Logic
      if (event.isArchived) {
        await deleteDoc(doc(db, 'archived_events', event.id));
        delete event.isArchived;
      }

      // Check for recurrence
      const recurrenceCount = (event as any)._recurrenceCount;
      delete (event as any)._recurrenceCount;

      // 1. Identify Target Departments
      const targetDeptIds = (event.departmentIds && event.departmentIds.length > 0)
        ? event.departmentIds
        : [event.departmentId];

      const isMultiDept = targetDeptIds.length > 1;

      // Handle Batch Creation for Recurrence
      if (recurrenceCount && recurrenceCount > 1 && event.recurrenceType) {
        const MAX_BATCH_SIZE = 499;
        let currentBatch = writeBatch(db);
        let operationCount = 0;

        const baseStart = parseISO(event.startDate);
        const baseEnd = parseISO(event.endDate);
        const duration = differenceInDays(baseEnd, baseStart);
        const seriesGroupId = event.id;

        let createdCount = 0;
        let currentDate = baseStart;

        for (let i = 0; i < recurrenceCount; i++) {
          if (i > 0) {
            switch (event.recurrenceType) {
              case 'daily':
                currentDate = addDays(baseStart, i);
                break;
              case 'weekdays':
                currentDate = addDays(currentDate, 1);
                while (getDay(currentDate) === 0 || getDay(currentDate) === 6) {
                  currentDate = addDays(currentDate, 1);
                }
                break;
              case 'weekends':
                currentDate = addDays(currentDate, 1);
                while (getDay(currentDate) !== 0 && getDay(currentDate) !== 6) {
                  currentDate = addDays(currentDate, 1);
                }
                break;
              case 'weekly':
                currentDate = addWeeks(baseStart, i);
                break;
              case 'monthly': {
                let nextDate = addMonths(baseStart, i);
                if (getDate(baseStart) > 28 && getDate(nextDate) < getDate(baseStart)) {
                  nextDate = endOfMonth(nextDate);
                }
                currentDate = nextDate;
                break;
              }
              case 'yearly':
                currentDate = addYears(baseStart, i);
                break;
            }
          }

          const instanceRelatedGroupId = isMultiDept
            ? `group_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_${i}`
            : undefined;

          const baseEventId = i === 0 ? event.id : `${event.id}_r${i + 1}`;
          const newStartDate = format(currentDate, 'yyyy-MM-dd');
          const newEndDate = format(addDays(currentDate, duration), 'yyyy-MM-dd');

          for (const deptId of targetDeptIds) {
            const isPrimary = deptId === event.departmentId;
            const finalId = isPrimary ? baseEventId : `${baseEventId}_${safeDeptId(deptId)}`;

            const recurringEvent: CalendarEvent = {
              ...event,
              id: finalId,
              departmentId: deptId,
              departmentIds: targetDeptIds,
              startDate: newStartDate,
              endDate: newEndDate,
              recurrenceGroupId: seriesGroupId,
              recurrenceIndex: i + 1,
              relatedGroupId: instanceRelatedGroupId,
            };

            const ref = doc(db, "events", finalId).withConverter(eventConverter);

            if (operationCount >= MAX_BATCH_SIZE) {
              await currentBatch.commit();
              currentBatch = writeBatch(db);
              operationCount = 0;
            }

            currentBatch.set(ref, recurringEvent);
            operationCount++;
            createdCount++;
          }
        }

        if (operationCount > 0) {
          await currentBatch.commit();
        }

        alert(`${createdCount}개의 반복 일정이 생성되었습니다.`);

      } else {
        // Single Event Save (Create or Update)
        const batch = writeBatch(db);

        if (event.relatedGroupId) {
          const q = query(
            collection(db, "events").withConverter(eventConverter),
            where("연결그룹ID", "==", event.relatedGroupId)
          );
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const existingSiblingsMap = new Map<string, string>();
            snapshot.forEach(d => {
              const data = d.data();
              existingSiblingsMap.set(data.departmentId, d.id);
            });

            for (const deptId of targetDeptIds) {
              const isPrimary = deptId === event.departmentId;
              let finalId = existingSiblingsMap.get(deptId);
              if (!finalId) {
                finalId = isPrimary ? event.id : `${event.id}_${safeDeptId(deptId)}`;
              }

              const singleEvent: CalendarEvent = {
                ...event,
                id: finalId,
                departmentId: deptId,
                departmentIds: targetDeptIds,
                relatedGroupId: event.relatedGroupId,
                version: (event.version || 0) + 1,
              };

              batch.set(doc(db, "events", finalId).withConverter(eventConverter), singleEvent);
            }

            snapshot.forEach(d => {
              const data = d.data();
              const siblingDeptId = data.departmentId;
              if (!targetDeptIds.includes(siblingDeptId)) {
                batch.delete(doc(db, "events", d.id));
              }
            });

          } else {
            // Fallback: group not found in DB
            let relatedGroupId = event.relatedGroupId;
            if (isMultiDept && !relatedGroupId) {
              relatedGroupId = `group_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
            }

            for (const deptId of targetDeptIds) {
              const isPrimary = deptId === event.departmentId;
              const finalId = isPrimary ? event.id : `${event.id}_${safeDeptId(deptId)}`;

              const singleEvent: CalendarEvent = {
                ...event,
                id: finalId,
                departmentId: deptId,
                departmentIds: targetDeptIds,
                relatedGroupId: relatedGroupId,
                version: (event.version || 0) + 1,
              };

              batch.set(doc(db, "events", finalId).withConverter(eventConverter), singleEvent);
            }
          }
        } else {
          // New Single Event (or existing one becoming a group)
          let relatedGroupId = event.relatedGroupId;
          if (isMultiDept && !relatedGroupId) {
            relatedGroupId = `group_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
          }

          const plannedIds: string[] = [];

          for (const deptId of targetDeptIds) {
            const isPrimary = deptId === event.departmentId;
            const finalId = isPrimary ? event.id : `${event.id}_${safeDeptId(deptId)}`;

            plannedIds.push(finalId);

            const singleEvent: CalendarEvent = {
              ...event,
              id: finalId,
              departmentId: deptId,
              departmentIds: targetDeptIds,
              relatedGroupId: relatedGroupId,
              version: (event.version || 0) + 1,
            };

            batch.set(doc(db, "events", finalId).withConverter(eventConverter), singleEvent);
          }

          if (!plannedIds.includes(event.id)) {
            if (event.createdAt) {
              batch.delete(doc(db, "events", event.id));
            }
          }
        }

        await batch.commit();
      }

      // If converting from bucket, delete the bucket now after successful save
      if (pendingBucketId) {
        await onDeleteBucketItem(pendingBucketId);
        onResetBucketState();
      }
    } catch (e) {
      console.error("Error saving event: ", e);
      alert("일정 저장 실패");
      onResetBucketState();
    }
  };

  const handleDeleteEvent = async (id: string, event?: CalendarEvent) => {
    try {
      const batch = writeBatch(db);
      let deleteCount = 0;

      const getLinkedSiblings = async (evt: CalendarEvent) => {
        if (!evt.relatedGroupId) return [];
        const q = query(
          collection(db, "events").withConverter(eventConverter),
          where("연결그룹ID", "==", evt.relatedGroupId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.filter(d => d.id !== evt.id);
      };

      const deleteLinkedGroup = async (evt: CalendarEvent, existingBatch: ReturnType<typeof writeBatch>) => {
        if (evt.relatedGroupId) {
          const q = query(
            collection(db, "events").withConverter(eventConverter),
            where("연결그룹ID", "==", evt.relatedGroupId)
          );
          const snapshot = await getDocs(q);
          snapshot.forEach(d => {
            existingBatch.delete(doc(db, "events", d.id));
            deleteCount++;
          });
        } else {
          existingBatch.delete(doc(db, "events", evt.id));
          deleteCount++;
        }
      };

      if (event?.recurrenceGroupId && event.recurrenceIndex && event.recurrenceIndex > 0) {
        const deleteAll = window.confirm(
          `이 일정은 반복 일정입니다.\n\n"확인": 이후 모든 반복 일정 삭제\n"취소": 이 일정만 삭제`
        );

        if (deleteAll) {
          const groupId = event.recurrenceGroupId;
          const currentIndex = event.recurrenceIndex;

          const toDelete = events.filter(
            e => e.recurrenceGroupId === groupId && (e.recurrenceIndex || 0) >= currentIndex
          );

          toDelete.forEach(e => {
            batch.delete(doc(db, "events", e.id));
            deleteCount++;
          });

          await batch.commit();
          alert(`${deleteCount}개의 반복 일정이 삭제되었습니다.`);
        } else {
          const siblings = await getLinkedSiblings(event);
          if (siblings.length > 0) {
            const deleteLinked = window.confirm("해당 일정은 다른 부서와 연동되어 있습니다.\n\n[확인]: 연동된 모든 부서의 일정 삭제\n[취소]: 현재 부서의 일정만 삭제");
            if (deleteLinked) {
              await deleteLinkedGroup(event, batch);
            } else {
              batch.delete(doc(db, "events", event.id));
            }
          } else {
            batch.delete(doc(db, "events", event.id));
            deleteCount++;
          }
          await batch.commit();
        }
      } else {
        if (event) {
          const siblings = await getLinkedSiblings(event);
          if (siblings.length > 0) {
            const deleteLinked = window.confirm("해당 일정은 다른 부서와 연동되어 있습니다.\n\n[확인]: 연동된 모든 부서의 일정 삭제\n[취소]: 현재 부서의 일정만 삭제");
            if (deleteLinked) {
              await deleteLinkedGroup(event, batch);
            } else {
              batch.delete(doc(db, "events", event.id));
            }
          } else {
            batch.delete(doc(db, "events", event.id));
            deleteCount++;
          }
        } else {
          batch.delete(doc(db, "events", id));
        }
        await batch.commit();
      }
    } catch (e) {
      console.error("Error deleting event: ", e);
      alert("일정 삭제 실패");
    }
  };

  const handleBatchUpdateAttendance = async (
    groupId: string,
    uid: string,
    status: 'pending' | 'joined' | 'declined'
  ) => {
    try {
      const groupEvents = events.filter(e => e.recurrenceGroupId === groupId);
      const batch = writeBatch(db);

      groupEvents.forEach(event => {
        const ref = doc(db, "events", event.id);
        const updatedAttendance = { ...(event.attendance || {}), [uid]: status };
        batch.update(ref, { 참가현황: updatedAttendance });
      });

      await batch.commit();
      alert(`${groupEvents.length}개의 반복 일정에 참가 상태가 적용되었습니다.`);
    } catch (e) {
      console.error("Error batch updating attendance: ", e);
      alert("참가 상태 일괄 변경 실패");
    }
  };

  return {
    handleSaveEvent,
    handleDeleteEvent,
    handleBatchUpdateAttendance,
  };
};
