import React, { useState } from 'react';
import { UserProfile, ROLE_LABELS } from '../../../types';
import { Search, Shield, ShieldCheck, Users, UserCog, Calendar } from 'lucide-react';

interface UsersTabProps {
    localUsers: UserProfile[];
    currentUserProfile?: UserProfile | null;
    isMaster: boolean;
    isAdmin: boolean;
    canManageUsers: boolean;
    setSelectedUserForEdit: (uid: string) => void;
    setTargetUserForEvents: (user: UserProfile) => void;
    setInitialPermissions: (permissions: any) => void;
}

const UsersTab: React.FC<UsersTabProps> = ({
    localUsers,
    currentUserProfile,
    isMaster,
    isAdmin,
    canManageUsers,
    setSelectedUserForEdit,
    setTargetUserForEvents,
    setInitialPermissions,
}) => {
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userTab, setUserTab] = useState<'approved' | 'pending'>('approved');

    if (!canManageUsers) return null;

    return (
        <div className="max-w-5xl mx-auto h-full flex flex-col">
            {/* Sub-Tabs for User Management */}
            <div className="flex gap-4 mb-4 border-b border-gray-200">
                <button
                    onClick={() => setUserTab('approved')}
                    className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${userTab === 'approved' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    정회원 (Members)
                    <span className={`text-xxs px-1.5 py-0.5 rounded-sm ${userTab === 'approved' ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                        {localUsers.filter(u => u.status === 'approved').length}
                    </span>
                </button>
                <button
                    onClick={() => setUserTab('pending')}
                    className={`pb-2 px-1 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${userTab === 'pending' ? 'border-accent text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    승인 대기 (Requests)
                    {localUsers.filter(u => u.status === 'pending').length > 0 && (
                        <span className="w-2 h-2 rounded-sm bg-red-500 animate-pulse" />
                    )}
                    <span className={`text-xxs px-1.5 py-0.5 rounded-sm ${userTab === 'pending' ? 'bg-accent text-primary' : 'bg-gray-100'}`}>
                        {localUsers.filter(u => u.status === 'pending').length}
                    </span>
                </button>
            </div>

            <div className="flex justify-between items-center mb-4">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="이름/이메일 검색..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:border-accent outline-none"
                    />
                </div>
                <div className="text-xs text-gray-500 font-bold">
                    {userTab === 'approved' ? '승인된 사용자' : '승인 대기중인 사용자'}
                </div>
            </div>

            {/* Table Header */}
            <div className="bg-gray-100 rounded-t-xl border-x border-t border-gray-200 grid grid-cols-12 gap-4 p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className="col-span-4 pl-2">이메일</div>
                <div className="col-span-2 text-center">호칭</div>
                <div className="col-span-2 text-center">권한(Role)</div>
                <div className="col-span-2 text-center">상태</div>
                <div className="col-span-2 text-center">관리</div>
            </div>

            {/* Table Body */}
            <div className="bg-white border text-sm flex-1 overflow-y-auto rounded-b-xl">
                {localUsers
                    .filter(u => {
                        // 1. Text Search
                        const matchesSearch = u.email.includes(userSearchTerm) || u.jobTitle?.includes(userSearchTerm);
                        // 2. Tab Filter
                        const matchesTab = userTab === 'approved'
                            ? u.status === 'approved'
                            : (u.status === 'pending' || u.status === 'rejected'); // Show Pending and Rejected in separate tab
                        return matchesSearch && matchesTab;
                    })
                    .sort((a, b) => (a.role === 'master' ? -1 : 1)) // Master first
                    .map(user => (
                        <div key={user.uid} className={`grid grid-cols-12 gap-4 p-3 border-b border-gray-100 last:border-0 hover:bg-yellow-50/30 items-center transition-colors`}>
                            {/* User Info */}
                            <div className="col-span-4 flex items-center gap-3 pl-2">
                                <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${user.role === 'master' ? 'bg-accent text-primary' : user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'} `}>
                                    {user.role === 'master' ? <ShieldCheck size={14} /> : user.role === 'admin' ? <Shield size={14} /> : <Users size={14} />}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-primary truncate">{user.email}</div>
                                </div>
                            </div>

                            {/* Job Title */}
                            <div className="col-span-2 text-center">
                                <span className="text-gray-600 font-medium">{user.jobTitle || '-'}</span>
                            </div>

                            {/* Role */}
                            <div className="col-span-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-xxs font-black ${user.role === 'master' ? 'bg-red-100 text-red-700' :
                                    user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                        user.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                                            user.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                                                user.role === 'math_lead' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-300' :
                                                    user.role === 'english_lead' ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-300' :
                                                        user.role === 'math_teacher' ? 'bg-green-50 text-green-600 border border-green-200' :
                                                            user.role === 'english_teacher' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                                                                user.role === 'user' ? 'bg-gray-100 text-gray-600' :
                                                                    user.role === 'viewer' ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-gray-50 text-gray-400'
                                    }`}>
                                    {ROLE_LABELS[user.role] || user.role.toUpperCase()}
                                </span>
                            </div>

                            {/* Status */}
                            <div className="col-span-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-xxs font-bold ${user.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                    {user.status === 'approved' ? '승인됨' : user.status === 'pending' ? '대기중' : '차단됨'}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 flex justify-center">
                                <button
                                    onClick={() => {
                                        // Security Check: Only Master can edit Master accounts
                                        // Admin can edit everyone except Master (including themselves and other Admins)
                                        if (user.role === 'master' && !isMaster) {
                                            alert("접근 권한이 없습니다. 마스터 계정은 마스터만 관리할 수 있습니다.");
                                            return;
                                        }

                                        // Pre-load logic (Moved from parent)
                                        // The parent will handle the actual modal opening via setSelectedUserForEdit
                                        setInitialPermissions(JSON.parse(JSON.stringify(user.departmentPermissions || {})));
                                        setSelectedUserForEdit(user.uid);
                                    }}
                                    className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-sm transition-colors flex items-center gap-1 text-xs font-bold"
                                >
                                    <UserCog size={16} /> <span className="hidden xl:inline">설정</span>
                                </button>
                                {(isMaster || isAdmin) && (
                                    <button
                                        onClick={() => setTargetUserForEvents(user)}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-sm transition-colors flex items-center gap-1 text-xs font-bold"
                                    >
                                        <Calendar size={16} /> <span className="hidden xl:inline">일정</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default UsersTab;
