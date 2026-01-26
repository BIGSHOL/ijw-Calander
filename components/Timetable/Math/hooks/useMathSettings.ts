import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { storage, STORAGE_KEYS } from '../../../../utils/localStorage';

// Firebase auto-generated doc ID: 20자 alphanumeric
const isFirebaseDocId = (str: string) => /^[a-zA-Z0-9]{15,30}$/.test(str);

// 수학 통합뷰 설정 인터페이스
export interface MathIntegrationSettings {
    viewMode: 'START_PERIOD' | 'CUSTOM_GROUP';
    customGroups: MathCustomGroup[];
    showOthersGroup: boolean;
    othersGroupTitle: string;
    displayOptions?: MathDisplayOptions;
    hiddenTeachers?: string[];
}

export interface MathCustomGroup {
    id: string;
    title: string;
    classes: string[];  // classId 배열
}

export interface MathDisplayOptions {
    showStudents: boolean;
    showRoom: boolean;
    showTeacher: boolean;
    showSchedule: boolean;
}

const DEFAULT_DISPLAY_OPTIONS: MathDisplayOptions = {
    showStudents: true,
    showRoom: true,
    showTeacher: true,
    showSchedule: true
};

export const useMathSettings = () => {
    const [settingsLoading, setSettingsLoading] = useState(true);

    // Firebase state (shared group settings)
    const [firebaseSettings, setFirebaseSettings] = useState({
        viewMode: 'START_PERIOD' as MathIntegrationSettings['viewMode'],
        customGroups: [] as MathIntegrationSettings['customGroups'],
        showOthersGroup: true,
        othersGroupTitle: '기타 수업',
    });

    // localStorage state (personal display settings)
    const [localDisplayOptions, setLocalDisplayOptions] = useState<MathDisplayOptions>(() =>
        storage.getJSON<MathDisplayOptions>(STORAGE_KEYS.MATH_DISPLAY_OPTIONS, DEFAULT_DISPLAY_OPTIONS)
    );
    const [localHiddenTeachers, setLocalHiddenTeachers] = useState<string[]>(() =>
        storage.getJSON<string[]>(STORAGE_KEYS.MATH_HIDDEN_TEACHERS, [])
    );

    const migrationDone = useRef(false);

    // Load Settings from Firebase (group-related only)
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'math_class_integration'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as MathIntegrationSettings;
                setFirebaseSettings({
                    viewMode: data.viewMode || 'START_PERIOD',
                    customGroups: data.customGroups || [],
                    showOthersGroup: data.showOthersGroup ?? true,
                    othersGroupTitle: data.othersGroupTitle || '기타 수업',
                });

                // Migration: if Firebase has display settings but localStorage doesn't
                if (!migrationDone.current) {
                    migrationDone.current = true;
                    const hasLocalDisplay = storage.getString(STORAGE_KEYS.MATH_DISPLAY_OPTIONS) !== null;
                    if (!hasLocalDisplay && data.displayOptions) {
                        setLocalDisplayOptions(data.displayOptions);
                        storage.setJSON(STORAGE_KEYS.MATH_DISPLAY_OPTIONS, data.displayOptions);
                    }
                    const hasLocalHidden = storage.getString(STORAGE_KEYS.MATH_HIDDEN_TEACHERS) !== null;
                    if (!hasLocalHidden && data.hiddenTeachers && data.hiddenTeachers.length > 0) {
                        setLocalHiddenTeachers(data.hiddenTeachers);
                        storage.setJSON(STORAGE_KEYS.MATH_HIDDEN_TEACHERS, data.hiddenTeachers);
                    }
                }
            }
            setSettingsLoading(false);
        });
        return () => unsub();
    }, []);

    // Migration: className 기반 customGroups → classId 기반으로 자동 변환
    const classIdMigrationDone = useRef(false);
    useEffect(() => {
        if (settingsLoading || classIdMigrationDone.current) return;
        const customGroups = firebaseSettings.customGroups;
        if (!customGroups || customGroups.length === 0) return;

        // 모든 classes 항목이 이미 Firebase doc ID 형식인지 확인
        const allClassRefs = customGroups.flatMap(g => g.classes || []);
        if (allClassRefs.length === 0) return;
        const needsMigration = allClassRefs.some(ref => !isFirebaseDocId(ref));
        if (!needsMigration) return;

        classIdMigrationDone.current = true;

        // 마이그레이션 실행: className으로 classes 컬렉션 조회 → docId 매핑
        (async () => {
            try {
                const classesSnapshot = await getDocs(
                    query(collection(db, 'classes'), where('subject', '==', '수학'))
                );
                const nameToId: Record<string, string> = {};
                classesSnapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.className) {
                        nameToId[data.className] = docSnap.id;
                    }
                });

                const migratedGroups: MathCustomGroup[] = customGroups.map(g => ({
                    ...g,
                    classes: (g.classes || []).map(ref => {
                        if (isFirebaseDocId(ref)) return ref; // 이미 ID
                        return nameToId[ref] || ref; // 이름 → ID 변환 (매핑 없으면 그대로)
                    })
                }));

                // 변경 사항이 있을 때만 저장
                if (JSON.stringify(migratedGroups) !== JSON.stringify(customGroups)) {
                    console.log('[Math Settings Migration] className → classId 변환 완료:', migratedGroups);
                    await setDoc(doc(db, 'settings', 'math_class_integration'), {
                        ...firebaseSettings,
                        customGroups: migratedGroups,
                    }, { merge: true });
                }
            } catch (err) {
                console.error('[Math Settings Migration] Failed:', err);
            }
        })();
    }, [settingsLoading, firebaseSettings]);

    // Merged settings object (same shape as before for consumers)
    const settings: MathIntegrationSettings = {
        ...firebaseSettings,
        displayOptions: localDisplayOptions,
        hiddenTeachers: localHiddenTeachers,
    };

    const updateSettings = useCallback(async (newSettings: MathIntegrationSettings) => {
        // 안전장치: customGroups가 비어있고 기존 데이터가 있다면 보존
        const safeSettings = { ...newSettings };
        if ((!safeSettings.customGroups || safeSettings.customGroups.length === 0) &&
            firebaseSettings.customGroups && firebaseSettings.customGroups.length > 0) {
            safeSettings.customGroups = firebaseSettings.customGroups;
        }

        // Route display settings to localStorage
        const displayChanged = JSON.stringify(safeSettings.displayOptions) !== JSON.stringify(localDisplayOptions);
        const hiddenChanged = JSON.stringify(safeSettings.hiddenTeachers) !== JSON.stringify(localHiddenTeachers);

        if (displayChanged && safeSettings.displayOptions) {
            setLocalDisplayOptions(safeSettings.displayOptions);
            storage.setJSON(STORAGE_KEYS.MATH_DISPLAY_OPTIONS, safeSettings.displayOptions);
        }
        if (hiddenChanged) {
            const val = safeSettings.hiddenTeachers || [];
            setLocalHiddenTeachers(val);
            storage.setJSON(STORAGE_KEYS.MATH_HIDDEN_TEACHERS, val);
        }

        // Route group settings to Firebase
        const firebaseChanged =
            safeSettings.viewMode !== firebaseSettings.viewMode ||
            JSON.stringify(safeSettings.customGroups) !== JSON.stringify(firebaseSettings.customGroups) ||
            safeSettings.showOthersGroup !== firebaseSettings.showOthersGroup ||
            safeSettings.othersGroupTitle !== firebaseSettings.othersGroupTitle;

        if (firebaseChanged) {
            const firebaseData = {
                viewMode: safeSettings.viewMode,
                customGroups: safeSettings.customGroups,
                showOthersGroup: safeSettings.showOthersGroup,
                othersGroupTitle: safeSettings.othersGroupTitle,
            };
            setFirebaseSettings(firebaseData);
            await setDoc(doc(db, 'settings', 'math_class_integration'), firebaseData, { merge: true });
        }
    }, [firebaseSettings, localDisplayOptions, localHiddenTeachers]);

    return {
        settings,
        settingsLoading,
        updateSettings
    };
};
