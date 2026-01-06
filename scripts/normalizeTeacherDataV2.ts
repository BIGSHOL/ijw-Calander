
/**
 * normalizeTeacherDataV2.ts
 * 
 * Script to fix data inconsistencies by replacing old teacher names with standardized names
 * across multiple collections, including ID renaming for classes.
 * 
 * Target: '민주' -> '김민주' etc.
 */

import {
    collection,
    getDocs,
    getDoc,
    doc,
    writeBatch,
    query,
    where,
    deleteDoc,
    setDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const MAPPINGS = [
    { old: '민주', new: '김민주' },
    { old: '성우', new: '이성우' },
    { old: '정은', new: '김은정' },
    { old: '희영', new: '이희영' },
    { old: '서영', new: '윤서영' },
    { old: '승아', new: '이승아' },
    { old: '윤하', new: '김윤하' }
];

export async function normalizeTeacherData(dryRun = true) {
    console.log(`\n=== Normalizing Teacher Data (Batch of ${MAPPINGS.length}) ${dryRun ? '(DRY RUN)' : '(LIVE)'} ===\n`);

    const batch = writeBatch(db);
    let opCount = 0;

    try {
        for (const map of MAPPINGS) {
            const TARGET_OLD = map.old;
            const TARGET_NEW = map.new;

            console.log(`\n>>> Processing Mapping: '${TARGET_OLD}' -> '${TARGET_NEW}'`);

            // 1. Handle 'teachers' collection (강사목록)
            const oldTeacherRef = doc(db, '강사목록', TARGET_OLD);
            const newTeacherRef = doc(db, '강사목록', TARGET_NEW);

            const oldTeacherSnap = await getDoc(oldTeacherRef);
            if (oldTeacherSnap.exists()) {
                console.log(`  [Teacher] Found '${TARGET_OLD}'. Moving to '${TARGET_NEW}'.`);
                const oldData = oldTeacherSnap.data();

                if (!dryRun) {
                    // Create new, then delete old
                    await setDoc(newTeacherRef, { ...oldData, name: TARGET_NEW }); // direct await to ensure it exists for refs
                    batch.delete(oldTeacherRef);
                    opCount += 2;
                }
            }

            // 2. Handle 'classes' (수업목록) - SCAN ALL for ID Pattern
            // Querying by field is insufficient if field is missing.
            // We must fetch all classes once (inefficient but safe for this migration) 
            // OR we can rely on client-side filtering if collection isn't huge.
            // For 7 teachers, let's just fetch all classes ONCE outside the loop to save reads?
            // Actually, let's keep it simple. Fetching all is fine for <1000 docs.

            // Optimization: Fetch columns only once outside? 
            // Let's do checking inside.
        }

        // OPTIMIZATION: Scan ALL classes ONCE to check against ALL mappings
        // This handles the "Class ID" issue.
        console.log(`\n[Classes] Scanning all class IDs for patterns...`);
        const allClassSnaps = await getDocs(collection(db, '수업목록'));
        let classRenameCount = 0;

        allClassSnaps.forEach(docSnap => {
            const id = docSnap.id;
            const data = docSnap.data();
            let newId = id;
            let needsRename = false;
            let newTeacherField = data.teacher;
            let isModified = false;

            // Check against all mappings
            for (const map of MAPPINGS) {
                const { old: tOld, new: tNew } = map;

                // Check ID pattern: "수학_민주_..." or "민주_..."
                if (id.includes(`_${tOld}_`) || id.startsWith(`${tOld}_`)) {
                    // Replace ONLY the name part to preserve other ID parts
                    // Be careful not to replace partial matches if name is short
                    // e.g. "민주" in "이민주" -> ensure boundaries
                    // Given "수학_민주_" structure, underscores are delimiters.

                    if (id.includes(`_${tOld}_`)) {
                        newId = newId.replace(`_${tOld}_`, `_${tNew}_`);
                        needsRename = true;
                    } else if (id.startsWith(`${tOld}_`)) {
                        newId = newId.replace(`${tOld}_`, `${tNew}_`);
                        needsRename = true;
                    }

                    newTeacherField = tNew;
                    isModified = true;
                    break; // Assume 1 teacher per class
                }

                // Check Field Match
                if (data.teacher === tOld) {
                    newTeacherField = tNew;
                    isModified = true;
                }
            }

            if (isModified) {
                console.log(`  -> Class Fix: '${id}' => '${newId}' (Teacher: ${newTeacherField})`);

                if (!dryRun) {
                    if (needsRename && newId !== id) {
                        const newData = { ...data, teacher: newTeacherField };
                        const newRef = doc(db, '수업목록', newId);
                        batch.set(newRef, newData);
                        batch.delete(docSnap.ref);
                        opCount += 2;
                    } else {
                        // Just update field
                        if (data.teacher !== newTeacherField) {
                            batch.update(docSnap.ref, { teacher: newTeacherField });
                            opCount++;
                        }
                    }
                }
                classRenameCount++;
            }
        });

        if (classRenameCount > 0) console.log(`  [Classes] Queued fixes for ${classRenameCount} classes.`);


        // 3. Handle 'english_schedules'
        console.log(`\n[Schedules] Scanning english_schedules for patterns...`);
        const scheduleSnap = await getDocs(collection(db, 'english_schedules'));
        let scheduleRenameCount = 0;

        scheduleSnap.forEach(docSnap => {
            const id = docSnap.id;
            const data = docSnap.data();
            let newId = id;
            let isModified = false;
            let newTeacherField = data.teacher;
            let needsRename = false;

            for (const map of MAPPINGS) {
                const { old: tOld, new: tNew } = map;

                // Check ID: "민주-..."
                if (id.startsWith(`${tOld}-`)) {
                    newId = id.replace(`${tOld}-`, `${tNew}-`);
                    needsRename = true;
                    newTeacherField = tNew;
                    isModified = true;
                    break;
                }

                if (data.teacher === tOld) {
                    newTeacherField = tNew;
                    isModified = true;
                }
            }

            if (isModified) {
                console.log(`  -> Schedule Fix: '${id}' => '${newId}'`);

                if (!dryRun) {
                    if (needsRename && newId !== id) {
                        const newData = { ...data, teacher: newTeacherField };
                        const newRef = doc(db, 'english_schedules', newId);
                        batch.set(newRef, newData);
                        batch.delete(docSnap.ref);
                        opCount += 2;
                    } else {
                        if (data.teacher !== newTeacherField) {
                            batch.update(docSnap.ref, { teacher: newTeacherField });
                            opCount++;
                        }
                    }
                }
                scheduleRenameCount++;
            }
        });
        if (scheduleRenameCount > 0) console.log(`  [Schedules] Queued fixes for ${scheduleRenameCount} schedules.`);


        if (!dryRun) {
            if (opCount > 0) {
                await batch.commit();
                console.log(`\n✅ Successfully committed ${opCount} operations.`);
            } else {
                console.log(`\nComputed 0 operations. Nothing to do. (Everything clean?)`);
            }
        } else {
            console.log(`\n[DRY RUN] Would perform ${opCount} operations.`);
            console.log(`Run 'await normalizeTeacherData(false)' to execute.`);
        }

    } catch (e) {
        console.error("Error normalizing data:", e);
    }
}

if (typeof window !== 'undefined') {
    (window as any).normalizeTeacherData = normalizeTeacherData;
}
