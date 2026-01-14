import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, setDoc, updateDoc, collection, addDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UnifiedStudent, ConsultationRecord } from '../types';

const COL_STUDENTS = 'students';
const COL_CONSULTATIONS = 'consultations';

/**
 * 상담 기록에서 예비원생 생성
 */
export interface CreateProspectData {
    consultationId: string;
    name: string;
    school?: string;
    grade?: string;
    parentPhone?: string;
    prospectStatus?: 'contacted' | 'pending_registration' | 'pending_test' | 'on_hold';
    plannedStartDate?: string;
    plannedSubjects?: ('math' | 'english')[];
    followUpDate?: string;
    prospectNotes?: string;
}

export const useCreateProspect = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateProspectData) => {
            const {
                consultationId,
                name,
                school,
                grade,
                parentPhone,
                prospectStatus = 'contacted',
                plannedStartDate,
                plannedSubjects,
                followUpDate,
                prospectNotes
            } = data;

            // 1. 예비원생 생성 (UnifiedStudent with status: 'prospect')
            // Firebase는 undefined 값을 허용하지 않으므로, 값이 있는 필드만 추가
            const studentData: Record<string, any> = {
                name,
                school: school || '',
                grade: grade || '',
                enrollments: [],
                status: 'prospect',
                startDate: new Date().toISOString().split('T')[0],
                consultationId,
                prospectStatus,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 선택적 필드는 값이 있을 때만 추가
            if (plannedStartDate) studentData.plannedStartDate = plannedStartDate;
            if (plannedSubjects && plannedSubjects.length > 0) studentData.plannedSubjects = plannedSubjects;
            if (followUpDate) studentData.followUpDate = followUpDate;
            if (prospectNotes) studentData.prospectNotes = prospectNotes;

            const studentRef = await addDoc(collection(db, COL_STUDENTS), studentData);
            const studentId = studentRef.id;

            // 2. 상담 기록에 학생 ID 연결
            const consultationRef = doc(db, COL_CONSULTATIONS, consultationId);
            await updateDoc(consultationRef, {
                registeredStudentId: studentId,
                updatedAt: new Date().toISOString()
            });

            console.log(`[useCreateProspect] Created prospect student ${studentId} from consultation ${consultationId}`);
            return studentId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['consultations'] });
        },
        onError: (error) => {
            console.error('[useCreateProspect] Error:', error);
        }
    });
};

/**
 * 예비원생 → 재원생 전환
 */
export interface ConvertToActiveData {
    studentId: string;
    startDate: string;
    enrollments: UnifiedStudent['enrollments'];
}

export const useConvertToActive = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ConvertToActiveData) => {
            const { studentId, startDate, enrollments } = data;

            const studentRef = doc(db, COL_STUDENTS, studentId);
            await updateDoc(studentRef, {
                status: 'active',
                startDate,
                enrollments,
                // 예비원생 필드 삭제 (deleteField()로 완전 제거)
                prospectStatus: deleteField(),
                plannedStartDate: deleteField(),
                plannedSubjects: deleteField(),
                followUpDate: deleteField(),
                updatedAt: new Date().toISOString()
            });

            console.log(`[useConvertToActive] Converted prospect ${studentId} to active student`);
            return studentId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
        onError: (error) => {
            console.error('[useConvertToActive] Error:', error);
        }
    });
};

/**
 * 예비원생 정보 업데이트
 */
export interface UpdateProspectData {
    studentId: string;
    prospectStatus?: 'contacted' | 'pending_registration' | 'pending_test' | 'on_hold';
    plannedStartDate?: string;
    plannedSubjects?: ('math' | 'english')[];
    followUpDate?: string;
    prospectNotes?: string;
}

export const useUpdateProspect = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateProspectData) => {
            const { studentId, ...updates } = data;

            const studentRef = doc(db, COL_STUDENTS, studentId);
            await updateDoc(studentRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });

            console.log(`[useUpdateProspect] Updated prospect ${studentId}`);
            return studentId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
        onError: (error) => {
            console.error('[useUpdateProspect] Error:', error);
        }
    });
};
