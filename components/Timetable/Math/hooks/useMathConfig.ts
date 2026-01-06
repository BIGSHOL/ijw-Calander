import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
    const [isTeacherOrderModalOpen, setIsTeacherOrderModalOpen] = useState(false);
    const [isWeekdayOrderModalOpen, setIsWeekdayOrderModalOpen] = useState(false);

    // Load Math Config from Firestore
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'math_config'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMathConfig({
                        teacherOrder: data.teacherOrder || [],
                        weekdayOrder: data.weekdayOrder || []
                    });
                }
            } catch (error) {
                console.error('Math config 로딩 실패:', error);
            }
        };
        loadConfig();
    }, []);

    const handleSaveTeacherOrder = async (newOrder: string[]) => {
        try {
            await setDoc(doc(db, 'settings', 'math_config'), { teacherOrder: newOrder }, { merge: true });
            setMathConfig(prev => ({ ...prev, teacherOrder: newOrder }));
        } catch (error) {
            console.error('강사 순서 저장 실패:', error);
            alert('강사 순서 저장에 실패했습니다.');
        }
    };

    const handleSaveWeekdayOrder = async (newOrder: string[]) => {
        try {
            await setDoc(doc(db, 'settings', 'math_config'), { weekdayOrder: newOrder }, { merge: true });
            setMathConfig(prev => ({ ...prev, weekdayOrder: newOrder }));
        } catch (error) {
            console.error('요일 순서 저장 실패:', error);
            alert('요일 순서 저장에 실패했습니다.');
        }
    };

    return {
        mathConfig,
        isTeacherOrderModalOpen,
        setIsTeacherOrderModalOpen,
        isWeekdayOrderModalOpen,
        setIsWeekdayOrderModalOpen,
        handleSaveTeacherOrder,
        handleSaveWeekdayOrder
    };
};
