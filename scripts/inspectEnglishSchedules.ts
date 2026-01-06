
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export async function inspectEnglishSchedules() {
    console.log(`\n=== Inspecting English Schedules (Verbose) ===\n`);

    const snapshot = await getDocs(collection(db, 'english_schedules'));

    if (snapshot.empty) {
        console.log("Collection 'english_schedules' is empty.");
        return;
    }

    console.log(`Found ${snapshot.size} documents. Showing first 5:`);

    let count = 0;
    snapshot.forEach(doc => {
        if (count < 5) {
            console.log(`[${doc.id}]`, doc.data());
        }
        count++;
    });

    const classTeacherMap: Record<string, Set<string>> = {};

    snapshot.forEach(doc => {
        const idParts = doc.id.split('-');
        // ID: Teacher-Period-Day
        let teacher = idParts[0];
        const data = doc.data();

        // Check if teacher is valid (not undefined/null)
        if (!teacher || teacher === 'undefined') {
            if (data.teacher) teacher = data.teacher;
        }

        const className = data.className;

        if (className && teacher) {
            if (!classTeacherMap[className]) {
                classTeacherMap[className] = new Set();
            }
            classTeacherMap[className].add(teacher);
        }
    });

    console.log("\nClass -> Teacher Mapping Preview (First 10):");
    const entries = Object.entries(classTeacherMap);
    entries.slice(0, 10).forEach(([cls, teachers]) => {
        console.log(`[${cls}]: ${Array.from(teachers).join(', ')}`);
    });

    // Specific check for LE1
    if (classTeacherMap['LE1']) {
        console.log(`\n[LE1] teachers: ${Array.from(classTeacherMap['LE1']).join(', ')}`);
    } else {
        console.log(`\n[LE1] NOT FOUND in mapping.`);
    }
}

if (typeof window !== 'undefined') {
    (window as any).inspectEnglishSchedules = inspectEnglishSchedules;
}
