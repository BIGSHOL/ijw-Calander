import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { IntegrationSettings, DisplayOptions, CustomGroup } from '../IntegrationViewSettings';
import { EnglishLevel } from '../../../../types';
import { DEFAULT_ENGLISH_LEVELS } from '../englishUtils';
import { storage, STORAGE_KEYS } from '../../../../utils/localStorage';

// Firebase auto-generated doc ID: 20자 alphanumeric
const isFirebaseDocId = (str: string) => /^[a-zA-Z0-9]{15,30}$/.test(str);

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
    showStudents: true,
    showRoom: true,
    showTeacher: true,
    showSchedule: true
};

export const useEnglishSettings = () => {
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [englishLevels, setEnglishLevels] = useState<EnglishLevel[]>(DEFAULT_ENGLISH_LEVELS);

    // Firebase state (shared group settings)
    const [firebaseSettings, setFirebaseSettings] = useState({
        viewMode: 'CUSTOM_GROUP' as IntegrationSettings['viewMode'],
        customGroups: [] as IntegrationSettings['customGroups'],
        showOthersGroup: true,
        othersGroupTitle: '기타 수업',
    });

    // localStorage state (personal display settings)
    const [localDisplayOptions, setLocalDisplayOptions] = useState<DisplayOptions>(() =>
        storage.getJSON<DisplayOptions>(STORAGE_KEYS.ENGLISH_DISPLAY_OPTIONS, DEFAULT_DISPLAY_OPTIONS)
    );
    const [localHiddenTeachers, setLocalHiddenTeachers] = useState<string[]>(() =>
        storage.getJSON<string[]>(STORAGE_KEYS.ENGLISH_HIDDEN_TEACHERS, [])
    );
    const [localHiddenLegendTeachers, setLocalHiddenLegendTeachers] = useState<string[]>(() =>
        storage.getJSON<string[]>(STORAGE_KEYS.ENGLISH_HIDDEN_LEGEND_TEACHERS, [])
    );

    const migrationDone = useRef(false);

    // Load Settings from Firebase (group-related only)
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'english_class_integration'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as IntegrationSettings;
                setFirebaseSettings({
                    viewMode: data.viewMode || 'CUSTOM_GROUP',
                    customGroups: data.customGroups || [],
                    showOthersGroup: data.showOthersGroup ?? true,
                    othersGroupTitle: data.othersGroupTitle || '기타 수업',
                });

                // Migration: if Firebase has display settings but localStorage doesn't
                if (!migrationDone.current) {
                    migrationDone.current = true;
                    const hasLocalDisplay = storage.getString(STORAGE_KEYS.ENGLISH_DISPLAY_OPTIONS) !== null;
                    if (!hasLocalDisplay && data.displayOptions) {
                        setLocalDisplayOptions(data.displayOptions);
                        storage.setJSON(STORAGE_KEYS.ENGLISH_DISPLAY_OPTIONS, data.displayOptions);
                    }
                    const hasLocalHidden = storage.getString(STORAGE_KEYS.ENGLISH_HIDDEN_TEACHERS) !== null;
                    if (!hasLocalHidden && data.hiddenTeachers && data.hiddenTeachers.length > 0) {
                        setLocalHiddenTeachers(data.hiddenTeachers);
                        storage.setJSON(STORAGE_KEYS.ENGLISH_HIDDEN_TEACHERS, data.hiddenTeachers);
                    }
                    const hasLocalLegend = storage.getString(STORAGE_KEYS.ENGLISH_HIDDEN_LEGEND_TEACHERS) !== null;
                    if (!hasLocalLegend && data.hiddenLegendTeachers && data.hiddenLegendTeachers.length > 0) {
                        setLocalHiddenLegendTeachers(data.hiddenLegendTeachers);
                        storage.setJSON(STORAGE_KEYS.ENGLISH_HIDDEN_LEGEND_TEACHERS, data.hiddenLegendTeachers);
                    }
                }
            }
            setSettingsLoading(false);
        });
        return () => unsub();
    }, []);

    // Load English Levels
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'english_levels'), (docSnap) => {
            if (docSnap.exists()) {
                const levels = docSnap.data()?.levels || DEFAULT_ENGLISH_LEVELS;
                setEnglishLevels(levels);
            }
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
                    query(collection(db, 'classes'), where('subject', '==', 'english'))
                );
                const nameToId: Record<string, string> = {};
                classesSnapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.className) {
                        nameToId[data.className] = docSnap.id;
                    }
                });

                const migratedGroups: CustomGroup[] = customGroups.map(g => ({
                    ...g,
                    classes: (g.classes || []).map(ref => {
                        if (isFirebaseDocId(ref)) return ref; // 이미 ID
                        return nameToId[ref] || ref; // 이름 → ID 변환 (매핑 없으면 그대로)
                    })
                }));

                // 변경 사항이 있을 때만 저장
                if (JSON.stringify(migratedGroups) !== JSON.stringify(customGroups)) {
                    await setDoc(doc(db, 'settings', 'english_class_integration'), {
                        ...firebaseSettings,
                        customGroups: migratedGroups,
                    }, { merge: true });
                }
            } catch (err) {
                console.error('[Settings Migration] Failed:', err);
            }
        })();
    }, [settingsLoading, firebaseSettings]);

    // Merged settings object (same shape as before for consumers)
    const settings: IntegrationSettings = {
        ...firebaseSettings,
        displayOptions: localDisplayOptions,
        hiddenTeachers: localHiddenTeachers,
        hiddenLegendTeachers: localHiddenLegendTeachers,
    };

    const updateSettings = useCallback(async (newSettings: IntegrationSettings) => {
        // 안전장치: customGroups가 비어있고 기존 데이터가 있다면 보존
        const safeSettings = { ...newSettings };
        if ((!safeSettings.customGroups || safeSettings.customGroups.length === 0) &&
            firebaseSettings.customGroups && firebaseSettings.customGroups.length > 0) {
            safeSettings.customGroups = firebaseSettings.customGroups;
        }

        // Route display settings to localStorage
        const displayChanged = JSON.stringify(safeSettings.displayOptions) !== JSON.stringify(localDisplayOptions);
        const hiddenChanged = JSON.stringify(safeSettings.hiddenTeachers) !== JSON.stringify(localHiddenTeachers);
        const legendChanged = JSON.stringify(safeSettings.hiddenLegendTeachers) !== JSON.stringify(localHiddenLegendTeachers);

        if (displayChanged && safeSettings.displayOptions) {
            setLocalDisplayOptions(safeSettings.displayOptions);
            storage.setJSON(STORAGE_KEYS.ENGLISH_DISPLAY_OPTIONS, safeSettings.displayOptions);
        }
        if (hiddenChanged) {
            const val = safeSettings.hiddenTeachers || [];
            setLocalHiddenTeachers(val);
            storage.setJSON(STORAGE_KEYS.ENGLISH_HIDDEN_TEACHERS, val);
        }
        if (legendChanged) {
            const val = safeSettings.hiddenLegendTeachers || [];
            setLocalHiddenLegendTeachers(val);
            storage.setJSON(STORAGE_KEYS.ENGLISH_HIDDEN_LEGEND_TEACHERS, val);
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
            await setDoc(doc(db, 'settings', 'english_class_integration'), firebaseData, { merge: true });
        }
    }, [firebaseSettings, localDisplayOptions, localHiddenTeachers, localHiddenLegendTeachers]);

    return {
        settings,
        settingsLoading,
        englishLevels,
        updateSettings
    };
};
