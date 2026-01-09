import React, { useState, useEffect } from 'react';
import { Hash, Plus, Trash2, Edit, Save, X, GripVertical, Users, Settings } from 'lucide-react';
import { EventTag, DEFAULT_EVENT_TAGS } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

interface HashtagsTabProps {
  isMaster: boolean;
}

interface HashtagConfig {
  tags: EventTag[];
  seminarTags: string[]; // 참가자 관리 UI를 표시할 태그 ID 목록
  updatedAt?: string;
}

const HashtagsTab: React.FC<HashtagsTabProps> = ({ isMaster }) => {
  const [config, setConfig] = useState<HashtagConfig>({
    tags: DEFAULT_EVENT_TAGS,
    seminarTags: ['seminar', 'workshop', 'meeting'] // ID 기반으로 설정
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // 새 태그 추가 폼
  const [newTagId, setNewTagId] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366F1');

  // 편집 중인 태그
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');

  // Firebase에서 설정 로드
  useEffect(() => {
    const docRef = doc(db, 'settings', 'hashtag_config');

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as HashtagConfig;
        setConfig({
          tags: data.tags || DEFAULT_EVENT_TAGS,
          seminarTags: data.seminarTags || ['seminar', 'workshop', 'meeting']
        });
      } else {
        // 기본값 사용
        setConfig({
          tags: DEFAULT_EVENT_TAGS,
          seminarTags: ['seminar', 'workshop', 'meeting']
        });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 설정 저장
  const handleSave = async () => {
    if (isLoading) {
      alert('설정을 불러오는 중입니다. 잠시 후 다시 시도하세요.');
      return;
    }

    try {
      const docRef = doc(db, 'settings', 'hashtag_config');
      await setDoc(docRef, {
        ...config,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setHasChanges(false);
      alert('해시태그 설정이 저장되었습니다.');
    } catch (error) {
      console.error('Error saving hashtag config:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 새 태그 추가
  const handleAddTag = () => {
    if (!newTagName.trim()) {
      alert('태그 이름을 입력하세요.');
      return;
    }

    const tagId = newTagId.trim() || newTagName.trim().toLowerCase().replace(/\s+/g, '-');

    if (config.tags.some(t => t.id === tagId)) {
      alert('이미 존재하는 태그 ID입니다.');
      return;
    }

    const newTag: EventTag = {
      id: tagId,
      name: newTagName.trim(),
      color: newTagColor
    };

    setConfig(prev => ({
      ...prev,
      tags: [...prev.tags, newTag]
    }));
    setNewTagId('');
    setNewTagName('');
    setNewTagColor('#6366F1');
    setHasChanges(true);
  };

  // 태그 삭제
  const handleDeleteTag = (tagId: string) => {
    if (!window.confirm(`"${tagId}" 태그를 삭제하시겠습니까?`)) return;

    setConfig(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t.id !== tagId),
      seminarTags: prev.seminarTags.filter(id => id !== tagId)
    }));
    setHasChanges(true);
  };

  // 태그 편집 시작
  const handleStartEdit = (tag: EventTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color || '#6366F1');
  };

  // 태그 편집 저장
  const handleSaveEdit = () => {
    if (!editingTagId || !editTagName.trim()) return;

    setConfig(prev => ({
      ...prev,
      tags: prev.tags.map(t =>
        t.id === editingTagId
          ? { ...t, name: editTagName.trim(), color: editTagColor }
          : t
      )
    }));
    setEditingTagId(null);
    setHasChanges(true);
  };

  // 세미나 태그 토글
  const toggleSeminarTag = (tagId: string) => {
    setConfig(prev => ({
      ...prev,
      seminarTags: prev.seminarTags.includes(tagId)
        ? prev.seminarTags.filter(id => id !== tagId)
        : [...prev.seminarTags, tagId]
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fdb813]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Hash size={20} className="text-[#fdb813]" />
            해시태그 관리
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            연간 일정에서 사용할 해시태그를 관리합니다.
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg font-bold text-sm hover:bg-[#e5a610] transition-colors"
          >
            <Save size={16} />
            변경사항 저장
          </button>
        )}
      </div>

      {/* 새 태그 추가 */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <Plus size={16} />
          새 태그 추가
        </h4>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">태그 이름 *</label>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="예: 학부모상담"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-500 mb-1">태그 ID (선택)</label>
            <input
              type="text"
              value={newTagId}
              onChange={(e) => setNewTagId(e.target.value)}
              placeholder="자동 생성"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">색상</label>
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border border-gray-300"
            />
          </div>
          <button
            onClick={handleAddTag}
            className="px-4 py-2 bg-[#081429] text-white rounded-lg font-bold text-sm hover:bg-[#0a1a35] transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            추가
          </button>
        </div>
      </div>

      {/* 태그 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 className="text-sm font-bold text-gray-700">등록된 태그 ({config.tags.length}개)</h4>
        </div>
        <div className="divide-y divide-gray-100">
          {config.tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* 색상 */}
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: tag.color || '#9CA3AF' }}
              />

              {/* 태그 정보 */}
              {editingTagId === tag.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editTagName}
                    onChange={(e) => setEditTagName(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    autoFocus
                  />
                  <input
                    type="color"
                    value={editTagColor}
                    onChange={(e) => setEditTagColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={() => setEditingTagId(null)}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}20` : '#E5E7EB',
                          color: tag.color || '#374151',
                          border: `1px solid ${tag.color || '#D1D5DB'}`
                        }}
                      >
                        #{tag.name}
                      </span>
                      <span className="text-xs text-gray-400">ID: {tag.id}</span>
                    </div>
                  </div>

                  {/* 참가자 관리 표시 여부 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSeminarTag(tag.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        config.seminarTags.includes(tag.id)
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                      }`}
                      title="이 태그 선택 시 참가자 관리 섹션 표시"
                    >
                      <Users size={14} />
                      참가자 관리
                    </button>
                  </div>

                  {/* 편집/삭제 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(tag)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 참가자 관리 설명 */}
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-start gap-3">
          <Settings size={20} className="text-amber-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-800 mb-1">참가자 관리 기능</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              "참가자 관리" 버튼이 활성화된 태그를 일정에 선택하면,
              해당 일정의 모달에서 참가자를 추가하고 출석 상태를 관리할 수 있는 섹션이 표시됩니다.
              <br />
              <span className="font-bold">예: 세미나, 설명회, 회의, 워크샵</span> 등의 태그에 활성화하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HashtagsTab;
