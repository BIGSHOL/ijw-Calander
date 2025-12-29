import React, { useState, useEffect } from 'react';
import { ClassKeywordColor } from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { X } from 'lucide-react';

interface ClassesTabProps {
    isMaster: boolean;
}

const ClassesTab: React.FC<ClassesTabProps> = ({ isMaster }) => {
    // --- Local State ---
    const [classKeywords, setClassKeywords] = useState<ClassKeywordColor[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [newKeywordBgColor, setNewKeywordBgColor] = useState('#fee2e2');
    const [newKeywordTextColor, setNewKeywordTextColor] = useState('#dc2626');

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
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* 수업 키워드 색상 관리 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold mb-2 flex items-center gap-2 text-purple-700">
                    🎨 수업 키워드 색상 관리
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                    수업명에 특정 단어가 포함되면 색상을 자동으로 적용합니다. (예: 'Phonics', 'Grammar')
                    <br />
                    <span className="text-purple-500">* 강사별 고유 색상은 '강사 관리' 메뉴에서 설정하세요.</span>
                </p>

                {/* 입력 폼 */}
                <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-600 block mb-1">키워드</label>
                        <input
                            type="text"
                            placeholder="예: Phonics"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#fdb813] outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1">배경색</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={newKeywordBgColor}
                                onChange={(e) => setNewKeywordBgColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer"
                            />
                            <span className="text-xs text-gray-500 font-mono">{newKeywordBgColor}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 block mb-1">글자색</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={newKeywordTextColor}
                                onChange={(e) => setNewKeywordTextColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer"
                            />
                            <span className="text-xs text-gray-500 font-mono">{newKeywordTextColor}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleAddKeyword}
                        className="mt-5 px-4 py-2 bg-[#081429] text-white rounded-lg text-sm font-bold hover:brightness-110"
                    >
                        추가
                    </button>
                </div>

                {/* 키워드 목록 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {classKeywords.map(kw => (
                        <div
                            key={kw.id}
                            className="relative group p-3 rounded-lg border shadow-sm"
                            style={{ backgroundColor: kw.bgColor, color: kw.textColor }}
                        >
                            <span className="font-bold">{kw.keyword}</span>
                            <button
                                onClick={() => handleDeleteKeyword(kw.id, kw.keyword)}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 transition-opacity"
                            >
                                <X size={12} />
                            </button>
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
