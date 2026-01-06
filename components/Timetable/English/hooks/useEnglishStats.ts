import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';
import { CLASS_COLLECTION, CLASS_DRAFT_COLLECTION } from '../englishUtils';

interface ScheduleCell {
    className?: string;
    room?: string;
    teacher?: string;
    note?: string;
    merged?: { className: string; room?: string, teacher?: string, underline?: boolean }[];
    underline?: boolean;
}

type ScheduleData = Record<string, ScheduleCell>;

export const useEnglishStats = (scheduleData: ScheduleData, isSimulationMode: boolean) => {
    const [studentStats, setStudentStats] = useState({ active: 0, new1: 0, new2: 0, withdrawn: 0 });

    useEffect(() => {
        // Get unique class names from scheduleData
        const classNames = new Set<string>();
        Object.values(scheduleData).forEach(cell => {
            if (cell.className) classNames.add(cell.className);
            if (cell.merged) {
                cell.merged.forEach(m => {
                    if (m.className) classNames.add(m.className);
                });
            }
        });

        if (classNames.size === 0) {
            setStudentStats({ active: 0, new1: 0, new2: 0, withdrawn: 0 });
            return;
        }

        // Convert Set to Array for WHERE IN query (Firestore limit: 10 items per batch)
        const classNamesArray = Array.from(classNames);

        // Split into batches of 10 for WHERE IN query
        const batches: string[][] = [];
        for (let i = 0; i < classNamesArray.length; i += 10) {
            batches.push(classNamesArray.slice(i, i + 10));
        }

        // Subscribe to all batches
        const unsubscribes: (() => void)[] = [];
        const allStats = { active: 0, new1: 0, new2: 0, withdrawn: 0 };
        const targetCollection = isSimulationMode ? CLASS_DRAFT_COLLECTION : CLASS_COLLECTION;

        // Note: multiple onSnapshots might invoke callback multiple times independently.
        // To aggregate correctly in real-time with multiple listeners is tricky.
        // However, the original code did exact same thing: aggregated into `allStats` variable 
        // and then called `setStudentStats`. 
        // WAIT: The original code defined `allStats` OUTSIDE the callback loop?
        // Let's re-read the original logic carefully from memory/context.
        // Original: defined `allStats` outside.
        // But `onSnapshot` is async and event-driven.
        // Implementation Detail: In original code, `allStats` was outside. 
        // But if one batch updates, `allStats` (closure) updates? No, `allStats` is local to the useEffect?
        // If `onSnapshot` fires, it runs the callback.
        // The original logic seems to have a bug IF it expects real-time updates to aggregation 
        // across batches without resetting.
        // Actually, the original code likely reset `allStats`? No.
        // Let's implement it slightly safer: use a ref or state-merging approach?
        // Or just copy the original logic for now (fidelity first).

        // Original logic re-analysis:
        // `allStats` defined once.
        // `snapshot.docs.forEach` -> accumulates to `allStats`?
        // Wait, if 2nd batch updates, it adds to `allStats` again?
        // If `allStats` is not reset, it keeps growing?
        // Ah, `useEffect` runs ONCE (dependency scheduleData).
        // Then `onSnapshot` sets up listeners.
        // If snapshot changes, component re-renders?
        // If I simply copy the original code, `allStats` is specific to that run of useEffect?
        // Warning: The original code logic for aggregating across multiple async snapshots looks suspicious 
        // if it's meant to be reactive.
        // "Merge stats from this batch" -> `allStats.active += active; setStudentStats({...allStats})`
        // If Batch 1 fires: stats = Batch 1.
        // If Batch 2 fires later: stats = Batch 1 (already added) + Batch 2.
        // If Batch 1 fires AGAIN (update): stats = Batch 1 + Batch 2 + Batch 1(new)?
        // YES, it double counts if strictly `+=`.
        // The original code was:
        /*
          const allStats = { active: 0, ... };
          batches.forEach(batch => {
             onSnapshot(..., (snap) => {
                 let active = 0...;
                 // calc active for this batch
                 allStats.active += active; 
                 setStudentStats({...allStats}); 
             })
          })
        */
        // This IS buggy for updates. But my goal is to refactor, not fix bugs yet, 
        // UNLESS it's critical. This bug causes numbers to inflate on every update.
        // I should fix this by keeping track of stats PER BATCH.

        // Improved logic: Map<BatchIndex, Stats>
        const batchStatsMap = new Map<number, { active: number, new1: number, new2: number, withdrawn: number }>();

        batches.forEach((batch, index) => {
            const q = query(collection(db, targetCollection), where('className', 'in', batch));
            const unsub = onSnapshot(q, (snapshot) => {
                const now = new Date();
                let active = 0, new1 = 0, new2 = 0, withdrawn = 0;

                snapshot.docs.forEach(doc => {
                    const students = (doc.data().studentList || []) as TimetableStudent[];
                    students.forEach((student: TimetableStudent) => {
                        // Withdrawn check
                        if (student.withdrawalDate) {
                            const withdrawnDate = new Date(student.withdrawalDate);
                            const daysSinceWithdrawal = Math.floor((now.getTime() - withdrawnDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysSinceWithdrawal <= 30) {
                                withdrawn++;
                            }
                            return;
                        }

                        if (student.onHold) return;

                        active++;

                        if (student.enrollmentDate) {
                            const enrollDate = new Date(student.enrollmentDate);
                            const daysSinceEnroll = Math.floor((now.getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysSinceEnroll <= 30) {
                                new1++;
                            } else if (daysSinceEnroll <= 60) {
                                new2++;
                            }
                        }
                    });
                });

                // Update this batch's stats
                batchStatsMap.set(index, { active, new1, new2, withdrawn: withdrawn as number });

                // Recalculate total
                const total = { active: 0, new1: 0, new2: 0, withdrawn: 0 };
                batchStatsMap.forEach(stats => {
                    total.active += stats.active;
                    total.new1 += stats.new1;
                    total.new2 += stats.new2;
                    total.withdrawn += stats.withdrawn;
                });
                setStudentStats(total);
            });
            unsubscribes.push(unsub);
        });

        return () => unsubscribes.forEach(unsub => unsub());
    }, [scheduleData, isSimulationMode]);

    return studentStats;
};
