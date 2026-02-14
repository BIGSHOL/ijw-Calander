import React, { useState, useMemo, useCallback } from 'react';
import { UserProfile, UserRole } from '../../types';
import { useNotices, Notice } from '../../hooks/useNotices';
import { ROLE_LABELS } from '../../types/auth';
import { Search, Plus, Pin, Bell, X, Edit2, Trash2, Eye, EyeOff, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';

interface NoticesTabProps {
  currentUser?: UserProfile | null;
}

type NoticeCategory = 'all' | 'general' | 'schedule' | 'policy' | 'event' | 'urgent';

const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  general: '일반',
  schedule: '일정',
  policy: '운영',
  event: '행사',
  urgent: '긴급',
};

const CATEGORY_OPTIONS: { value: Notice['category']; label: string }[] = [
  { value: 'general', label: '일반' },
  { value: 'schedule', label: '일정' },
  { value: 'policy', label: '운영' },
  { value: 'event', label: '행사' },
  { value: 'urgent', label: '긴급' },
];

const PRIORITY_OPTIONS: { value: Notice['priority']; label: string }[] = [
  { value: 'normal', label: '일반' },
  { value: 'important', label: '중요' },
  { value: 'urgent', label: '긴급' },
];

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  important: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TARGET_ROLES: UserRole[] = ['master', 'admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];

interface NoticeFormData {
  title: string;
  content: string;
  category: Notice['category'];
  priority: Notice['priority'];
  isPinned: boolean;
  isPublished: boolean;
  targetRoles: UserRole[];
}

const INITIAL_FORM: NoticeFormData = {
  title: '',
  content: '',
  category: 'general',
  priority: 'normal',
  isPinned: false,
  isPublished: true,
  targetRoles: [...TARGET_ROLES],
};

export default function NoticesTab({ currentUser }: NoticesTabProps) {
  const {
    notices, isLoading,
    createNotice, updateNotice, deleteNotice,
    togglePin, togglePublish, incrementViewCount,
  } = useNotices();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<NoticeCategory>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);
  const [form, setForm] = useState<NoticeFormData>(INITIAL_FORM);

  const canEdit = currentUser?.role === 'master' || currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const filteredNotices = useMemo(() => {
    if (!notices) return [];
    return notices
      .filter(n => {
        if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [notices, categoryFilter, searchQuery]);

  const openCreateForm = useCallback(() => {
    setEditingNotice(null);
    setForm(INITIAL_FORM);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((notice: Notice) => {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      priority: notice.priority,
      isPinned: notice.isPinned,
      isPublished: notice.isPublished,
      targetRoles: [...notice.targetRoles],
    });
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingNotice(null);
    setForm(INITIAL_FORM);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (editingNotice) {
      updateNotice.mutate({ id: editingNotice.id, ...form });
    } else {
      createNotice.mutate({
        ...form,
        authorId: currentUser?.uid || '',
        authorName: currentUser?.name || '',
        attachments: [],
        publishedAt: form.isPublished ? new Date().toISOString() : undefined,
      });
    }
    closeForm();
  }, [form, editingNotice, updateNotice, createNotice, currentUser, closeForm]);

  const handleDelete = useCallback((id: string) => {
    if (window.confirm('이 공지사항을 삭제하시겠습니까?')) {
      deleteNotice.mutate(id);
      if (selectedNotice === id) setSelectedNotice(null);
    }
  }, [deleteNotice, selectedNotice]);

  const handleToggleSelect = useCallback((noticeId: string) => {
    if (selectedNotice !== noticeId) {
      incrementViewCount.mutate(noticeId);
    }
    setSelectedNotice(prev => prev === noticeId ? null : noticeId);
  }, [selectedNotice, incrementViewCount]);

  const handleToggleRole = useCallback((role: UserRole) => {
    setForm(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role],
    }));
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900">공지사항</h1>
          <span className="text-xs text-gray-500">{filteredNotices.length}건</span>
        </div>
        {canEdit && (
          <button
            onClick={openCreateForm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            공지 작성
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="제목, 내용 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {(Object.keys(CATEGORY_LABELS) as NoticeCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">로딩 중...</div>
        ) : filteredNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Bell size={32} className="mb-2" />
            <p className="text-sm">공지사항이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotices.map(notice => {
              const isExpanded = selectedNotice === notice.id;
              return (
                <div
                  key={notice.id}
                  className={`bg-white rounded-lg border transition-all ${
                    isExpanded ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 hover:shadow-sm'
                  }`}
                >
                  {/* Card Header */}
                  <button
                    onClick={() => handleToggleSelect(notice.id)}
                    className="w-full text-left p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {notice.isPinned && <Pin size={12} className="text-blue-500 flex-shrink-0" />}
                          {!notice.isPublished && (
                            <span className="text-xxs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 border border-gray-300">비공개</span>
                          )}
                          <span className={`text-xxs px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[notice.priority] || PRIORITY_STYLES.normal}`}>
                            {CATEGORY_LABELS[notice.category] || notice.category}
                          </span>
                          {notice.priority !== 'normal' && (
                            <span className={`text-xxs px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[notice.priority]}`}>
                              {notice.priority === 'urgent' ? '긴급' : '중요'}
                            </span>
                          )}
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{notice.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-xxs text-gray-400 text-right">
                          <div>{notice.authorName}</div>
                          <div>{new Date(notice.createdAt).toLocaleDateString('ko-KR')}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xxs text-gray-400">
                          <Eye size={10} />
                          <span>{notice.viewCount}</span>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-3 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {notice.content}
                      </div>

                      {/* Attachments */}
                      {notice.attachments?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-1 text-xxs text-gray-500 mb-1.5">
                            <Paperclip size={10} />
                            <span>첨부파일 ({notice.attachments.length})</span>
                          </div>
                          <div className="space-y-1">
                            {notice.attachments.map((att, i) => (
                              <a
                                key={i}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                <Paperclip size={10} />
                                <span>{att.name}</span>
                                <span className="text-gray-400">({(att.size / 1024).toFixed(0)}KB)</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Target Roles */}
                      {notice.targetRoles?.length > 0 && notice.targetRoles.length < TARGET_ROLES.length && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xxs text-gray-500 mb-1">대상:</div>
                          <div className="flex flex-wrap gap-1">
                            {notice.targetRoles.map(role => (
                              <span key={role} className="text-xxs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                                {ROLE_LABELS[role] || role}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {canEdit && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                          <button
                            onClick={() => openEditForm(notice)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Edit2 size={12} />
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(notice.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={12} />
                            삭제
                          </button>
                          <button
                            onClick={() => togglePin.mutate({ id: notice.id, isPinned: notice.isPinned })}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                              notice.isPinned ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            <Pin size={12} />
                            {notice.isPinned ? '고정 해제' : '고정'}
                          </button>
                          <button
                            onClick={() => togglePublish.mutate({ id: notice.id, isPublished: notice.isPublished })}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                              notice.isPublished ? 'text-gray-600 bg-gray-100 hover:bg-gray-200' : 'text-green-600 bg-green-50 hover:bg-green-100'
                            }`}
                          >
                            {notice.isPublished ? <><EyeOff size={12} />비공개</> : <><Eye size={12} />게시</>}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeForm}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-bold text-gray-800">
                {editingNotice ? '공지사항 수정' : '공지사항 작성'}
              </h3>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="공지사항 제목을 입력하세요"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">분류</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value as Notice['category'] }))}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">우선순위</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as Notice['priority'] }))}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">내용 *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="공지사항 내용을 입력하세요"
                  rows={8}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Options */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={e => setForm(prev => ({ ...prev, isPinned: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  상단 고정
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={e => setForm(prev => ({ ...prev, isPublished: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  즉시 게시
                </label>
              </div>

              {/* Target Roles */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">공개 대상</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      targetRoles: prev.targetRoles.length === TARGET_ROLES.length ? [] : [...TARGET_ROLES],
                    }))}
                    className={`px-2 py-1 text-xxs rounded border transition-colors ${
                      form.targetRoles.length === TARGET_ROLES.length
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    전체
                  </button>
                  {TARGET_ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleToggleRole(role)}
                      className={`px-2 py-1 text-xxs rounded border transition-colors ${
                        form.targetRoles.includes(role)
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {ROLE_LABELS[role] || role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-xs text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.title.trim() || !form.content.trim() || createNotice.isPending || updateNotice.isPending}
                className="px-4 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createNotice.isPending || updateNotice.isPending ? '저장 중...' : editingNotice ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
