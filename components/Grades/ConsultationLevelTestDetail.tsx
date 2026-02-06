import React from 'react';
import { X, Zap, BookOpen, Globe } from 'lucide-react';
import { SubjectConsultationDetail } from '../../types';
import { ConsultationLevelTest } from '../../hooks/useGradeProfile';

interface ConsultationLevelTestDetailProps {
  test: ConsultationLevelTest;
  onClose: () => void;
}

const ReadOnlyCell: React.FC<{ label: string; value?: string; className?: string }> = ({ label, value, className = '' }) => (
  <div className={`px-1.5 py-1.5 ${className}`}>
    <div className="text-[10px] font-semibold text-center mb-1">{label}</div>
    <div className="w-full px-1 py-1 text-sm text-center bg-gray-50 border border-gray-200 rounded-sm text-gray-800 font-medium min-h-[30px] flex items-center justify-center">
      {value || '-'}
    </div>
  </div>
);

const MathDetail: React.FC<{ detail: SubjectConsultationDetail }> = ({ detail }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-2">
      <BookOpen size={14} className="text-emerald-600" />
      <span className="text-xs font-bold text-emerald-800">수학 레벨테스트</span>
    </div>
    <div className="border border-emerald-200 rounded overflow-hidden">
      <div className="grid grid-cols-4 bg-emerald-50/70">
        {[
          { label: '계산력', val: detail.calculationScore },
          { label: '이해력', val: detail.comprehensionScore },
          { label: '추론력', val: detail.reasoningScore },
          { label: '문제해결력', val: detail.problemSolvingScore },
        ].map((item, i) => (
          <ReadOnlyCell key={item.label} label={item.label} value={item.val} className={`text-emerald-700 ${i < 3 ? 'border-r border-emerald-200' : ''}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 border-t border-emerald-200 bg-white">
        {[
          { label: '내 점수', val: detail.myTotalScore },
          { label: '평균 점수', val: detail.averageScore },
          { label: '등급', val: detail.scoreGrade },
        ].map((item, i) => (
          <ReadOnlyCell key={item.label} label={item.label} value={item.val} className={`text-slate-500 ${i < 2 ? 'border-r border-emerald-200' : ''}`} />
        ))}
      </div>
    </div>
  </div>
);

const ReadOnlyRow: React.FC<{ label: string; myVal?: string; avgVal?: string; borderClass: string }> = ({ label, myVal, avgVal, borderClass }) => (
  <div className={`grid grid-cols-[auto_1fr_1fr] ${borderClass}`}>
    <div className={`px-2 py-1.5 w-20 text-[11px] font-medium text-slate-600 text-center bg-opacity-30`}>{label}</div>
    <div className={`px-1 py-1 border-l ${borderClass.includes('sky') ? 'border-sky-100' : 'border-blue-100'}`}>
      <div className="w-full px-1 py-0.5 text-sm text-center bg-gray-50 border border-gray-200 rounded-sm font-medium">{myVal || '-'}</div>
    </div>
    <div className={`px-1 py-1 border-l ${borderClass.includes('sky') ? 'border-sky-100' : 'border-blue-100'}`}>
      <div className="w-full px-1 py-0.5 text-sm text-center bg-gray-50 border border-gray-200 rounded-sm font-medium">{avgVal || '-'}</div>
    </div>
  </div>
);

const EnglishDetail: React.FC<{ detail: SubjectConsultationDetail }> = ({ detail }) => {
  const testType = detail.englishTestType;
  const testLabel = testType === 'ai' ? 'AI 레벨테스트' : testType === 'nelt' ? 'NELT Report' : testType === 'eie' ? 'EiE PTR' : '영어 레벨테스트';

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Globe size={14} className="text-blue-600" />
        <span className="text-xs font-bold text-blue-800">{testLabel}</span>
      </div>

      {/* AI 레벨테스트 */}
      {testType === 'ai' && (
        <div className="border border-blue-200 rounded overflow-hidden">
          <div className="grid grid-cols-4 bg-blue-50/70">
            {[
              { label: 'Lv', val: detail.engLevel },
              { label: '학년 수준', val: detail.engAiGradeLevel },
              { label: 'AR 지수', val: detail.engAiArIndex },
              { label: '상위 %', val: detail.engAiTopPercent },
            ].map((item, i) => (
              <ReadOnlyCell key={item.label} label={item.label} value={item.val} className={`text-blue-700 ${i < 3 ? 'border-r border-blue-200' : ''}`} />
            ))}
          </div>
          <div className="border-t border-blue-200">
            <div className="grid grid-cols-[auto_1fr_1fr] text-[10px] font-semibold text-blue-700 bg-blue-50/50 border-b border-blue-100">
              <div className="px-2 py-1 w-20 text-center">영역</div>
              <div className="px-2 py-1 text-center border-l border-blue-100">나의 레벨</div>
              <div className="px-2 py-1 text-center border-l border-blue-100">회원평균</div>
            </div>
            {[
              { label: '단어', my: detail.engAiWordMy, avg: detail.engAiWordAvg },
              { label: '듣기', my: detail.engAiListenMy, avg: detail.engAiListenAvg },
              { label: '읽기', my: detail.engAiReadMy, avg: detail.engAiReadAvg },
              { label: '쓰기', my: detail.engAiWriteMy, avg: detail.engAiWriteAvg },
            ].map((row, i) => (
              <ReadOnlyRow key={row.label} label={row.label} myVal={row.my} avgVal={row.avg} borderClass={i < 3 ? 'border-b border-blue-100' : ''} />
            ))}
          </div>
        </div>
      )}

      {/* NELT Report */}
      {testType === 'nelt' && (
        <div className="border border-violet-200 rounded overflow-hidden">
          <div className="grid grid-cols-3 bg-violet-50/70">
            {[
              { label: 'Lv', val: detail.engLevel },
              { label: '종합 수준', val: detail.engNeltOverallLevel },
              { label: '동학년 석차', val: detail.engNeltRank },
            ].map((item, i) => (
              <ReadOnlyCell key={item.label} label={item.label} value={item.val} className={`text-violet-700 ${i < 2 ? 'border-r border-violet-200' : ''}`} />
            ))}
          </div>
          <div className="grid grid-cols-4 border-t border-violet-200 bg-white">
            {[
              { label: '어휘', val: detail.engNeltVocab },
              { label: '문법', val: detail.engNeltGrammar },
              { label: '듣기', val: detail.engNeltListening },
              { label: '독해', val: detail.engNeltReading },
            ].map((item, i) => (
              <ReadOnlyCell key={item.label} label={item.label} value={item.val} className={`text-slate-500 ${i < 3 ? 'border-r border-violet-200' : ''}`} />
            ))}
          </div>
        </div>
      )}

      {/* EiE PTR */}
      {testType === 'eie' && (
        <div className="border border-sky-200 rounded overflow-hidden">
          <div className="grid grid-cols-4 bg-sky-50/70">
            {[
              { label: 'Lv', val: detail.engLevel },
              { label: '학년 수준', val: detail.engEieGradeLevel },
              { label: '어휘 수준', val: detail.engEieVocabLevel },
              { label: '동학년순위', val: detail.engEieRank },
            ].map((item, i) => (
              <ReadOnlyCell key={item.label} label={item.label} value={item.val} className={`text-sky-700 ${i < 3 ? 'border-r border-sky-200' : ''}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 border-t border-sky-200 bg-sky-50/40">
            {[
              { label: '과정', val: detail.engEieCourse },
              { label: '레벨', val: detail.engEieChartLevel },
              { label: '교재', val: detail.engEieTextbook },
            ].map((item, i) => (
              <ReadOnlyCell key={item.label} label={item.label} value={item.val} className={`text-sky-600 ${i < 2 ? 'border-r border-sky-200' : ''}`} />
            ))}
          </div>
          <div className="border-t border-sky-200">
            <div className="grid grid-cols-[auto_1fr_1fr] text-[10px] font-semibold text-sky-700 bg-sky-50/50 border-b border-sky-100">
              <div className="px-2 py-1 w-20 text-center">영역</div>
              <div className="px-2 py-1 text-center border-l border-sky-100">나의 레벨</div>
              <div className="px-2 py-1 text-center border-l border-sky-100">회원평균</div>
            </div>
            {[
              { label: 'Vocabulary', my: detail.engEieVocabMy, avg: detail.engEieVocabAvg },
              { label: 'Listening', my: detail.engEieListenMy, avg: detail.engEieListenAvg },
              { label: 'Reading', my: detail.engEieReadMy, avg: detail.engEieReadAvg },
              { label: 'Grammar', my: detail.engEieGrammarMy, avg: detail.engEieGrammarAvg },
            ].map((row, i) => (
              <ReadOnlyRow key={row.label} label={row.label} myVal={row.my} avgVal={row.avg} borderClass={i < 3 ? 'border-b border-sky-100' : ''} />
            ))}
          </div>
        </div>
      )}

      {/* 테스트 유형 없이 레벨만 있는 경우 */}
      {!testType && detail.engLevel && (
        <div className="border border-blue-200 rounded p-3 bg-blue-50/50 text-center">
          <span className="text-xs text-blue-600">레벨: </span>
          <span className="text-sm font-bold text-blue-800">{detail.engLevel}</span>
        </div>
      )}
    </div>
  );
};

const ConsultationLevelTestDetail: React.FC<ConsultationLevelTestDetailProps> = ({ test, onClose }) => {
  const isMath = test.subject === 'math';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-lg overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between z-10">
          <div>
            <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
              <Zap size={14} />
              {test.studentName} 레벨테스트
            </h3>
            <p className="text-xs text-gray-500">{test.testDate} | 상담자: {test.evaluatorName || '-'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-4">
          {isMath ? (
            <MathDetail detail={test._sourceDetail} />
          ) : (
            <EnglishDetail detail={test._sourceDetail} />
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultationLevelTestDetail;
