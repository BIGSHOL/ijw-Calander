import React from 'react';
import { ExamType, ExamScope, EXAM_TYPE_LABELS, EXAM_SCOPE_LABELS } from '../../types';
import { GRADE_OPTIONS } from '../../hooks/useClasses';
import { X, Check, Loader2, Building2, Tag, Search } from 'lucide-react';

interface Class {
  id: string;
  className: string;
  teacher?: string;
}

interface ExamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  newExam: {
    title: string;
    date: string;
    type: ExamType;
    subject: 'math' | 'english' | 'both';
    maxScore: number;
    scope: ExamScope;
    targetClassIds: string[];
    targetGrades: string[];
    targetSchools: string[];
    tags: string[];
  };
  setNewExam: React.Dispatch<React.SetStateAction<{
    title: string;
    date: string;
    type: ExamType;
    subject: 'math' | 'english' | 'both';
    maxScore: number;
    scope: ExamScope;
    targetClassIds: string[];
    targetGrades: string[];
    targetSchools: string[];
    tags: string[];
  }>>;
  tagInput: string;
  setTagInput: (value: string) => void;
  classSearchQuery: string;
  setClassSearchQuery: (value: string) => void;
  schoolSearchQuery: string;
  setSchoolSearchQuery: (value: string) => void;
  filteredClasses: Class[];
  filteredSchools: string[];
  classes: Class[];
  availableSchools: string[];
}

const ExamCreateModal: React.FC<ExamCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  newExam,
  setNewExam,
  tagInput,
  setTagInput,
  classSearchQuery,
  setClassSearchQuery,
  schoolSearchQuery,
  setSchoolSearchQuery,
  filteredClasses,
  filteredSchools,
  classes,
  availableSchools,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-bold text-lg">새 시험 등록</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시험명 *</label>
            <input
              type="text"
              value={newExam.title}
              onChange={(e) => setNewExam(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예: 1월 모의고사"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
              <input
                type="date"
                value={newExam.date}
                onChange={(e) => setNewExam(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">만점</label>
              <input
                type="number"
                value={newExam.maxScore}
                onChange={(e) => setNewExam(prev => ({ ...prev, maxScore: Number(e.target.value) }))}
                min={1}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
              <select
                value={newExam.type}
                onChange={(e) => setNewExam(prev => ({ ...prev, type: e.target.value as ExamType }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
              <select
                value={newExam.subject}
                onChange={(e) => setNewExam(prev => ({ ...prev, subject: e.target.value as 'math' | 'english' | 'both', targetClassIds: [] }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="math">수학</option>
                <option value="english">영어</option>
                <option value="both">통합</option>
              </select>
            </div>
          </div>

          {/* 시험 범위 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              시험 범위
            </label>
            <select
              value={newExam.scope}
              onChange={(e) => setNewExam(prev => ({
                ...prev,
                scope: e.target.value as ExamScope,
                targetClassIds: [],
                targetGrades: [],
              }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(EXAM_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* 대상 선택: 반별 */}
          {newExam.scope === 'class' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">대상 반 선택</label>
              {/* 검색 필드 */}
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                  placeholder="반 검색..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {filteredClasses.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">
                    {classes.length === 0 ? '등록된 반이 없습니다' : '검색 결과 없음'}
                  </p>
                ) : (
                  filteredClasses.map(cls => (
                    <label key={cls.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newExam.targetClassIds.includes(cls.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewExam(prev => ({ ...prev, targetClassIds: [...prev.targetClassIds, cls.id] }));
                          } else {
                            setNewExam(prev => ({ ...prev, targetClassIds: prev.targetClassIds.filter(id => id !== cls.id) }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{cls.className}</span>
                      <span className="text-xs text-gray-400 ml-auto">{cls.teacher}</span>
                    </label>
                  ))
                )}
              </div>
              {newExam.targetClassIds.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">{newExam.targetClassIds.length}개 반 선택됨</p>
              )}
            </div>
          )}

          {/* 대상 선택: 학년별 */}
          {newExam.scope === 'grade' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">대상 학년 선택</label>
              <div className="flex flex-wrap gap-2">
                {GRADE_OPTIONS.map(grade => (
                  <label key={grade} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newExam.targetGrades.includes(grade)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewExam(prev => ({ ...prev, targetGrades: [...prev.targetGrades, grade] }));
                        } else {
                          setNewExam(prev => ({ ...prev, targetGrades: prev.targetGrades.filter(g => g !== grade) }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{grade}</span>
                  </label>
                ))}
              </div>
              {newExam.targetGrades.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">{newExam.targetGrades.join(', ')} 선택됨</p>
              )}
            </div>
          )}

          {/* 대상 선택: 학교별 */}
          {newExam.scope === 'school' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">대상 학교 선택</label>
              {/* 검색 필드 */}
              <div className="relative mb-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={schoolSearchQuery}
                  onChange={(e) => setSchoolSearchQuery(e.target.value)}
                  placeholder="학교 검색..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {filteredSchools.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">
                    {availableSchools.length === 0 ? '등록된 학교가 없습니다' : '검색 결과 없음'}
                  </p>
                ) : (
                  filteredSchools.map(school => (
                    <label key={school} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newExam.targetSchools.includes(school)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewExam(prev => ({ ...prev, targetSchools: [...prev.targetSchools, school] }));
                          } else {
                            setNewExam(prev => ({ ...prev, targetSchools: prev.targetSchools.filter(s => s !== school) }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{school}</span>
                    </label>
                  ))
                )}
              </div>
              {newExam.targetSchools.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">{newExam.targetSchools.length}개 학교 선택됨</p>
              )}
            </div>
          )}

          {/* 태그 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Tag className="w-4 h-4 inline mr-1" />
              태그
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    const tag = tagInput.trim().startsWith('#') ? tagInput.trim() : `#${tagInput.trim()}`;
                    if (!newExam.tags.includes(tag)) {
                      setNewExam(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                    }
                    setTagInput('');
                  }
                }}
                placeholder="태그 입력 후 Enter (예: 내신대비)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            {newExam.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {newExam.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => setNewExam(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                      className="hover:text-blue-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={!newExam.title || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>등록</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamCreateModal;
