import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { TimetableClass } from '../../../../types';

export const useTimetableClasses = () => {
    const [classes, setClasses] = useState<TimetableClass[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, '수업목록'), orderBy('className'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedClasses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TimetableClass));
            setClasses(loadedClasses);
            setLoading(false);
        }, (error) => {
            console.error("수업 목록 로딩 에러:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { classes, loading };
};
