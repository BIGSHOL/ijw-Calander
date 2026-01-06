
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TimetableClass } from '../types';

const TARGET_NAME = '강민준';

export async function inspectStudent() {
    console.log(`\n=== Inspecting Data for "${TARGET_NAME}" ===\n`);

    const snapshot = await getDocs(collection(db, '수업목록'));
    const found: any[] = [];

    snapshot.forEach(doc => {
        const data = doc.data() as TimetableClass;
        const students = data.studentList || [];

        // Check if student exists in this class
        const match = students.find(s => s.name?.includes(TARGET_NAME));
        if (match) {
            found.push({
                classId: doc.id,
                className: data.className,
                teacher: data.teacher,
                subject: data.subject,
                studentName: match.name,
                studentSchool: match.school,
                studentGrade: match.grade,
                key: `${match.name}|${match.school || ''}|${match.grade || ''}`.trim()
            });
        }
    });

    console.table(found);
    console.log(`\nFound ${found.length} class enrollments for ${TARGET_NAME}.`);
}

// Browser console export
if (typeof window !== 'undefined') {
    (window as any).inspectStudent = inspectStudent;
}
