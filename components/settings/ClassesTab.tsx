import React, { useState, useEffect } from 'react';
import { ClassKeywordColor } from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { X, Edit2, Check } from 'lucide-react';

interface ClassesTabProps {
    isMaster: boolean;
}

const ClassesTab: React.FC<ClassesTabProps> = ({ isMaster }) => {
    // --- Local State ---
    const [classKeywords, setClassKeywords] = useState<ClassKeywordColor[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [newKeywordBgColor, setNewKeywordBgColor] = useState('#fee2e2');
    const [newKeywordTextColor, setNewKeywordTextColor] = useState('#dc2626');

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editKeyword, setEditKeyword] = useState('');
    const [editBgColor, setEditBgColor] = useState('');
    const [editTextColor, setEditTextColor] = useState('');

    // Subscribe to classKeywords collection
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'classKeywords'), (snapshot) => {
            const keywords = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as ClassKeywordColor)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
            setClassKeywords(keywords);
        });
        return () => unsubscribe();
    }, []);

    // --- Handlers ---
    const handleAddKeyword = async () => {
        if (!newKeyword.trim()) return;
        try {
            const id = `keyword_${Date.now()}`;
            await setDoc(doc(db, 'classKeywords', id), {
                keyword: newKeyword.trim(),
                bgColor: newKeywordBgColor,
                textColor: newKeywordTextColor,
                order: classKeywords.length
            });
            setNewKeyword('');
            setNewKeywordBgColor('#fee2e2');
            setNewKeywordTextColor('#dc2626');
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        }
    };

    const handleStartEdit = (kw: ClassKeywordColor) => {
        setEditingId(kw.id);
        setEditKeyword(kw.keyword);
        setEditBgColor(kw.bgColor);
        setEditTextColor(kw.textColor);
    };

    const handleSaveEdit = async (id: string) => {
        if (!editKeyword.trim()) return;
        try {
            const existing = classKeywords.find(k => k.id === id);
            await setDoc(doc(db, 'classKeywords', id), {
                keyword: editKeyword.trim(),
                bgColor: editBgColor,
                textColor: editTextColor,
                order: existing?.order ?? 999
            }, { merge: true });
            setEditingId(null);
        } catch (e) {
            console.error(e);
            alert('수정 실패');
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditKeyword('');
        setEditBgColor('');
        setEditTextColor('');
    };

    const handleDeleteKeyword = async (id: string, keyword: string) => {
        if (!confirm(`'${keyword}' 키워드를 삭제하시겠습니까?`)) return;
        try {
            await deleteDoc(doc(db, 'classKeywords', id));
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    if (!isMaster) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* 수업 키워드 색상 관리 */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold mb-1 flex items-center gap-2 text-purple-700">
                    🎨 수업 키워드 색상 관리
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                    수업명에 특정 단어가 포함되면 색상을 자동으로 적용합니다. (예: 'Phonics', 'Grammar')
                    <br />
                    <span className="text-purple-500">* 강사별 고유 색상은 '강사 관리' 메뉴에서 설정하세요.</span>
                </p>

                {/* 입력 폼 - 더 컴팩트하게 */}
                <div className="flex items-end gap-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-600 block mb-1">키워드</label>
                        <input
                            type="text"
                            placeholder="예: Phonics"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:border-[#fdb813] outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">배경색</label>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="color"
                                value={newKeywordBgColor}
                                onChange={(e) => setNewKeywordBgColor(e.target.value)}
                                className="w-7 h-7 rounded cursor-pointer"
                            />
                            <span className="text-[10px] text-gray-500 font-mono w-16">{newKeywordBgColor}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">글자색</label>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="color"
                                value={newKeywordTextColor}
                                onChange={(e) => setNewKeywordTextColor(e.target.value)}
                                className="w-7 h-7 rounded cursor-pointer"
                            />
                            <span className="text-[10px] text-gray-500 font-mono w-16">{newKeywordTextColor}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleAddKeyword}
                        className="px-4 py-1.5 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-110 whitespace-nowrap"
                    >
                        추가
                    </button>
                </div>

                {/* 키워드 목록 - 더 컴팩트하게 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {classKeywords.map(kw => (
                        <div key={kw.id}>
                            {editingId === kw.id ? (
                                // 수정 모드
                                <div className="p-2 rounded-lg border-2 border-blue-400 bg-blue-50 space-y-2">
                                    <input
                                        type="text"
                                        value={editKeyword}
                                        onChange={(e) => setEditKeyword(e.target.value)}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-semibold outline-none focus:border-blue-400"
                                        autoFocus
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="color"
                                            value={editBgColor}
                                            onChange={(e) => setEditBgColor(e.target.value)}
                                            className="w-6 h-6 rounded cursor-pointer"
                                            title="배경색"
                                        />
                                        <input
                                            type="color"
                                            value={editTextColor}
                                            onChange={(e) => setEditTextColor(e.target.value)}
                                            className="w-6 h-6 rounded cursor-pointer"
                                            title="글자색"
                                        />
                                        <button
                                            onClick={() => handleSaveEdit(kw.id)}
                                            className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1"
                                        >
                                            <Check size={12} /> 저장
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="px-2 py-1 bg-gray-400 text-white rounded text-xs font-bold hover:bg-gray-500"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // 일반 표시 모드
                                <div
                                    className="relative group p-2.5 rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                                    style={{ backgroundColor: kw.bgColor, color: kw.textColor }}
                                >
                                    <span className="text-sm block truncate">{kw.keyword}</span>
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5">
                                        <button
                                            onClick={() => handleStartEdit(kw)}
                                            className="p-1 rounded bg-white/90 hover:bg-white shadow-sm transition-all"
                                            title="수정"
                                        >
                                            <Edit2 size={12} className="text-blue-600" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteKeyword(kw.id, kw.keyword)}
                                            className="p-1 rounded bg-white/90 hover:bg-white shadow-sm transition-all"
                                            title="삭제"
                                        >
                                            <X size={12} className="text-red-600" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {classKeywords.length === 0 && (
                        <div className="col-span-full py-8 text-center text-gray-400 text-sm">
                            등록된 키워드가 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassesTab;
