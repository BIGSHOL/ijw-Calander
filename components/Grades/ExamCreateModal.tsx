import React from 'react';
import { ExamType, ExamScope, EXAM_TYPE_LABELS, EXAM_SCOPE_LABELS } from '../../types';
import { GRADE_OPTIONS } from '../../hooks/useClasses';
import { X, Check, Loader2, Building2, Tag, Search, FileText, BookOpen } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary">새 시험 등록</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* 기본 정보 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <FileText className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">기본 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">시험명 *</span>
                <input
                  type="text"
                  value={newExam.title}
                  onChange={(e) => setNewExam(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 1월 모의고사"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                />
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">날짜</span>
                <input
                  type="date"
                  value={newExam.date}
                  onChange={(e) => setNewExam(prev => ({ ...prev, date: e.target.value }))}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                />
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">만점</span>
                <input
                  type="number"
                  value={newExam.maxScore}
                  onChange={(e) => setNewExam(prev => ({ ...prev, maxScore: Number(e.target.value) }))}
                  min={1}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                />
              </div>
            </div>
          </div>

          {/* 분류 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <BookOpen className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">분류</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">유형</span>
                <select
                  value={newExam.type}
                  onChange={(e) => setNewExam(prev => ({ ...prev, type: e.target.value as ExamType }))}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                >
                  {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">과목</span>
                <select
                  value={newExam.subject}
                  onChange={(e) => setNewExam(prev => ({ ...prev, subject: e.target.value as 'math' | 'english' | 'both', targetClassIds: [] }))}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                >
                  <option value="math">수학</option>
                  <option value="english">영어</option>
                  <option value="both">통합</option>
                </select>
              </div>
            </div>
          </div>

          {/* 시험 범위 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Building2 className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">시험 범위</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-14 shrink-0 text-xs font-medium text-primary-700">범위</span>
                <select
                  value={newExam.scope}
                  onChange={(e) => setNewExam(prev => ({
                    ...prev,
                    scope: e.target.value as ExamScope,
                    targetClassIds: [],
                    targetGrades: [],
                  }))}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                >
                  {Object.entries(EXAM_SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 대상 선택: 반별 */}
              {newExam.scope === 'class' && (
                <div className="px-2 py-2">
                  <label className="block text-xs font-medium text-primary-700 mb-2">대상 반 선택</label>
                  {/* 검색 필드 */}
                  <div className="relative mb-2">
                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={classSearchQuery}
                      onChange={(e) => setClassSearchQuery(e.target.value)}
                      placeholder="반 검색..."
                      className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-sm p-2 space-y-1">
                    {filteredClasses.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">
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
                          <span className="text-xs text-gray-700">{cls.className}</span>
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
                <div className="px-2 py-2">
                  <label className="block text-xs font-medium text-primary-700 mb-2">대상 학년 선택</label>
                  <div className="flex flex-wrap gap-2">
                    {GRADE_OPTIONS.map(grade => (
                      <label key={grade} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-sm hover:bg-gray-50 cursor-pointer">
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
                        <span className="text-xs text-gray-700">{grade}</span>
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
                <div className="px-2 py-2">
                  <label className="block text-xs font-medium text-primary-700 mb-2">대상 학교 선택</label>
                  {/* 검색 필드 */}
                  <div className="relative mb-2">
                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      placeholder="학교 검색..."
                      className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-sm p-2 space-y-1">
                    {filteredSchools.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">
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
                          <span className="text-xs text-gray-700">{school}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {newExam.targetSchools.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{newExam.targetSchools.length}개 학교 선택됨</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 태그 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Tag className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">태그</h3>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center gap-2 px-2 py-1.5">
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
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-accent focus:border-accent outline-none"
                />
              </div>
              {newExam.tags.length > 0 && (
                <div className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {newExam.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-sm"
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
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-gray-200 flex justify-end gap-2 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-sm hover:bg-gray-100"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={!newExam.title || isSubmitting}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent text-primary text-xs font-semibold rounded-sm hover:bg-[#e5a60f] disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            <span>등록</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamCreateModal;
