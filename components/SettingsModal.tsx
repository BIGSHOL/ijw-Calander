import React, { useState, useEffect } from 'react';
import { Department, UserProfile } from '../types';
import { X, Plus, Trash2, GripVertical, FolderKanban, Users, Check, XCircle, Shield, ShieldAlert, ShieldCheck, Database, CheckCircle2 } from 'lucide-react';
import { db, auth } from '../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, onSnapshot, updateDoc } from 'firebase/firestore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  currentUserProfile?: UserProfile | null; // Pass current user profile
}

type TabMode = 'departments' | 'users' | 'system';

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  departments,
  currentUserProfile,
}) => {
  const isMaster = currentUserProfile?.role === 'master';
  const canManageMenus = isMaster || currentUserProfile?.canManageMenus === true; // Derive permission

  const [activeTab, setActiveTab] = useState<TabMode>('departments');
  const [newDeptName, setNewDeptName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // User Management State
  const [users, setUsers] = useState<UserProfile[]>([]);

  // System Config State
  const [lookbackYears, setLookbackYears] = useState<number>(2);

  // Fetch Users if Tab is 'users' and User is Master
  useEffect(() => {
    if (activeTab === 'users' && isMaster) {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const loadUsers = snapshot.docs.map(doc => doc.data() as UserProfile);
        setUsers(loadUsers);
      });
      return () => unsubscribe();
    }
  }, [activeTab, isMaster]);

  // Fetch System Config if Tab is 'system' and User is Master
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
    } catch (e) {
      console.error(e);
      alert("설정 저장 실패");
    }
  };

  if (!isOpen) return null;

  // --- Department Logic ---
  const handleAdd = async () => {
    if (!newDeptName.trim()) return;
    const newDept: Department = {
      id: newDeptName.trim().replace(/\//g, '_'), // Sanitize ID
      name: newDeptName.trim(),
      order: departments.length + 1,
      color: '#ffffff', // Default to Hex
    };
    try {
      await setDoc(doc(db, "부서목록", newDept.id), {
        부서명: newDept.name,
        순서: newDept.order,
        색상: newDept.color,
        설명: ''
      });
      setNewDeptName('');
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('이 부서와 관련된 일정이 표시되지 않을 수 있습니다. 정말 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, "부서목록", id));
      } catch (e) { console.error(e); }
    }
  };

  const handleUpdate = async (id: string, field: keyof Department, value: string) => {
    const fieldMap: Record<string, string> = {
      name: '부서명',
      order: '순서',
      color: '색상',
      description: '설명'
    };
    const dbField = fieldMap[field];
    if (dbField) {
      try {
        await setDoc(doc(db, "부서목록", id), { [dbField]: value }, { merge: true });
      } catch (e) { console.error(e); }
    }
  };

  // --- User Management Logic ---
  const handleUpdateUserStatus = async (uid: string, newStatus: 'approved' | 'pending' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
    } catch (e) { console.error(e); }
  };

  const handleUpdateJobTitle = async (uid: string, newTitle: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { jobTitle: newTitle });
    } catch (e) {
      console.error(e);
      alert("직급 수정 실패");
    }
  };

  const handleToggleMenuPermission = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { canManageMenus: !user.canManageMenus });
    } catch (e) {
      console.error(e);
      alert("권한 수정 실패");
    }
  };

  const handleToggleUserDept = async (user: UserProfile, deptId: string) => {
    const currentDepts = user.allowedDepartments || [];
    const newDepts = currentDepts.includes(deptId)
      ? currentDepts.filter(id => id !== deptId)
      : [...currentDepts, deptId];

    try {
      await updateDoc(doc(db, 'users', user.uid), { allowedDepartments: newDepts });
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (uid: string) => {
    console.log("deleting user", uid);
    if (confirm('사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) { console.error(e); }
    }
  };


  // --- Drag & Drop ---
  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
  };
  const onDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reordered = [...departments];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    const batch = writeBatch(db);
    reordered.forEach((dept, idx) => {
      if (dept.order !== idx + 1) { // Optimization: Only write if order changed
        const ref = doc(db, "부서목록", dept.id);
        batch.update(ref, { 순서: idx + 1 });
      }
    });
    try { await batch.commit(); } catch (error) { console.error(error); }
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

            {/* Tabs */}
            {/* Tabs */}
            {(isMaster || canManageMenus) && (
              <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setActiveTab('departments')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'departments' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                >
                  부서 관리
                </button>
                {isMaster && (
                  <>
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                    >
                      사용자 관리
                    </button>
                    <button
                      onClick={() => setActiveTab('system')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'system' ? 'bg-[#fdb813] text-[#081429]' : 'text-gray-300 hover:text-white'}`}
                    >
                      시스템 설정
                    </button>
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
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">

          {/* DEPARTMENT TAB - Guarded by canManageMenus */}
          {activeTab === 'departments' && canManageMenus && (
            <div className="space-y-4 max-w-lg mx-auto">
              {/* Add Section */}
              <div className="flex gap-2 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="새 부서 이름"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#fdb813]/50 focus:border-[#fdb813] transition-all font-bold text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button
                  onClick={handleAdd}
                  disabled={!newDeptName.trim()}
                  className="px-4 py-2 bg-[#081429] text-[#fdb813] rounded-lg hover:brightness-110 flex items-center gap-1 font-bold shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Plus size={16} /> 추가
                </button>
              </div>

              {/* Department List */}
              <div className="space-y-3 pb-20">
                {departments.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
                    등록된 부서가 없습니다.
                  </div>
                ) : (
                  departments.map((dept, index) => (
                    <div
                      key={dept.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDrop={(e) => onDrop(e, index)}
                      onDragEnd={() => setDraggedIndex(null)}
                      className={`
                                relative group p-3 bg-white border border-gray-200 rounded-xl shadow-sm transition-all hover:shadow-md
                                ${draggedIndex === index ? 'opacity-40 border-dashed border-[#fdb813]' : 'hover:border-[#fdb813]/30'}
                                cursor-move
                                `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Drag Handle */}
                        <div className="mt-2 text-gray-300 cursor-grab hover:text-gray-500">
                          <GripVertical size={16} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-2">
                          {/* Row 1: Name and Color */}
                          <div className="flex items-center gap-2">
                            <div className="relative flex items-center justify-center">
                              <div
                                className={`
                                            ${!dept.color.startsWith('#') ? dept.color : 'bg-white'} 
                                            w-8 h-8 rounded-full border shadow-sm overflow-hidden flex items-center justify-center transition-transform hover:scale-105
                                            border-2 border-gray-100
                                        `}
                                style={{ backgroundColor: dept.color.startsWith('#') ? dept.color : undefined }}
                              >
                                <input
                                  type="color"
                                  value={dept.color.startsWith('#') ? dept.color : '#ffffff'}
                                  onChange={(e) => handleUpdate(dept.id, 'color', e.target.value)}
                                  className="opacity-0 w-[200%] h-[200%] cursor-pointer absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                  title="색상 변경"
                                />
                              </div>
                            </div>
                            <input
                              type="text"
                              value={dept.name}
                              onChange={(e) => handleUpdate(dept.id, 'name', e.target.value)}
                              className="flex-1 px-2 py-1.5 font-bold text-[#081429] border-b border-transparent hover:border-gray-200 focus:border-[#fdb813] outline-none transition-colors bg-transparent"
                            />
                            <button
                              onClick={() => handleDelete(dept.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Row 2: Description */}
                          <input
                            type="text"
                            value={dept.description || ''}
                            onChange={(e) => handleUpdate(dept.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-xs text-gray-500 bg-gray-50 rounded border border-transparent focus:bg-white focus:border-[#fdb813] outline-none transition-all placeholder:text-gray-300"
                            placeholder="부서 설명"
                          />
                        </div>
                      </div>
                    </div>
                  ))
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
                  <p className="opacity-80">
                    '승인됨' 상태의 사용자만 캘린더에 접근할 수 있습니다.<br />
                    각 사용자에게 열람/편집을 허용할 부서를 체크해주세요.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {users.map(user => (
                  <div key={user.uid} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'master' ? 'bg-[#fdb813] text-[#081429]' : 'bg-gray-100 text-gray-500'}`}>
                          {user.role === 'master' ? <ShieldCheck size={20} /> : <Users size={20} />}
                        </div>
                        <div>
                          <div className="font-bold text-[#081429] flex items-center gap-2">
                            {user.email}
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${user.status === 'approved' ? 'bg-green-100 text-green-700' :
                              user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                              }`}>
                              {user.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">UID: {user.uid.slice(0, 8)}...</div>
                          <div className="mt-1">
                            <input
                              type="text"
                              placeholder="직급 입력 (예: 대리)"
                              defaultValue={user.jobTitle || ''}
                              onBlur={(e) => {
                                if (e.target.value !== user.jobTitle) {
                                  handleUpdateJobTitle(user.uid, e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="text-xs border-b border-gray-200 focus:border-[#fdb813] outline-none bg-transparent placeholder:text-gray-300 w-32 py-0.5 transition-colors"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        {user.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateUserStatus(user.uid, 'approved')}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors shadow-sm flex items-center gap-1"
                          >
                            <Check size={14} /> 승인하기
                          </button>
                        )}
                        {user.status === 'approved' && user.role !== 'master' && (
                          <button
                            onClick={() => handleUpdateUserStatus(user.uid, 'rejected')}
                            className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                          >
                            차단
                          </button>
                        )}
                        {/* Delete User Button */}
                        {user.role !== 'master' && (
                          <button
                            onClick={() => handleDeleteUser(user.uid)}
                            className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors ml-2"
                            title="사용자 삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permission Checkboxes */}
                    <div>
                      {/* NEW: Menu Management Permission (Master Only) */}
                      {isMaster && user.role !== 'master' && (
                        <div className="mb-3 pb-3 border-b border-gray-100">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${user.canManageMenus ? 'bg-[#fdb813] border-[#fdb813]' : 'bg-white border-gray-300'}`}>
                              {user.canManageMenus && <Check size={12} className="text-[#081429]" />}
                            </div>
                            <input type="checkbox" checked={!!user.canManageMenus} onChange={() => handleToggleMenuPermission(user)} className="hidden" />
                            <span className="text-xs font-bold text-[#081429]">메뉴 관리 권한 (부서 추가/수정/삭제)</span>
                          </label>
                        </div>
                      )}

                      <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">접근 허용 부서</h4>
                      <div className="flex flex-wrap gap-2">
                        {departments.map(dept => {
                          const isAllowed = user.allowedDepartments?.includes(dept.id);
                          return (
                            <button
                              key={dept.id}
                              onClick={() => handleToggleUserDept(user, dept.id)}
                              disabled={user.role === 'master'} // Master has all access implies visual disable or just auto-check?
                              className={`
                                                        px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5
                                                        ${isAllowed
                                  ? 'bg-[#081429] text-white border-[#081429]'
                                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                }
                                                        ${user.role === 'master' ? 'opacity-50 cursor-not-allowed' : ''}
                                                    `}
                            >
                              {isAllowed ? <CheckCircle2 size={12} className="text-[#fdb813]" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                              {dept.name}
                            </button>
                          )
                        })}
                      </div>
                      {user.role === 'master' && (
                        <p className="text-[10px] text-gray-400 mt-2 italic">* 관리자는 모든 부서에 접근할 수 있습니다.</p>
                      )}
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
                <h3 className="font-bold text-[#081429] mb-4 flex items-center gap-2">
                  <Database size={18} /> 데이터 관리
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      이벤트 조회 기간 (년)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={lookbackYears}
                        onChange={(e) => setLookbackYears(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none font-medium"
                      />
                      <button
                        onClick={() => handleUpdateLookback(lookbackYears)}
                        className="px-4 py-2 bg-[#081429] text-white rounded-lg font-bold hover:bg-[#1a2942] transition-colors"
                      >
                        저장
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      * 현재 시점으로부터 과거 N년 동안의 일정 데이터만 불러옵니다. <br />
                      * 기간을 줄이면 앱 로딩 속도가 빨라지고 데이터 비용이 절감됩니다. <br />
                      * 기본값: 2년
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



export default SettingsModal;
