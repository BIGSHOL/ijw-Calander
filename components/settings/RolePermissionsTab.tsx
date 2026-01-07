import React, { useState, useEffect } from 'react';
import {
    RolePermissions,
    DEFAULT_ROLE_PERMISSIONS,
    ROLE_HIERARCHY,
    ROLE_LABELS,
    PermissionId
} from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, onSnapshot } from 'firebase/firestore';
import { RotateCcw, Save } from 'lucide-react';

interface RolePermissionsTabProps {
    isMaster: boolean;
    isAdmin: boolean;
    currentUserRole?: string;
}

const RolePermissionsTab: React.FC<RolePermissionsTabProps> = ({
    isMaster,
    isAdmin,
    currentUserRole
}) => {
    // --- State ---
    const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
    const [rolePermissionsLoaded, setRolePermissionsLoaded] = useState(false);

    const canViewRolePermissions = isMaster || isAdmin || currentUserRole === 'manager';

    // --- Firestore Subscription ---
    useEffect(() => {
        if (!canViewRolePermissions) return;

        const unsubscribe = onSnapshot(doc(db, 'settings', 'rolePermissions'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as RolePermissions;
                // Merge with defaults
                const merged: RolePermissions = {};
                for (const role of ROLE_HIERARCHY.filter(r => r !== 'master') as (keyof RolePermissions)[]) {
                    merged[role] = {
                        ...DEFAULT_ROLE_PERMISSIONS[role],
                        ...(data[role] || {})
                    };
                }
                setRolePermissions(merged);
            } else {
                setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
            }
            setRolePermissionsLoaded(true);
        });
        return () => unsubscribe();
    }, [canViewRolePermissions]);

    // --- Handlers ---
    const handleResetToDefaults = () => {
        if (confirm('모든 권한을 기본값으로 초기화하시겠습니까?')) {
            setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
        }
    };

    const handleSave = async () => {
        try {
            await setDoc(doc(db, 'settings', 'rolePermissions'), rolePermissions);
            alert('역할별 권한이 저장되었습니다.');
        } catch (e) {
            console.error(e);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handlePermissionChange = (role: string, permId: PermissionId, checked: boolean) => {
        if (!isMaster) return;

        setRolePermissions(prev => {
            const rolePerms = { ...prev[role as keyof RolePermissions] };
            rolePerms[permId] = checked;

            // Define Linked Pairs (Manage -> View)
            const linkedPairs: { manage: PermissionId; view: PermissionId }[] = [
                { manage: 'timetable.math.edit', view: 'timetable.math.view' },
                { manage: 'timetable.english.edit', view: 'timetable.english.view' },
                { manage: 'system.teachers.edit', view: 'system.teachers.view' },
                { manage: 'system.classes.edit', view: 'system.classes.view' },
            ];

            // 1. If "Manage" is CHECKED -> Auto-check "View"
            const pairForManage = linkedPairs.find(p => p.manage === permId);
            if (checked && pairForManage) {
                rolePerms[pairForManage.view] = true;
            }

            // 2. If "View" is UNCHECKED -> Auto-uncheck "Manage"
            const pairForView = linkedPairs.find(p => p.view === permId);
            if (!checked && pairForView) {
                rolePerms[pairForView.manage] = false;
            }

            return {
                ...prev,
                [role]: rolePerms
            };
        });
    };

    // --- Permission Sections ---
    const eventPermissions = [
        { id: 'events.create' as PermissionId, label: '일정 생성', desc: '새 일정 추가 (버튼, 드래그)' },
        { id: 'events.manage_own' as PermissionId, label: '본인 일정 관리', desc: '본인이 만든 일정 수정/삭제' },
        { id: 'events.manage_others' as PermissionId, label: '타인 일정 관리', desc: '다른 사용자 일정 수정/삭제' },
        { id: 'events.drag_move' as PermissionId, label: '일정 드래그 이동', desc: '드래그로 날짜/시간 변경' },
        { id: 'events.attendance' as PermissionId, label: '참가 현황 변경', desc: '참석/불참 표시 관리' },
        { id: 'events.bucket' as PermissionId, label: '버킷리스트', desc: '하위 역할의 버킷아이템 수정/삭제' },
    ];

    const deptPermissions = [
        { id: 'departments.view_all' as PermissionId, label: '모든 부서 조회', desc: '숨겨진 부서 포함 조회' },
        { id: 'departments.manage' as PermissionId, label: '부서 관리', desc: '부서 생성/수정/삭제' },
    ];

    const userPermissions = [
        { id: 'users.view' as PermissionId, label: '사용자 목록 조회', desc: '전체 사용자 조회' },
        { id: 'users.approve' as PermissionId, label: '신규 사용자 승인', desc: '가입 신청 승인/거부' },
        { id: 'users.change_role' as PermissionId, label: '역할 변경', desc: '사용자 역할 변경' },
        { id: 'users.change_permissions' as PermissionId, label: '세부 권한 변경', desc: '부서별 접근 권한 설정' },
    ];

    const teacherPermissions = [
        { id: 'system.teachers.view' as PermissionId, label: '강사 목록 조회', desc: '강사 리스트 보기' },
        { id: 'system.teachers.edit' as PermissionId, label: '강사 정보 관리', desc: '강사 추가/수정/삭제' },
    ];

    const classPermissions = [
        { id: 'system.classes.view' as PermissionId, label: '수업 키워드 조회', desc: '수업 색상 규칙 보기' },
        { id: 'system.classes.edit' as PermissionId, label: '수업 키워드 관리', desc: '수업 자동 색상 규칙 관리' },
    ];

    const timetablePermissions = [
        { id: 'timetable.math.view' as PermissionId, label: '수학 시간표 조회', desc: '수학 시간표 접근' },
        { id: 'timetable.math.edit' as PermissionId, label: '수학 시간표 관리', desc: '수학 수업 수정/학급관리' },
        { id: 'timetable.english.view' as PermissionId, label: '영어 시간표 조회', desc: '영어 시간표 접근' },
        { id: 'timetable.english.edit' as PermissionId, label: '영어 시간표 관리', desc: '영어 수업 수정/학생관리' },
        { id: 'timetable.english.simulation' as PermissionId, label: '영어 시뮬레이션 모드', desc: '시뮬레이션 모드 진입 및 토글' },
        { id: 'timetable.english.backup.view' as PermissionId, label: '영어 백업 조회', desc: '시간표 백업 기록 보기' },
        { id: 'timetable.english.backup.restore' as PermissionId, label: '영어 백업 복원', desc: '이전 백업으로 복원' },
        { id: 'timetable.integrated.view' as PermissionId, label: '영어 통합/강사 뷰 접근', desc: '영어 전체 강사/교실 통합 시간표 접근' },
    ];

    const settingsPermissions = [
        { id: 'settings.access' as PermissionId, label: '설정 메뉴 접근', desc: '설정 화면 열기 및 접근' },
        { id: 'settings.holidays' as PermissionId, label: '공휴일 관리', desc: '공휴일 추가/수정/삭제' },
        { id: 'settings.role_permissions' as PermissionId, label: '역할별 권한 설정', desc: '역할 기반 권한 체계 설정', disabled: true },
    ];

    // Attendance Permissions (Consolidated)
    const attendancePermissions = [
        { id: 'attendance.manage_own' as PermissionId, label: '본인 출석부 관리', desc: '본인 수업의 학생/출석 조회 및 수정' },
        { id: 'attendance.edit_all' as PermissionId, label: '전체 출석 수정', desc: '모든 수업의 출석 기록 수정' },
        { id: 'attendance.manage_math' as PermissionId, label: '수학 출석부 관리', desc: '수학 전체 조회 + 강사 선택 가능' },
        { id: 'attendance.manage_english' as PermissionId, label: '영어 출석부 관리', desc: '영어 전체 조회 + 강사 선택 가능' },
    ];

    // --- Render Permission Row ---
    const renderPermissionRow = (perm: { id: PermissionId; label: string; desc: string; disabled?: boolean }) => (
        <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50/50">
            <td className="px-4 py-2.5 sticky left-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                <div className="text-gray-700">
                    {perm.label}
                    {/* {perm.disabled && <span className="text-[10px] text-red-400 ml-2">(MASTER 전용)</span>} */}
                </div>
                <div className="text-[10px] text-gray-400">{perm.desc}</div>
            </td>
            {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                <td key={role} className="text-center px-3 py-2.5">
                    <input
                        type="checkbox"
                        checked={perm.disabled ? false : (rolePermissions[role as keyof RolePermissions]?.[perm.id] ?? false)}
                        disabled={!isMaster /*|| perm.disabled*/}
                        onChange={(e) => {
                            if (isMaster /*&& !perm.disabled*/) {
                                handlePermissionChange(role, perm.id, e.target.checked);
                            }
                        }}
                        className={`w-4 h-4 accent-[#081429] ${(!isMaster /*|| perm.disabled*/) ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                </td>
            ))}
        </tr>
    );

    if (!canViewRolePermissions) return null;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">
                                {isMaster
                                    ? '각 역할이 수행할 수 있는 기능을 세부적으로 설정합니다.'
                                    : '현재 설정된 역할별 권한을 확인할 수 있습니다.'}
                            </p>
                        </div>
                        {!isMaster && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-bold">읽기 전용</span>
                        )}
                    </div>
                </div>

                {!rolePermissionsLoaded ? (
                    <div className="p-8 text-center text-gray-500">권한 정보를 불러오는 중...</div>
                ) : (
                    <div className="overflow-auto max-h-[60vh]">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-30">
                                <tr>
                                    <th className="text-left px-4 py-3 font-bold text-gray-700 sticky left-0 z-20 bg-gray-50 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">권한</th>
                                    {ROLE_HIERARCHY.filter(r => r !== 'master').map(role => (
                                        <th key={role} className="text-center px-3 py-3 font-bold text-gray-700 min-w-[90px]">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black whitespace-nowrap ${role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
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
                                {/* 일정 관리 섹션 */}
                                <tr className="bg-blue-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-blue-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-blue-50">📅 연간 일정 (Calendar) - 일정</td>
                                </tr>
                                {eventPermissions.map(renderPermissionRow)}

                                {/* 부서 관리 섹션 */}
                                <tr className="bg-green-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-green-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-green-50">⚙️ 시스템 (System) - 부서 관리</td>
                                </tr>
                                {deptPermissions.map(renderPermissionRow)}

                                {/* 강사 관리 섹션 */}
                                <tr className="bg-emerald-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-emerald-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-emerald-50">⚙️ 시스템 (System) - 강사 관리</td>
                                </tr>
                                {teacherPermissions.map(renderPermissionRow)}

                                {/* 수업 관리 섹션 */}
                                <tr className="bg-rose-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-rose-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-rose-50">⚙️ 시스템 (System) - 수업 관리</td>
                                </tr>
                                {classPermissions.map(renderPermissionRow)}

                                {/* 시간표 관리 섹션 */}
                                <tr className="bg-indigo-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-indigo-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-indigo-50">📋 시간표 (Timetable)</td>
                                </tr>
                                {timetablePermissions.map(renderPermissionRow)}

                                {/* 출석부 섹션 (NEW) */}
                                <tr className="bg-teal-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-teal-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-teal-50">📝 출석부 (Attendance)</td>
                                </tr>
                                {attendancePermissions.map(renderPermissionRow)}

                                {/* 시스템 설정 섹션 */}
                                <tr className="bg-orange-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-orange-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-orange-50">⚙️ 시스템 설정</td>
                                </tr>
                                {settingsPermissions.map(renderPermissionRow)}

                                {/* 사용자 관리 섹션 */}
                                <tr className="bg-purple-50/50">
                                    <td colSpan={7} className="px-4 py-2 font-bold text-purple-700 text-xs uppercase tracking-wider sticky left-0 z-10 bg-purple-50">👥 사용자 관리</td>
                                </tr>
                                {userPermissions.map(renderPermissionRow)}
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

export default RolePermissionsTab;
