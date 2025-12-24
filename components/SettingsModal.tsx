import React, { useState, useEffect } from 'react';
import { Department, UserProfile } from '../types';
import { X, Plus, Trash2, GripVertical, FolderKanban, Users, Check, XCircle, Shield, ShieldAlert, ShieldCheck, Database, CheckCircle2, Search, Save, Edit, ChevronRight, UserCog } from 'lucide-react';
import { db, auth } from '../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, onSnapshot, updateDoc } from 'firebase/firestore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  currentUserProfile?: UserProfile | null;
  users: UserProfile[];
}

type TabMode = 'departments' | 'users' | 'system';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  departments,
  currentUserProfile,
  users,
}) => {
  const isMaster = currentUserProfile?.role === 'master';
  const isAdmin = currentUserProfile?.role === 'admin';
  const canManageMenus = isMaster || isAdmin || currentUserProfile?.canManageMenus === true;
  const canManageUsers = isMaster || isAdmin; // Only Master and Admin can manage users

  const [activeTab, setActiveTab] = useState<TabMode>('departments');
  const [newDeptName, setNewDeptName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deptSearchTerm, setDeptSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState(''); // New User Search

  // --- Local Buffered State ---
  const [localDepartments, setLocalDepartments] = useState<Department[]>([]);
  const [localUsers, setLocalUsers] = useState<UserProfile[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // --- User Detail Modal State ---
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<string | null>(null); // UID

  // Sync Props to Local State (Smart Merge)
  useEffect(() => {
    if (!isOpen) return;
    setLocalDepartments(prev => {
      const prevMap = new Map(prev.map(d => [d.id, d]));
      return departments.map(d => prevMap.get(d.id) || d);
    });
  }, [departments, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalUsers(prev => {
      const prevMap = new Map(prev.map(u => [u.uid, u]));
      return users.map(u => {
        // Migration Logic on load: Ensure departmentPermissions object exists if missing
        const local = prevMap.get(u.uid);
        const base = local || u;
        if (!base.departmentPermissions) {
          // Copy legacy allowedDepartments to view permissions
          const perms: Record<string, 'view' | 'edit'> = {};
          base.allowedDepartments?.forEach(deptId => {
            perms[deptId] = 'view';
          });
          return { ...base, departmentPermissions: perms };
        }
        return base;
      });
    });
  }, [users, isOpen]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setLocalDepartments(departments);
      // Initialize with basic migration for display
      setLocalUsers(users.map(u => ({
        ...u,
        departmentPermissions: u.departmentPermissions ||
          (u.allowedDepartments ? Object.fromEntries(u.allowedDepartments.map(id => [id, 'view'])) : {})
      })));
      setHasChanges(false);
      setSelectedUserForEdit(null);
    }
  }, [isOpen]);

  const [lookbackYears, setLookbackYears] = useState<number>(2);

  // --- Creation State ---
  const [isCreating, setIsCreating] = useState(false);

  // System Config logic...
  useEffect(() => {
    if (activeTab === 'system' && isMaster) {
      const unsubscribe = onSnapshot(doc(db, 'system', 'config'), (doc) => {
        if (doc.exists()) {
          setLookbackYears(doc.data().eventLookbackYears || 2);
        }
      });
      return () => unsubscribe();
    }
  }, [activeTab, isMaster]);

  const handleUpdateLookback = async (years: number) => {
    try {
      await setDoc(doc(db, 'system', 'config'), { eventLookbackYears: years }, { merge: true });
      alert("시스템 설정이 저장되었습니다.");
    } catch (e) {
      console.error(e);
      alert("설정 저장 실패");
    }
  };

  if (!isOpen) return null;

  // --- Batch Save Logic ---
  const handleSaveChanges = async () => {
    const batch = writeBatch(db);
    let changesCount = 0;

    // 1. Departments
    const originalDeptMap = new Map(departments.map(d => [d.id, d]));
    localDepartments.forEach(dept => {
      const original = originalDeptMap.get(dept.id);
      if (JSON.stringify(original) !== JSON.stringify(dept)) {
        const ref = doc(db, "부서목록", dept.id);
        batch.update(ref, {
          부서명: dept.name,
          순서: dept.order,
          색상: dept.color,
          설명: dept.description || ''
        });
        changesCount++;
      }
    });

    // 2. Users
    // Need to handle User Detail Edit merging back into localUsers first? 
    // Actually, localUsers IS the source of truth for the save. 
    // The User Detail Modal should update `localUsers`.
    const originalUserMap = new Map(users.map(u => [u.uid, u]));
    localUsers.forEach(user => {
      const original = originalUserMap.get(user.uid);
      // We need to compare carefully including the new permission object
      // For simplicity, strict JSON stringify might be okay if order doesn't matter much or we normalize.
      // Better: check specific fields.

      const hasDiff =
        user.status !== original?.status ||
        user.jobTitle !== original?.jobTitle ||
        user.role !== original?.role ||
        user.canManageMenus !== original?.canManageMenus ||
        user.canManageEventAuthors !== original?.canManageEventAuthors ||
        JSON.stringify(user.departmentPermissions) !== JSON.stringify(original?.departmentPermissions);

      if (hasDiff) {
        const ref = doc(db, 'users', user.uid);
        // Save both legacy and new permissions for compatibility if needed? 
        // Let's rely on new. But maybe update legacy `allowedDepartments` derived from `departmentPermissions` for older clients?
        // Let's update `allowedDepartments` too just in case.
        const derivedAllowed = Object.keys(user.departmentPermissions || {});

        batch.update(ref, {
          status: user.status,
          jobTitle: user.jobTitle || '',
          role: user.role, // Admin role update
          canManageMenus: user.canManageMenus || false,
          canManageEventAuthors: user.canManageEventAuthors || false,
          departmentPermissions: user.departmentPermissions,
          allowedDepartments: derivedAllowed
        });
        changesCount++;
      }
    });

    if (changesCount === 0) {
      setHasChanges(false);
      return;
    }

    try {
      await batch.commit();
      setHasChanges(false);
      alert(`성공적으로 저장되었습니다. (${changesCount}건 수정)`);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  // --- Handlers (Local Update) ---
  const markChanged = () => setHasChanges(true);

  const handleLocalDeptUpdate = (id: string, field: keyof Department, value: any) => {
    setLocalDepartments(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    markChanged();
  };

  // --- Handlers (Immediate Action) ---
  // Department Create/Delete remains immediate
  const handleAdd = async () => {
    // ... (Existing implementation, kept same for brevity but using localDepartments state for logic where possible)
    // For simplicity of this Plan execution, let's keep the exact same Immediate logic for Add/Delete as before.
    // Copying previous handleAdd logic...
    if (hasChanges) {
      if (!confirm("저장되지 않은 변경사항이 있습니다. 부서를 생성하시겠습니까?")) return;
    }
    if (!newDeptName.trim()) return;
    const newDept: Department = {
      id: newDeptName.trim().replace(/\//g, '_'),
      name: newDeptName.trim(),
      order: departments.length + 1,
      color: '#ffffff',
    };
    try {
      await setDoc(doc(db, "부서목록", newDept.id), {
        부서명: newDept.name,
        순서: newDept.order,
        색상: newDept.color,
        설명: ''
      });
      // Grant to creator...
      const batch = writeBatch(db);
      if (!isMaster && currentUserProfile) {
        const userRef = doc(db, 'users', currentUserProfile.uid);
        // Update both legacy and new
        const currentAllowed = currentUserProfile.allowedDepartments || [];
        const currentPerms = currentUserProfile.departmentPermissions || {};
        batch.update(userRef, {
          allowedDepartments: [...currentAllowed, newDept.id],
          departmentPermissions: { ...currentPerms, [newDept.id]: 'edit' } // Creator gets edit?
        });
      }
      await batch.commit();
      setNewDeptName('');
      setIsCreating(false);
    } catch (e) { console.error(e); alert("부서 생성 실패"); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('삭제하시겠습니까? (즉시 반영)')) {
      try { await deleteDoc(doc(db, "부서목록", id)); } catch (e) { console.error(e); }
    }
  };

  // --- User Detail Modal Handlers ---
  const handleUserUpdate = (uid: string, updates: Partial<UserProfile>) => {
    setLocalUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
    markChanged();
  };

  const handleDeptPermissionChange = (uid: string, deptId: string, level: 'none' | 'view' | 'edit') => {
    setLocalUsers(prev => prev.map(u => {
      if (u.uid !== uid) return u;
      const newPerms = { ...(u.departmentPermissions || {}) };
      if (level === 'none') {
        delete newPerms[deptId];
      } else {
        newPerms[deptId] = level;
      }
      return { ...u, departmentPermissions: newPerms };
    }));
    markChanged();
  };

  // Render User Detail Modal (Nested or Overlay)
  const renderUserDetail = () => {
    if (!selectedUserForEdit) return null;
    const user = localUsers.find(u => u.uid === selectedUserForEdit);
    if (!user) return null;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-[#f8f9fa] border-b border-gray-200 p-6 pb-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${user.role === 'master' ? 'bg-[#fdb813] text-[#081429]' : user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {user.role === 'master' ? <ShieldCheck /> : user.role === 'admin' ? <Shield /> : <Users />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#081429]">{user.email}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={user.jobTitle || ''}
                      onChange={(e) => handleUserUpdate(user.uid, { jobTitle: e.target.value })}
                      placeholder="직급 입력"
                      className="bg-white border border-gray-200 rounded px-2 py-1 text-sm font-medium w-32 focus:border-[#fdb813] outline-none"
                    />
                    {/* Role Badge / Toggle */}
                    {isMaster && user.role !== 'master' && (
                      <button
                        onClick={() => handleUserUpdate(user.uid, { role: user.role === 'admin' ? 'user' : 'admin' })}
                        className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                      >
                        {user.role === 'admin' ? '관리자(Admin)' : '일반 사용자'}
                      </button>
                    )}
                    <select
                      value={user.status}
                      onChange={(e) => handleUserUpdate(user.uid, { status: e.target.value as any })}
                      className={`text-xs font-bold px-2 py-1 rounded border outline-none ${user.status === 'approved' ? 'text-green-600 bg-green-50 border-green-200' : user.status === 'pending' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-red-600 bg-red-50 border-red-200'}`}
                    >
                      <option value="approved">승인됨</option>
                      <option value="pending">대기중</option>
                      <option value="rejected">차단됨</option>
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedUserForEdit(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {/* Global Permissions Checkboxes */}
            {(isMaster || isAdmin) && user.role !== 'master' && (
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300">
                  <input type="checkbox" checked={!!user.canManageMenus} onChange={() => handleUserUpdate(user.uid, { canManageMenus: !user.canManageMenus })} className="accent-[#081429]" />
                  <span className="text-xs font-bold text-gray-700">메뉴 관리 (부서 생성/삭제)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300">
                  <input type="checkbox" checked={!!user.canManageEventAuthors} onChange={() => handleUserUpdate(user.uid, { canManageEventAuthors: !user.canManageEventAuthors })} className="accent-[#081429]" />
                  <span className="text-xs font-bold text-gray-700">작성자 명의 수정</span>
                </label>
              </div>
            )}
          </div>

          {/* Body: Dept Permissions */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <h4 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider flex items-center justify-between">
              부서별 접근 권한
              <div className="flex gap-2 text-[10px]">
                <button onClick={() => {
                  const newPerms: any = {};
                  localDepartments.forEach(d => newPerms[d.id] = 'view');
                  handleUserUpdate(user.uid, { departmentPermissions: newPerms });
                }} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">전체 조회</button>
                <button onClick={() => {
                  const newPerms: any = {};
                  localDepartments.forEach(d => newPerms[d.id] = 'edit');
                  handleUserUpdate(user.uid, { departmentPermissions: newPerms });
                }} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">전체 수정</button>
                <button onClick={() => handleUserUpdate(user.uid, { departmentPermissions: {} })} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-red-500">초기화</button>
              </div>
            </h4>

            <div className="grid grid-cols-1 gap-2">
              {localDepartments.map(dept => {
                const current = user.departmentPermissions?.[dept.id]; // undefined, 'view', 'edit'
                return (
                  <div key={dept.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                      <span className="font-bold text-gray-700 text-sm">{dept.name}</span>
                    </div>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => handleDeptPermissionChange(user.uid, dept.id, 'none')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!current ? 'bg-white shadow-sm text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        차단
                      </button>
                      <button
                        onClick={() => handleDeptPermissionChange(user.uid, dept.id, 'view')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${current === 'view' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        조회
                      </button>
                      <button
                        onClick={() => handleDeptPermissionChange(user.uid, dept.id, 'edit')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${current === 'edit' ? 'bg-white shadow-sm text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        수정
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
            <button onClick={() => setSelectedUserForEdit(null)} className="px-6 py-2 bg-[#081429] text-white rounded-lg font-bold">확인</button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-0 relative max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">

          {/* Header */}
          <div className="bg-[#081429] p-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FolderKanban size={20} className="text-[#fdb813]" />
                시스템 관리
              </h2>
              <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                {/* Always show Departments if allowed */}
                {canManageMenus && (
                  <button onClick={() => setActiveTab('departments')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'departments' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>부서 관리</button>
                )}
                {/* Users Tab available to Master AND Admin */}
                {canManageUsers && (
                  <button onClick={() => setActiveTab('users')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>사용자 관리</button>
                )}
                {/* System Tab Master Only */}
                {isMaster && (
                  <button onClick={() => setActiveTab('system')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'system' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>시스템 설정</button>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto flex-1 bg-gray-50 pb-20">

            {/* DEPARTMENT TAB */}
            {activeTab === 'departments' && canManageMenus && (
              // ... (Existing Dept Tab Content - Compact Refactor if needed, but keeping primarily User UI focus as requested)
              // Sticking to existing layout for brevity in this response, just wrapping properly.
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="부서 검색" value={deptSearchTerm} onChange={(e) => setDeptSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none" />
                </div>
                {!isCreating && <button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-[#081429] text-white rounded-xl font-bold w-full md:w-auto">새 부서 만들기</button>}
                {isCreating && (
                  <div className="bg-white p-4 rounded-xl border border-[#fdb813] space-y-3">
                    <input type="text" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="부서명" className="w-full border p-2 rounded" />
                    <div className="flex gap-2">
                      <button onClick={() => setIsCreating(false)} className="flex-1 bg-gray-100 py-2 rounded">취소</button>
                      <button onClick={handleAdd} className="flex-1 bg-[#081429] text-white py-2 rounded">생성</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {localDepartments.filter(d => d.name.includes(deptSearchTerm)).map(dept => (
                    <div key={dept.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-3">
                      <div className="w-1.5 rounded-full" style={{ backgroundColor: dept.color }} />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <input value={dept.name} onChange={(e) => handleLocalDeptUpdate(dept.id, 'name', e.target.value)} className="font-bold border-none outline-none w-full" />
                          <button onClick={() => handleDelete(dept.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                        <div className="flex justify-end mt-2">
                          <input type="color" value={dept.color} onChange={(e) => handleLocalDeptUpdate(dept.id, 'color', e.target.value)} className="w-6 h-6 rounded-full overflow-hidden cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* USERS TAB - NEW TABLE DESIGN */}
            {activeTab === 'users' && canManageUsers && (
              <div className="max-w-5xl mx-auto h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="이름/이메일 검색..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none"
                    />
                  </div>
                  <div className="text-xs text-gray-500 font-bold">
                    총 <span className="text-[#081429] text-base">{localUsers.length}</span>명
                  </div>
                </div>

                {/* Table Header */}
                <div className="bg-gray-100 rounded-t-xl border-x border-t border-gray-200 grid grid-cols-12 gap-4 p-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-4 pl-2">사용자 정보</div>
                  <div className="col-span-2 text-center">직급</div>
                  <div className="col-span-2 text-center">권한(Role)</div>
                  <div className="col-span-2 text-center">상태</div>
                  <div className="col-span-2 text-center">관리</div>
                </div>

                {/* Table Body */}
                <div className="bg-white border text-sm flex-1 overflow-y-auto rounded-b-xl">
                  {localUsers
                    .filter(u => u.email.includes(userSearchTerm) || u.jobTitle?.includes(userSearchTerm))
                    .sort((a, b) => (a.role === 'master' ? -1 : 1)) // Master first
                    .map(user => (
                      <div key={user.uid} className={`grid grid-cols-12 gap-4 p-3 border-b border-gray-100 last:border-0 hover:bg-yellow-50/30 items-center transition-colors ${selectedUserForEdit === user.uid ? 'bg-yellow-50' : ''}`}>
                        {/* User Info */}
                        <div className="col-span-4 flex items-center gap-3 pl-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${user.role === 'master' ? 'bg-[#fdb813] text-[#081429]' : user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            {user.role === 'master' ? <ShieldCheck size={14} /> : user.role === 'admin' ? <Shield size={14} /> : <Users size={14} />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#081429] truncate">{user.email}</div>
                            <div className="text-[10px] text-gray-400 font-mono truncate">{user.uid.slice(0, 6)}...</div>
                          </div>
                        </div>

                        {/* Job Title */}
                        <div className="col-span-2 text-center">
                          <span className="text-gray-600 font-medium">{user.jobTitle || '-'}</span>
                        </div>

                        {/* Role */}
                        <div className="col-span-2 text-center">
                          {user.role === 'master' && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-black">MASTER</span>}
                          {user.role === 'admin' && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black">ADMIN</span>}
                          {user.role === 'user' && <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-medium">USER</span>}
                        </div>

                        {/* Status */}
                        <div className="col-span-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.status === 'approved' ? 'bg-green-100 text-green-700' :
                              user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            {user.status === 'approved' ? '승인됨' : user.status === 'pending' ? '대기중' : '차단됨'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex justify-center">
                          <button
                            onClick={() => setSelectedUserForEdit(user.uid)}
                            className="p-2 text-gray-400 hover:text-[#081429] hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                          >
                            <UserCog size={16} /> <span className="hidden xl:inline">설정</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* SYSTEM TAB */}
            {activeTab === 'system' && isMaster && (
              <div className="max-w-lg mx-auto space-y-6">
                {/* System Config Content (Kept same) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold mb-4 flex gap-2"><Database size={18} /> 데이터 관리</h3>
                  <div className="flex gap-2">
                    <input type="number" value={lookbackYears} onChange={(e) => setLookbackYears(Number(e.target.value))} className="border p-2 rounded flex-1" />
                    <button onClick={() => handleUpdateLookback(lookbackYears)} className="bg-[#081429] text-white px-4 rounded">저장</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer (Save Button) */}
          {(activeTab === 'departments' || activeTab === 'users') && (
            <div className="absolute bottom-0 left-0 w-full p-4 bg-white/95 border-t border-gray-200 backdrop-blur-sm flex justify-between items-center z-10">
              <div className="text-xs text-gray-500 font-medium">
                {hasChanges ? <span className="text-amber-600 flex items-center gap-1"><ShieldAlert size={14} /> 저장되지 않은 변경사항이 있습니다.</span> : <span>모든 변경사항이 저장되었습니다.</span>}
              </div>
              <button
                onClick={handleSaveChanges}
                disabled={!hasChanges}
                className={`
                        px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all
                        ${hasChanges
                    ? 'bg-[#081429] text-white hover:brightness-110 active:scale-95'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  }
                    `}
              >
                <Save size={18} /> 변경사항 저장
              </button>
            </div>
          )}
        </div>

        {/* Render Nested User Detail Modal */}
        {renderUserDetail()}

      </div>
    </>
  );
};

export default SettingsModal;
