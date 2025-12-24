import React, { useState, useEffect } from 'react';
import { Department, UserProfile } from '../types';
import { X, Plus, Trash2, GripVertical, FolderKanban, Users, Check, XCircle, Shield, ShieldAlert, ShieldCheck, Database, CheckCircle2, Search, Save } from 'lucide-react';
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
  const canManageMenus = isMaster || currentUserProfile?.canManageMenus === true;

  const [activeTab, setActiveTab] = useState<TabMode>('departments');
  const [newDeptName, setNewDeptName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [deptSearchTerm, setDeptSearchTerm] = useState('');

  // --- Local Buffered State ---
  const [localDepartments, setLocalDepartments] = useState<Department[]>([]);
  const [localUsers, setLocalUsers] = useState<UserProfile[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync Props to Local State (Smart Merge to preserve edits)
  useEffect(() => {
    if (!isOpen) return;
    setLocalDepartments(prev => {
      const prevMap = new Map(prev.map(d => [d.id, d]));
      // If prop has updated (e.g. new dept added), include it. 
      // If prop is missing (deleted), remove it.
      // If prop exists but we have local edit, keep local edit.
      return departments.map(d => {
        const local = prevMap.get(d.id);
        // Check if local is actually different from prop?
        // For simplicity in this "Smart Merge", we prioritize local state if ID matches.
        // But this means background updates to fields will be ignored if we have viewed the modal.
        // Given the requirement, this is acceptable for "Batch Mode".
        return local || d;
      });
    });
  }, [departments, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalUsers(prev => {
      const prevMap = new Map(prev.map(u => [u.uid, u]));
      return users.map(u => prevMap.get(u.uid) || u);
    });
  }, [users, isOpen]);

  // Reset on open/close?
  useEffect(() => {
    if (isOpen) {
      setLocalDepartments(departments);
      setLocalUsers(users);
      setHasChanges(false);
    }
  }, [isOpen]);


  // System Config State (Direct Write for now as it wasn't requested to be batched, or can be mixed. Let's keep direct for System Config or Batch? User said "Entirely". Let's Update Lookback to use Save button too?)
  // User explicitly mentioned "Check cost reduction... save button". 
  // System config is rare write. Let's leave it or batch it? Let's batch it if easy.
  // Actually, let's stick to the main heavy hitters: Depts and Users.
  const [lookbackYears, setLookbackYears] = useState<number>(2);

  // --- Creation State ---
  const [isCreating, setIsCreating] = useState(false);
  const [createOption, setCreateOption] = useState<'me' | 'all' | 'specific'>('me');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const toggleUserSelection = (uid: string) => {
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  // Fetch System Config
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
    // Keep direct for now as it has its own Save button in UI already
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
      // Simple JSON stringify comparison or field check
      if (JSON.stringify(original) !== JSON.stringify(dept)) {
        const ref = doc(db, "부서목록", dept.id);
        batch.update(ref, {
          부서명: dept.name,
          순서: dept.order, // Drag drop updates this
          색상: dept.color,
          설명: dept.description || ''
        });
        changesCount++;
      }
    });

    // 2. Users
    const originalUserMap = new Map(users.map(u => [u.uid, u]));
    localUsers.forEach(user => {
      const original = originalUserMap.get(user.uid);
      if (JSON.stringify(original) !== JSON.stringify(user)) {
        const ref = doc(db, 'users', user.uid);
        batch.update(ref, {
          status: user.status,
          jobTitle: user.jobTitle || '',
          canManageMenus: user.canManageMenus || false,
          canManageEventAuthors: user.canManageEventAuthors || false,
          allowedDepartments: user.allowedDepartments
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

  const handleLocalUserUpdate = (uid: string, field: keyof UserProfile, value: any) => {
    setLocalUsers(prev => prev.map(u => u.uid === uid ? { ...u, [field]: value } : u));
    markChanged();
  };

  // Specific User Perm Toggles
  const handleToggleLocalMenuPermission = (uid: string) => {
    setLocalUsers(prev => prev.map(u => u.uid === uid ? { ...u, canManageMenus: !u.canManageMenus } : u));
    markChanged();
  };
  const handleToggleLocalAuthorPermission = (uid: string) => {
    setLocalUsers(prev => prev.map(u => u.uid === uid ? { ...u, canManageEventAuthors: !u.canManageEventAuthors } : u));
    markChanged();
  };
  const handleToggleLocalUserDept = (uid: string, deptId: string) => {
    setLocalUsers(prev => prev.map(u => {
      if (u.uid !== uid) return u;
      const current = u.allowedDepartments || [];
      const newDepts = current.includes(deptId) ? current.filter(d => d !== deptId) : [...current, deptId];
      return { ...u, allowedDepartments: newDepts };
    }));
    markChanged();
  };


  // --- Handlers (Immediate Action) ---
  const handleAdd = async () => {
    if (hasChanges) {
      if (!confirm("저장되지 않은 변경사항이 있습니다. 부서를 생성하시겠습니까? (변경사항은 유지되지만 권장되지 않습니다.)")) return;
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

      const batch = writeBatch(db);
      if (!isMaster && currentUserProfile) {
        const userRef = doc(db, 'users', currentUserProfile.uid);
        const currentAllowed = currentUserProfile.allowedDepartments || [];
        batch.update(userRef, { allowedDepartments: [...currentAllowed, newDept.id] });
      }

      if (createOption === 'all') {
        users.forEach(user => {
          if (user.uid === currentUserProfile?.uid) return;
          const currentAllowed = user.allowedDepartments || [];
          if (!currentAllowed.includes(newDept.id)) {
            batch.update(doc(db, 'users', user.uid), {
              allowedDepartments: [...currentAllowed, newDept.id]
            });
          }
        });
      } else if (createOption === 'specific') {
        selectedUserIds.forEach(uid => {
          if (uid === currentUserProfile?.uid) return;
          const targetUser = users.find(u => u.uid === uid);
          if (targetUser) {
            const currentAllowed = targetUser.allowedDepartments || [];
            if (!currentAllowed.includes(newDept.id)) {
              batch.update(doc(db, 'users', uid), {
                allowedDepartments: [...currentAllowed, newDept.id]
              });
            }
          }
        });
      }

      await batch.commit();

      setNewDeptName('');
      setIsCreating(false);
      setCreateOption('me');
      setSelectedUserIds([]);
    } catch (e) { console.error(e); alert("부서 생성 실패"); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('이 부서와 관련된 일정이 표시되지 않을 수 있습니다. 정말 삭제하시겠습니까? (즉시 반영됨)')) {
      try {
        await deleteDoc(doc(db, "부서목록", id));
      } catch (e) { console.error(e); }
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (confirm('사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다. (즉시 반영됨)')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) { console.error(e); }
    }
  };

  // --- Drag & Drop (Local updates order) ---
  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };
  const onDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reordered = [...localDepartments];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    // Update order fields
    const updated = reordered.map((d, idx) => ({ ...d, order: idx + 1 }));
    setLocalDepartments(updated);
    markChanged();
    setDraggedIndex(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-0 relative max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">

        {/* Header */}
        <div className="bg-[#081429] p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FolderKanban size={20} className="text-[#fdb813]" />
              시스템 관리
            </h2>
            {(isMaster || canManageMenus) && (
              <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                <button onClick={() => setActiveTab('departments')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'departments' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>부서 관리</button>
                {isMaster && (
                  <>
                    <button onClick={() => setActiveTab('users')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>사용자 관리</button>
                    <button onClick={() => setActiveTab('system')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'system' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}>시스템 설정</button>
                  </>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 pb-20">

          {/* DEPARTMENT TAB */}
          {activeTab === 'departments' && canManageMenus && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="부서 검색..." value={deptSearchTerm} onChange={(e) => setDeptSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#fdb813]/50 focus:border-[#fdb813] outline-none transition-all text-sm font-bold" />
                </div>
                {!isCreating ? (
                  <button onClick={() => setIsCreating(true)} className="px-6 py-3 bg-[#081429] text-white rounded-xl font-bold hover:brightness-110 flex items-center gap-2 shadow-lg active:scale-95 transition-all text-sm whitespace-nowrap">
                    <Plus size={18} /> 새 부서 만들기
                  </button>
                ) : (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md animate-in fade-in zoom-in duration-200">
                    <div className="bg-white p-5 rounded-2xl shadow-2xl border border-[#fdb813] space-y-4">
                      <h4 className="font-bold text-[#081429] flex items-center gap-2 text-xl">
                        <FolderKanban size={20} className="text-[#fdb813]" /> 새 부서 생성
                      </h4>
                      <input type="text" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="부서 이름 입력" className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#fdb813]/50 font-bold text-sm" autoFocus />

                      <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">접근 권한 설정</p>
                        <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                          <input type="radio" name="createOption" checked={createOption === 'me'} onChange={() => setCreateOption('me')} className="mt-1 accent-[#fdb813] w-4 h-4" />
                          <div><span className="block font-bold text-[#081429] text-sm">나만 보기</span><p className="text-xs text-gray-500 mt-0.5">본인에게만 권한이 자동 부여됩니다.</p></div>
                        </label>
                        <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                          <input type="radio" name="createOption" checked={createOption === 'all'} onChange={() => setCreateOption('all')} className="mt-1 accent-[#fdb813] w-4 h-4" />
                          <div><span className="block font-bold text-[#081429] text-sm">모든 사용자에게 허용</span><p className="text-xs text-gray-500 mt-0.5">모든 회원에게 권한을 부여합니다.</p></div>
                        </label>
                        <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                          <input type="radio" name="createOption" checked={createOption === 'specific'} onChange={() => setCreateOption('specific')} className="mt-1 accent-[#fdb813] w-4 h-4" />
                          <div><span className="block font-bold text-[#081429] text-sm">특정 사용자 선택</span><p className="text-xs text-gray-500 mt-0.5">선택한 사용자만 접근 가능합니다.</p></div>
                        </label>
                        {createOption === 'specific' && (
                          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                            {users.filter(u => u.uid !== currentUserProfile?.uid).map(u => (
                              <label key={u.uid} className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-100">
                                <input type="checkbox" checked={selectedUserIds.includes(u.uid)} onChange={() => toggleUserSelection(u.uid)} className="rounded border-gray-300 accent-[#081429] w-4 h-4" />
                                <span className="text-sm font-medium text-gray-700">{u.email} <span className="text-gray-400 text-xs">({u.jobTitle || '직급없음'})</span></span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setIsCreating(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">취소</button>
                        <button onClick={handleAdd} disabled={!newDeptName.trim()} className="flex-[2] bg-[#081429] text-white py-3 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 shadow-lg">생성하기 (즉시)</button>
                      </div>
                    </div>
                    <div className="fixed inset-0 bg-black/20 -z-10" onClick={() => setIsCreating(false)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localDepartments.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border-2 border-dashed border-gray-200">등록된 부서가 없습니다.</div>
                ) : (
                  localDepartments
                    .filter(dept => dept.name.toLowerCase().includes(deptSearchTerm.toLowerCase()))
                    .map((dept, index) => {
                      const originalIndex = localDepartments.findIndex(d => d.id === dept.id);
                      const isSearching = deptSearchTerm.length > 0;
                      return (
                        <div
                          key={dept.id}
                          draggable={!isSearching}
                          onDragStart={(e) => !isSearching && onDragStart(e, originalIndex)}
                          onDragOver={(e) => !isSearching && onDragOver(e, originalIndex)}
                          onDrop={(e) => !isSearching && onDrop(e, originalIndex)}
                          onDragEnd={() => setDraggedIndex(null)}
                          className={`relative group overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 ${draggedIndex === originalIndex ? 'opacity-40 border-dashed border-[#fdb813]' : 'hover:border-[#fdb813]/30'} ${!isSearching ? 'cursor-move' : ''}`}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-colors" style={{ backgroundColor: dept.color.startsWith('#') ? dept.color : '#e5e7eb' }} />
                          <div className="p-4 pl-6 flex items-start gap-3">
                            {!isSearching && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab"><GripVertical size={14} /></div>}
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <input type="text" value={dept.name} onChange={(e) => handleLocalDeptUpdate(dept.id, 'name', e.target.value)} className="font-bold text-[#081429] text-sm border-b border-transparent hover:border-gray-200 focus:border-[#fdb813] outline-none transition-colors bg-transparent w-full mr-2" />
                                <button onClick={() => handleDelete(dept.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="삭제 (즉시)"><Trash2 size={16} /></button>
                              </div>
                              <input type="text" value={dept.description || ''} onChange={(e) => handleLocalDeptUpdate(dept.id, 'description', e.target.value)} className="w-full text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 focus:bg-white rounded px-2 py-1.5 border border-transparent focus:border-[#fdb813] outline-none transition-all placeholder:text-gray-300" placeholder="부서 설명 입력..." />
                              <div className="flex justify-end pt-1">
                                <div className="relative group/color">
                                  <div className="w-6 h-6 rounded-full border border-gray-200 shadow-sm cursor-pointer overflow-hidden ring-2 ring-transparent group-hover/color:ring-[#fdb813]/30 transition-all" style={{ backgroundColor: dept.color.startsWith('#') ? dept.color : '#ffffff' }}>
                                    <input type="color" value={dept.color.startsWith('#') ? dept.color : '#ffffff'} onChange={(e) => handleLocalDeptUpdate(dept.id, 'color', e.target.value)} className="opacity-0 w-[200%] h-[200%] cursor-pointer absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && isMaster && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex items-start gap-3">
                <ShieldAlert className="shrink-0 text-blue-500" size={20} />
                <div>
                  <p className="font-bold mb-1">권한 관리 도움말</p>
                  <p className="opacity-80">'승인됨' 상태의 사용자만 캘린더에 접근할 수 있습니다. 각 사용자에게 열람/편집을 허용할 부서를 체크해주세요.</p>
                </div>
              </div>

              <div className="grid gap-4">
                {localUsers.map(user => (
                  <div key={user.uid} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'master' ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-100 text-gray-500'}`}>
                          {user.role === 'master' ? <ShieldCheck size={20} /> : <Users size={20} />}
                        </div>
                        <div>
                          <div className="font-bold text-[#081429] flex items-center gap-2">
                            {user.email}
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${user.status === 'approved' ? 'bg-green-100 text-green-700' : user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{user.status}</span>
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">UID: {user.uid.slice(0, 8)}...</div>
                          <div className="mt-1">
                            <input type="text" placeholder="직급 입력" value={user.jobTitle || ''} onChange={(e) => handleLocalUserUpdate(user.uid, 'jobTitle', e.target.value)} className="text-xs border-b border-gray-200 focus:border-[#fdb813] outline-none bg-transparent placeholder:text-gray-300 w-32 py-0.5 transition-colors" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {user.status === 'pending' && <button onClick={() => handleLocalUserUpdate(user.uid, 'status', 'approved')} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors shadow-sm flex items-center gap-1"><Check size={14} /> 승인</button>}
                        {user.status === 'approved' && user.role !== 'master' && <button onClick={() => handleLocalUserUpdate(user.uid, 'status', 'rejected')} className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors">차단</button>}
                        {user.role !== 'master' && <button onClick={() => handleDeleteUser(user.uid)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors ml-2" title="사용자 삭제 (즉시)"><Trash2 size={16} /></button>}
                      </div>
                    </div>

                    <div>
                      {isMaster && user.role !== 'master' && (
                        <div className="mb-3 pb-3 border-b border-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${user.canManageMenus ? 'bg-[#fdb813] border-[#fdb813]' : 'bg-white border-gray-300'}`}>{user.canManageMenus && <Check size={12} className="text-[#081429]" />}</div>
                            <input type="checkbox" checked={!!user.canManageMenus} onChange={() => handleToggleLocalMenuPermission(user.uid)} className="hidden" />
                            <span className="text-xs font-bold text-[#081429]">메뉴 관리 권한</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${user.canManageEventAuthors ? 'bg-purple-500 border-purple-500' : 'bg-white border-gray-300'}`}>{user.canManageEventAuthors && <Check size={12} className="text-white" />}</div>
                            <input type="checkbox" checked={!!user.canManageEventAuthors} onChange={() => handleToggleLocalAuthorPermission(user.uid)} className="hidden" />
                            <span className="text-xs font-bold text-[#081429]">작성자 수정 권한</span>
                          </label>
                        </div>
                      )}

                      <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">접근 허용 부서</h4>
                      <div className="flex flex-wrap gap-2">
                        {localDepartments.map(dept => {
                          const isAllowed = user.allowedDepartments?.includes(dept.id);
                          return (
                            <button key={dept.id} onClick={() => handleToggleLocalUserDept(user.uid, dept.id)} disabled={user.role === 'master'} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${isAllowed ? 'bg-[#081429] text-white border-[#081429]' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'} ${user.role === 'master' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              {isAllowed ? <CheckCircle2 size={12} className="text-[#fdb813]" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                              {dept.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SYSTEM TAB */}
          {activeTab === 'system' && isMaster && (
            <div className="max-w-lg mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-[#081429] mb-4 flex items-center gap-2"><Database size={18} /> 데이터 관리</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">이벤트 조회 기간 (년)</label>
                    <div className="flex gap-2">
                      <input type="number" min="1" max="10" value={lookbackYears} onChange={(e) => setLookbackYears(Number(e.target.value))} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none font-medium" />
                      <button onClick={() => handleUpdateLookback(lookbackYears)} className="px-4 py-2 bg-[#081429] text-white rounded-lg font-bold hover:bg-[#1a2942] transition-colors">저장</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (Save Button) */}
        {/* Always visible or conditionally check `hasChanges`. User requested explicit save button. */}
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
    </div>
  );
};

export default SettingsModal;
