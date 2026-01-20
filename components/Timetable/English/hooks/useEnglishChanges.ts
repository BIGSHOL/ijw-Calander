import { useState } from 'react';
import { collection, query, where, getDocs, writeBatch, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableStudent } from '../../../../types';
import { CLASS_COLLECTION } from '../englishUtils';
import { useQueryClient } from '@tanstack/react-query';
import { useSimulationOptional } from '../context/SimulationContext';

export interface MoveChange {
    student: TimetableStudent;
    fromClass: string;
    toClass: string;
}

export const useEnglishChanges = (isSimulationMode: boolean) => {
    const [moveChanges, setMoveChanges] = useState<Map<string, MoveChange>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const queryClient = useQueryClient();
    const simulation = useSimulationOptional();

    const handleMoveStudent = (student: TimetableStudent, fromClass: string, toClass: string) => {
        if (fromClass === toClass) return;

        setMoveChanges(prev => {
            const next = new Map(prev);
            const existingMove = next.get(student.id);

            if (existingMove) {
                if (existingMove.fromClass === toClass) {
                    next.delete(student.id);
                } else {
                    next.set(student.id, { ...existingMove, toClass });
                }
            } else {
                next.set(student.id, { student, fromClass, toClass });
            }
            return next;
        });
    };

    const handleCancelChanges = () => {
        if (moveChanges.size === 0) return;
        if (confirm('저장하지 않은 변경사항이 모두 사라집니다.\n계속하시겠습니까?')) {
            setMoveChanges(new Map());
        }
    };

    const handleSaveChanges = async () => {
        if (moveChanges.size === 0) return;
        if (!confirm(`총 ${moveChanges.size}명의 학생 이동을 저장하시겠습니까?`)) return;

        setIsSaving(true);
        try {
            // === 시나리오 모드: ScenarioContext의 scenarioEnrollments 업데이트 ===
            if (isSimulationMode && simulation?.isScenarioMode) {
                moveChanges.forEach(({ student, fromClass, toClass }) => {
                    simulation.moveStudent(fromClass, toClass, student.id);
                });
                setMoveChanges(new Map());
                alert('시뮬레이션에 반영되었습니다.\n시나리오 저장 시 함께 저장됩니다.');
                setIsSaving(false);
                return;
            }

            // === 실시간 모드: Firebase 업데이트 ===
            const today = new Date().toISOString().split('T')[0];

            // === 1. enrollments subcollection 업데이트 (학생 관리 연동) ===
            const enrollmentPromises = Array.from(moveChanges.values()).map(async ({ student, fromClass, toClass }) => {
                // 1-1. 이전 수업 enrollment에 endDate 설정 (종료 처리)
                const fromEnrollmentsQuery = query(
                    collection(db, 'students', student.id, 'enrollments'),
                    where('subject', '==', 'english'),
                    where('className', '==', fromClass)
                );
                const fromSnapshot = await getDocs(fromEnrollmentsQuery);

                const endDatePromises = fromSnapshot.docs.map(docSnap =>
                    updateDoc(docSnap.ref, {
                        endDate: today,
                        updatedAt: new Date().toISOString()
                    })
                );
                await Promise.all(endDatePromises);

                // 1-2. 새 수업 enrollment 생성
                const enrollmentsRef = collection(db, 'students', student.id, 'enrollments');
                await addDoc(enrollmentsRef, {
                    className: toClass,
                    subject: 'english',
                    enrollmentDate: today,  // 시작일 = 오늘
                    createdAt: new Date().toISOString(),
                    // 이전 enrollment에서 underline 등 속성 복사
                    underline: student.underline || false,
                    attendanceDays: student.attendanceDays || [],
                });
            });

            await Promise.all(enrollmentPromises);

            // === 2. React Query 캐시 무효화 (학생관리/수업관리 즉시 반영) ===
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            queryClient.invalidateQueries({ queryKey: ['englishClassStudents'] });

            setMoveChanges(new Map());
            alert('저장되었습니다.');

        } catch (error) {
            console.error('Batch save failed:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return {
        moveChanges,
        isSaving,
        handleMoveStudent,
        handleCancelChanges,
        handleSaveChanges
    };
};
