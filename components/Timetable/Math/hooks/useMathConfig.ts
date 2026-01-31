import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';

export interface MathConfig {
    teacherOrder: string[];
    weekdayOrder: string[];
}

export const useMathConfig = () => {
    const [mathConfig, setMathConfig] = useState<MathConfig>({
        teacherOrder: [],
        weekdayOrder: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isTeacherOrderModalOpen, setIsTeacherOrderModalOpen] = useState(false);
    const [isWeekdayOrderModalOpen, setIsWeekdayOrderModalOpen] = useState(false);

    // Real-time sync (onSnapshot) - 영어 시간표와 동일하게 실시간 반영
    useEffect(() => {
        const unsubscribe = onSnapshot(
            doc(db, 'settings', 'math_config'),
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMathConfig({
                        teacherOrder: data.teacherOrder || [],
                        weekdayOrder: data.weekdayOrder || [],
                    });
                }
                setIsLoading(false);
            },
            (error) => {
                console.error('Math config 실시간 동기화 실패:', error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const handleSaveTeacherOrder = async (newOrder: string[]) => {
        try {
            await setDoc(doc(db, 'settings', 'math_config'), { teacherOrder: newOrder }, { merge: true });
            // onSnapshot이 자동으로 mathConfig를 업데이트함
        } catch (error) {
            console.error('강사 순서 저장 실패:', error);
            alert('강사 순서 저장에 실패했습니다.');
        }
    };

    const handleSaveWeekdayOrder = async (newOrder: string[]) => {
        try {
            await setDoc(doc(db, 'settings', 'math_config'), { weekdayOrder: newOrder }, { merge: true });
            // onSnapshot이 자동으로 mathConfig를 업데이트함
        } catch (error) {
            console.error('요일 순서 저장 실패:', error);
            alert('요일 순서 저장에 실패했습니다.');
        }
    };

    return {
        mathConfig,
        isLoading,
        isTeacherOrderModalOpen,
        setIsTeacherOrderModalOpen,
        isWeekdayOrderModalOpen,
        setIsWeekdayOrderModalOpen,
        handleSaveTeacherOrder,
        handleSaveWeekdayOrder
    };
};
