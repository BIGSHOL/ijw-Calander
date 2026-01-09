import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { IntegrationSettings } from '../IntegrationViewSettings';
import { EnglishLevel } from '../../../../types';
import { DEFAULT_ENGLISH_LEVELS } from '../englishUtils';

export const useEnglishSettings = () => {
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [englishLevels, setEnglishLevels] = useState<EnglishLevel[]>(DEFAULT_ENGLISH_LEVELS);
    const [settings, setSettings] = useState<IntegrationSettings>({
        viewMode: 'CUSTOM_GROUP',
        customGroups: [],
        showOthersGroup: true,
        othersGroupTitle: '기타 수업',
        displayOptions: {
            showStudents: true,
            showRoom: true,
            showTeacher: true
        },
        hiddenTeachers: [],
        hiddenLegendTeachers: []
    });

    // Load Settings
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'english_class_integration'), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as IntegrationSettings;
                setSettings({
                    ...data,
                    displayOptions: data.displayOptions || {
                        showStudents: true,
                        showRoom: true,
                        showTeacher: true
                    }
                });
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

    const updateSettings = async (newSettings: IntegrationSettings) => {
        // 안전장치: customGroups가 비어있고 기존 데이터가 있다면 보존
        const safeSettings = { ...newSettings };
        if ((!safeSettings.customGroups || safeSettings.customGroups.length === 0) &&
            settings.customGroups && settings.customGroups.length > 0) {
            safeSettings.customGroups = settings.customGroups;
        }

        setSettings(safeSettings);
        await setDoc(doc(db, 'settings', 'english_class_integration'), safeSettings, { merge: true });
    };

    return {
        settings,
        settingsLoading,
        englishLevels,
        updateSettings
    };
};
