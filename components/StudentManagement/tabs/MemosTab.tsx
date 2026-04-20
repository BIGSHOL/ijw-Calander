/**
 * MemosTab — 학생 상세의 "메모" 탭
 *
 * 담임·부담임 간 해당 학생에 대한 특이사항을 공유하는 메모장.
 * - 읽기: 모든 학생 열람 권한자
 * - 작성: 해당 학생의 담임·부담임 (+ master/admin)
 * - 수정/삭제: 본인 작성 메모 (+ master/admin)
 * - 카테고리: 학업/생활/상담/건강/기타
 * - 중요 메모 고정(pin) 지원
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Edit2,
  Pin,
  PinOff,
  Save,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { UnifiedStudent, UserProfile } from '../../../types';
import {
  MEMO_CATEGORY_META,
  MEMO_CATEGORY_ORDER,
  MemoCategory,
  StudentMemo,
} from '../../../types/memo';
import {
  useCreateStudentMemo,
  useDeleteStudentMemo,
  useStudentMemos,
  useUpdateStudentMemo,
} from '../../../hooks/useStudentMemos';

interface MemosTabProps {
  student: UnifiedStudent;
  currentUser?: UserProfile | null;
}

type FilterValue = 'all' | MemoCategory;

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: '전체' },
  ...MEMO_CATEGORY_ORDER.map(cat => ({
    value: cat as FilterValue,
    label: MEMO_CATEGORY_META[cat].label,
  })),
];

const formatKstRelative = (iso: string): string => {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
};

const MemosTab: React.FC<MemosTabProps> = ({ student, currentUser }) => {
  const { data: memos = [], isLoading, error } = useStudentMemos(student.id);
  const createMutation = useCreateStudentMemo();
  const updateMutation = useUpdateStudentMemo();
  const deleteMutation = useDeleteStudentMemo();

  // ====== 권한 판별 ======
  const isAdmin = currentUser?.role === 'master' || currentUser?.role === 'admin';

  // 담임·부담임 여부: 해당 학생의 활성 enrollment에 current user의 staffId/이름이 있는가
  const isTeacherOfStudent = useMemo(() => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    const userStaffId = currentUser.staffId || '';
    const userName = currentUser.displayName || currentUser.name || '';
    const identifiers = [userStaffId, userName].filter(Boolean);
    if (identifiers.length === 0) return false;

    const enrollments = (student.enrollments || []) as any[];
    return enrollments.some(e => {
      if (e.endDate || e.withdrawalDate) return false;  // 종료된 enrollment 제외
      if (identifiers.includes(e.staffId)) return true;
      if (identifiers.includes(e.teacher)) return true;
      // 부담임 (slotTeachers) 체크
      if (e.slotTeachers && typeof e.slotTeachers === 'object') {
        for (const v of Object.values(e.slotTeachers)) {
          if (typeof v === 'string' && identifiers.includes(v)) return true;
        }
      }
      return false;
    });
  }, [currentUser, isAdmin, student.enrollments]);

  const canWrite = isTeacherOfStudent;
  const isMemoEditable = (memo: StudentMemo) =>
    isAdmin || (!!currentUser?.uid && memo.authorId === currentUser.uid);

  // ====== 입력 상태 ======
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoCategory>('academic');
  const [newPinned, setNewPinned] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingCategory, setEditingCategory] = useState<MemoCategory>('academic');

  // ====== 정렬/필터 ======
  const visibleMemos = useMemo(() => {
    let arr = filter === 'all' ? memos : memos.filter(m => m.category === filter);
    // 고정 먼저, 그 다음 최신순
    arr = [...arr].sort((a, b) => {
      const ap = a.isPinned ? 1 : 0;
      const bp = b.isPinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return arr;
  }, [memos, filter]);

  // ====== 핸들러 ======
  const handleCreate = async () => {
    if (!canWrite) return;
    const content = newContent.trim();
    if (!content) return;
    if (!currentUser?.uid) {
      alert('로그인 정보를 확인할 수 없습니다.');
      return;
    }
    try {
      await createMutation.mutateAsync({
        studentId: student.id,
        content,
        category: newCategory,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.name || currentUser.email || '작성자',
        authorStaffId: currentUser.staffId,
        isPinned: newPinned,
      });
      setNewContent('');
      setNewPinned(false);
      // 카테고리는 그대로 유지 (연속 작성 시 편의)
    } catch (err: any) {
      alert('메모 작성 실패: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const startEdit = (memo: StudentMemo) => {
    setEditingId(memo.id);
    setEditingContent(memo.content);
    setEditingCategory(memo.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const content = editingContent.trim();
    if (!content) return;
    try {
      await updateMutation.mutateAsync({
        studentId: student.id,
        memoId: editingId,
        content,
        category: editingCategory,
      });
      cancelEdit();
    } catch (err: any) {
      alert('메모 수정 실패: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const handleTogglePin = async (memo: StudentMemo) => {
    if (!isMemoEditable(memo)) return;
    try {
      await updateMutation.mutateAsync({
        studentId: student.id,
        memoId: memo.id,
        isPinned: !memo.isPinned,
      });
    } catch (err: any) {
      alert('핀 토글 실패: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  const handleDelete = async (memo: StudentMemo) => {
    if (!isMemoEditable(memo)) return;
    if (!window.confirm('이 메모를 삭제하시겠습니까? 복구할 수 없습니다.')) return;
    try {
      await deleteMutation.mutateAsync({ studentId: student.id, memoId: memo.id });
    } catch (err: any) {
      alert('메모 삭제 실패: ' + (err?.message || '알 수 없는 오류'));
    }
  };

  return (
    <div className="space-y-3">
      {/* 작성 영역 */}
      {canWrite ? (
        <div className="bg-white border border-gray-200 rounded-sm p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <StickyNote className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-bold text-primary">새 메모</h3>
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="학생에 대한 특이사항·공유할 내용을 적어주세요..."
            rows={3}
            disabled={createMutation.isPending}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex items-center gap-2 mt-1.5">
            {/* 카테고리 선택 */}
            <div className="flex items-center gap-1">
              {MEMO_CATEGORY_ORDER.map(cat => {
                const meta = MEMO_CATEGORY_META[cat];
                const active = newCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewCategory(cat)}
                    disabled={createMutation.isPending}
                    className={`px-1.5 py-0.5 text-xxs font-semibold rounded-sm border transition-colors ${
                      active ? 'border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                    style={active ? { backgroundColor: meta.bg, color: meta.text } : undefined}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {/* 핀 토글 */}
            <button
              type="button"
              onClick={() => setNewPinned(p => !p)}
              disabled={createMutation.isPending}
              className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 text-xxs font-semibold rounded-sm border transition-colors ${
                newPinned
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
              title={newPinned ? '중요 고정 해제' : '중요 고정'}
            >
              {newPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
              {newPinned ? '고정' : '일반'}
            </button>

            {/* 작성 버튼 */}
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newContent.trim()}
              className="px-2.5 py-0.5 text-xs font-semibold bg-accent hover:bg-[#e5a60f] text-primary rounded-sm disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? '작성 중...' : '작성'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-sm p-2.5 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <div className="text-xxs text-gray-500">
            이 학생의 담임·부담임만 메모를 작성할 수 있습니다. 읽기는 자유롭습니다.
          </div>
        </div>
      )}

      {/* 필터 + 개수 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => {
            const active = filter === opt.value;
            const meta = opt.value === 'all' ? null : MEMO_CATEGORY_META[opt.value as MemoCategory];
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-1.5 py-0.5 text-xxs font-semibold rounded-sm border transition-colors ${
                  active ? 'border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
                style={active && meta ? { backgroundColor: meta.bg, color: meta.text } :
                  active ? { backgroundColor: '#111827', color: '#ffffff' } : undefined}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-xxs text-gray-400">
          {visibleMemos.length}개{filter !== 'all' ? ` (전체 ${memos.length})` : ''}
        </span>
      </div>

      {/* 메모 리스트 */}
      {isLoading ? (
        <div className="text-center py-8 text-xs text-gray-400">메모 불러오는 중...</div>
      ) : error ? (
        <div className="text-center py-8 text-xs text-red-500">메모 조회 실패</div>
      ) : visibleMemos.length === 0 ? (
        <div className="text-center py-10">
          <StickyNote className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-xs text-gray-400">
            {filter === 'all' ? '아직 작성된 메모가 없습니다.' : '이 카테고리에 메모가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {visibleMemos.map(memo => {
            const meta = MEMO_CATEGORY_META[memo.category] || MEMO_CATEGORY_META.other;
            const editable = isMemoEditable(memo);
            const isEditing = editingId === memo.id;
            const isEdited = memo.updatedAt && memo.updatedAt !== memo.createdAt;

            return (
              <div
                key={memo.id}
                className={`bg-white border rounded-sm overflow-hidden transition-colors ${
                  memo.isPinned ? 'border-amber-300' : 'border-gray-200'
                }`}
              >
                {/* 헤더: 카테고리 · 작성자 · 날짜 · 액션 */}
                <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b border-gray-100">
                  {/* 카테고리 dot */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.dot }}
                    title={meta.label}
                  />
                  {/* 핀 아이콘 */}
                  {memo.isPinned && (
                    <Pin className="w-3 h-3 text-amber-600" />
                  )}
                  {/* 카테고리 라벨 */}
                  <span
                    className="px-1 py-0.5 text-xxs font-semibold rounded-sm"
                    style={{ backgroundColor: meta.bg, color: meta.text }}
                  >
                    {meta.label}
                  </span>
                  {/* 작성자 */}
                  <span className="text-xxs text-gray-700 font-medium">
                    {memo.authorName}
                  </span>
                  {/* 날짜 */}
                  <span className="text-xxs text-gray-400">
                    {formatKstRelative(memo.createdAt)}
                    {isEdited && <span className="ml-1 text-gray-300">· 수정됨</span>}
                  </span>

                  {/* 액션 버튼 (권한 있는 사람만) */}
                  <div className="ml-auto flex items-center gap-0.5">
                    {editable && !isEditing && (
                      <>
                        <button
                          onClick={() => handleTogglePin(memo)}
                          disabled={updateMutation.isPending}
                          className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-sm transition-colors disabled:opacity-50"
                          title={memo.isPinned ? '고정 해제' : '중요 고정'}
                        >
                          {memo.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => startEdit(memo)}
                          disabled={updateMutation.isPending}
                          className="p-1 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50"
                          title="수정"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(memo)}
                          disabled={deleteMutation.isPending}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    {editable && isEditing && (
                      <>
                        <button
                          onClick={handleUpdate}
                          disabled={updateMutation.isPending || !editingContent.trim()}
                          className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-sm transition-colors disabled:opacity-50"
                          title="저장"
                        >
                          <Save className="w-3 h-3" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={updateMutation.isPending}
                          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors disabled:opacity-50"
                          title="편집 취소"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 본문 */}
                <div className="px-2 py-1.5">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={3}
                        disabled={updateMutation.isPending}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:border-primary resize-none"
                      />
                      <div className="flex items-center gap-1">
                        {MEMO_CATEGORY_ORDER.map(cat => {
                          const m = MEMO_CATEGORY_META[cat];
                          const active = editingCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setEditingCategory(cat)}
                              disabled={updateMutation.isPending}
                              className={`px-1.5 py-0.5 text-xxs font-semibold rounded-sm border transition-colors ${
                                active ? 'border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                              }`}
                              style={active ? { backgroundColor: m.bg, color: m.text } : undefined}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {memo.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MemosTab;
