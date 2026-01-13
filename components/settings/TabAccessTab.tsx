import React, { useState, useEffect } from 'react';
import {
    TabPermissionConfig,
    DEFAULT_TAB_PERMISSIONS,
    ROLE_HIERARCHY,
    ROLE_LABELS,
    APP_TABS,
    AppTab,
    UserRole
} from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, onSnapshot } from 'firebase/firestore';
import { listenerRegistry } from '../../utils/firebaseCleanup';
import { RotateCcw, Save, Layout } from 'lucide-react';

interface TabAccessTabProps {
    isMaster: boolean;
    isAdmin: boolean;
    currentUserRole?: string;
}

const TabAccessTab: React.FC<TabAccessTabProps> = ({
    isMaster,
    isAdmin,
    currentUserRole
}) => {
    // --- State ---
    const [tabPermissions, setTabPermissions] = useState<TabPermissionConfig>(DEFAULT_TAB_PERMISSIONS);
    const [loaded, setLoaded] = useState(false);

    // Only Master/Admin/Manager can view (adjust as needed)
    const canView = isMaster || isAdmin || currentUserRole === 'manager';

    // --- Firestore Subscription ---
    useEffect(() => {
        if (!canView) return;

        const unsubscribe = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const fetchedPerms = data.tabPermissions as TabPermissionConfig | undefined;

                if (fetchedPerms) {
                    // Merge with defaults to ensure all roles exist
                    const merged: TabPermissionConfig = {};
                    for (const role of ROLE_HIERARCHY.filter(r => r !== 'master') as UserRole[]) {
                        merged[role] = fetchedPerms[role] || [];
                    }
                    merged.master = ['calendar', 'timetable', 'attendance', 'payment', 'gantt', 'consultation']; // Master always full access
                    setTabPermissions(merged);
                } else {
                    setTabPermissions(DEFAULT_TAB_PERMISSIONS);
                }
            } else {
                setTabPermissions(DEFAULT_TAB_PERMISSIONS);
            }
            setLoaded(true);
        });

        return listenerRegistry.register('TabAccessTab', unsubscribe);
    }, [canView]);

    // --- Handlers ---
    const handleResetToDefaults = () => {
        if (confirm('모든 탭 접근 권한을 기본값으로 초기화하시겠습니까?')) {
            setTabPermissions(DEFAULT_TAB_PERMISSIONS);
        }
    };

    const handleSave = async () => {
        try {
            await setDoc(doc(db, 'system', 'config'), { tabPermissions }, { merge: true });
            alert('탭 접근 권한이 저장되었습니다.');
        } catch (e) {
            console.error(e);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleToggleAccess = (role: UserRole, tabId: AppTab, checked: boolean) => {
        if (!isMaster) return;

        setTabPermissions(prev => {
            const currentTabs = prev[role] || [];
            let newTabs: AppTab[];

            if (checked) {
                // Add tab if not exists
                if (!currentTabs.includes(tabId)) {
                    newTabs = [...currentTabs, tabId];
                } else {
                    newTabs = currentTabs;
                }
            } else {
                // Remove tab
                newTabs = currentTabs.filter(t => t !== tabId);
            }

            return {
                ...prev,
                [role]: newTabs
            };
        });
    };

    if (!canView) return null;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Layout size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800">탭 접근 관리</h3>
                                <p className="text-xs text-gray-500">
                                    {isMaster
                                        ? '각 역할이 접근할 수 있는 최상위 탭(메뉴)을 설정합니다.'
                                        : '역할별 탭 접근 권한 현황입니다.'}
                                </p>
                            </div>
                        </div>
                        {!isMaster && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-bold">읽기 전용</span>
                        )}
                    </div>
                </div>

                {!loaded ? (
                    <div className="p-8 text-center text-gray-500">권한 정보를 불러오는 중...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-bold text-gray-700 sticky left-0 bg-gray-50 min-w-[150px]">메뉴(탭)</th>
                                    {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                                        <th key={role} className="text-center px-3 py-3 font-bold text-gray-700 min-w-[90px]">
                                            <span className={`px-2 py-1 rounded text-xxs font-black whitespace-nowrap ${role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                                role === 'manager' ? 'bg-purple-100 text-purple-700' :
                                                    role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                                        role === 'math_lead' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300' :
                                                            role === 'english_lead' ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-300' :
                                                                role === 'math_teacher' ? 'bg-green-50 text-green-600 border border-green-200' :
                                                                    role === 'english_teacher' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                                                                        role === 'user' ? 'bg-gray-100 text-gray-600' :
                                                                            role === 'viewer' ? 'bg-yellow-100 text-yellow-700' :
                                                                                'bg-gray-100 text-gray-400'
                                                }`}>
                                                {ROLE_LABELS[role]}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {APP_TABS.map((tab) => (
                                    <tr key={tab.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                        <td className="px-4 py-3 sticky left-0 bg-white">
                                            <div className="font-bold text-gray-700">{tab.label}</div>
                                            <div className="text-xxs text-gray-400 font-mono mt-0.5">{tab.id}</div>
                                        </td>
                                        {ROLE_HIERARCHY.filter(r => r !== 'master').map((role) => {
                                            const isChecked = tabPermissions[role as UserRole]?.includes(tab.id) ?? false;
                                            return (
                                                <td key={role} className="text-center px-3 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        disabled={!isMaster}
                                                        onChange={(e) => handleToggleAccess(role as UserRole, tab.id, e.target.checked)}
                                                        className={`w-4 h-4 accent-[#081429] ${!isMaster ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Actions (MASTER only) */}
                {isMaster && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                        <button
                            onClick={handleResetToDefaults}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 flex items-center gap-2"
                        >
                            <RotateCcw size={14} /> 기본값으로 초기화
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:bg-[#0a1a35] flex items-center gap-2"
                        >
                            <Save size={14} /> 저장
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TabAccessTab;
