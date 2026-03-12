import React, { useState, useEffect, Suspense } from 'react';
import {
  Printer, Settings, Calculator, BookOpen, GraduationCap,
  Percent, Loader2, Save, FileText, Plus, Calendar, ClipboardList,
} from 'lucide-react';
import { TuitionInputSection } from './TuitionInputSection';
import { TuitionInvoicePreview } from './TuitionInvoicePreview';
import { buildAllExtras } from '../../constants/tuitionExtras';
import { useTuitionInvoices } from '../../hooks/useTuitionInvoices';
import { useTuitionSessions } from '../../hooks/useTuitionSessions';
import { useTuitionHolidays } from '../../hooks/useTuitionHolidays';
import { useTuitionCourses } from '../../hooks/useTuitionCourses';
import { useTuitionExtras } from '../../hooks/useTuitionExtras';
import { useTuitionDiscounts } from '../../hooks/useTuitionDiscounts';
import { usePermissions } from '../../hooks/usePermissions';
import { useStudents } from '../../hooks/useStudents';
import type { UserProfile } from '../../types/auth';
import type {
  TuitionStudentInfo, TuitionSelectedCourse, TuitionSelectedExtra,
  TuitionSelectedDiscount, TuitionSavedInvoice, TuitionCourse,
  TuitionAppMode, TuitionManageTab,
} from '../../types/tuition';

// React.lazy 지연 로딩 (관리 탭 서브 컴포넌트)
const TuitionInvoiceList = React.lazy(() =>
  import('./TuitionInvoiceList').then(m => ({ default: m.TuitionInvoiceList }))
);
const TuitionPriceViewer = React.lazy(() =>
  import('./TuitionPriceViewer').then(m => ({ default: m.TuitionPriceViewer }))
);
const TuitionExtrasViewer = React.lazy(() =>
  import('./TuitionExtrasViewer').then(m => ({ default: m.TuitionExtrasViewer }))
);
const TuitionDiscountViewer = React.lazy(() =>
  import('./TuitionDiscountViewer').then(m => ({ default: m.TuitionDiscountViewer }))
);
const TuitionHolidayManager = React.lazy(() =>
  import('./TuitionHolidayManager').then(m => ({ default: m.TuitionHolidayManager }))
);
const TuitionSessionManager = React.lazy(() =>
  import('./TuitionSessionManager').then(m => ({ default: m.TuitionSessionManager }))
);

// 로딩 폴백 컴포넌트
const LoadingFallback = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-8 h-8 animate-spin text-[#fdb813]" />
  </div>
);

// 초기 학생 정보 생성 함수
const createInitialStudentInfo = (consultantName = ''): TuitionStudentInfo => {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return {
    name: '',
    school: '',
    grade: '',
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    consultant: consultantName,
  };
};

interface TuitionCalculatorTabProps {
  userProfile?: UserProfile | null;
}

const TuitionCalculatorTab: React.FC<TuitionCalculatorTabProps> = ({ userProfile }) => {
  // 권한 체크
  const { hasPermission } = usePermissions(userProfile ?? null);
  const canManage = hasPermission('tuition.manage');

  // 학생 목록 (자동완성용)
  const { students = [] } = useStudents(false);

  // 모드 상태
  const [appMode, setAppMode] = useState<TuitionAppMode>('calculator');
  const [manageTab, setManageTab] = useState<TuitionManageTab>('courses');

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 현재 청구서 상태
  const staffName = userProfile?.name || '';
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<TuitionStudentInfo>(() => createInitialStudentInfo(staffName));
  const [selectedCourses, setSelectedCourses] = useState<TuitionSelectedCourse[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<TuitionSelectedExtra[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<TuitionSelectedDiscount[]>([]);

  // 상담자 기본값: 로그인 직원 이름이 로드되면 비어있는 경우 자동 설정
  useEffect(() => {
    if (staffName && !studentInfo.consultant) {
      setStudentInfo(prev => ({ ...prev, consultant: staffName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffName]);

  // 상수 데이터 (계산기 입력용 - 교재+기타 통합)
  const availableExtras = buildAllExtras();

  // 훅
  const { saveInvoice, updateInvoice } = useTuitionInvoices();
  const { sessions: sessionPeriods } = useTuitionSessions();
  const { holidayDateSet } = useTuitionHolidays();
  const {
    courses: availableCourses, isEmpty: isCoursesEmpty,
    updateCoursePrice, addCourse: addNewCourse, deleteCourse: deleteExistingCourse,
    seedCourses, isUpdating: isCourseUpdating, isSeeding: isCourseSeeding,
  } = useTuitionCourses();
  const {
    extras: serviceExtras, isEmpty: isExtrasEmpty,
    updateExtra: updateExtraItem, addExtra: addNewExtra, deleteExtra: deleteExistingExtra,
    seedExtras, isUpdating: isExtraUpdating, isSeeding: isExtraSeeding,
  } = useTuitionExtras();
  const {
    discounts: availableDiscounts, isEmpty: isDiscountsEmpty,
    updateDiscount: updateDiscountItem, addDiscount: addNewDiscount, deleteDiscount: deleteExistingDiscount,
    seedDiscounts, isUpdating: isDiscountUpdating, isSeeding: isDiscountSeeding,
  } = useTuitionDiscounts();

  // 합계 계산
  const calculateTotal = () => {
    const coursesTotal = selectedCourses.reduce((sum, c) => sum + c.price, 0);
    const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
    const discountsTotal = selectedDiscounts.reduce((sum, d) => sum + d.amount, 0);
    return coursesTotal + extrasTotal - discountsTotal;
  };

  // 과목 핸들러
  const addCourse = (courseId: string) => {
    const template = availableCourses.find(c => c.id === courseId);
    if (!template) return;
    const defaultSessions = template.defaultPrice < 100000 ? 8 : 1;
    const newCourse: TuitionSelectedCourse = {
      ...template,
      uid: Date.now().toString() + Math.random().toString(),
      sessions: defaultSessions,
      price: template.defaultPrice * defaultSessions,
      note: '',
    };
    setSelectedCourses(prev => [...prev, newCourse]);
  };

  const removeCourse = (uid: string) => {
    setSelectedCourses(prev => prev.filter(c => c.uid !== uid));
  };

  const updateCourse = (uid: string, field: keyof TuitionSelectedCourse, value: unknown) => {
    setSelectedCourses(prev => prev.map(c => {
      if (c.uid !== uid) return c;
      const updated = { ...c, [field]: value };
      if (field === 'sessions') {
        const original = availableCourses.find(oc => oc.id === c.id);
        if (original && original.defaultPrice < 100000) {
          updated.price = original.defaultPrice * Number(value);
        }
      }
      return updated;
    }));
  };

  // 기타 항목 핸들러
  const addExtra = (extraId: string) => {
    const template = availableExtras.find(e => e.id === extraId);
    if (!template) return;
    const newExtra: TuitionSelectedExtra = {
      ...template,
      uid: Date.now().toString() + Math.random().toString(),
      price: template.defaultPrice,
      note: '',
    };
    setSelectedExtras(prev => [...prev, newExtra]);
  };

  const removeExtra = (uid: string) => {
    setSelectedExtras(prev => prev.filter(e => e.uid !== uid));
  };

  const updateExtra = (uid: string, field: keyof TuitionSelectedExtra, value: unknown) => {
    setSelectedExtras(prev => prev.map(e =>
      e.uid === uid ? { ...e, [field]: value } : e
    ));
  };

  // 할인 핸들러
  const addDiscount = (discountId: string) => {
    const template = availableDiscounts.find(d => d.id === discountId);
    if (!template) return;
    const newDiscount: TuitionSelectedDiscount = {
      ...template,
      uid: Date.now().toString() + Math.random().toString(),
    };
    setSelectedDiscounts(prev => [...prev, newDiscount]);
  };

  const removeDiscount = (uid: string) => {
    setSelectedDiscounts(prev => prev.filter(d => d.uid !== uid));
  };

  const updateDiscount = (uid: string, field: keyof TuitionSelectedDiscount, value: unknown) => {
    setSelectedDiscounts(prev =>
      prev.map(d => (d.uid === uid ? { ...d, [field]: value } : d))
    );
  };

  // 출력
  const handlePrint = () => {
    document.body.classList.add('tuition-print-mode');
    window.print();
    document.body.classList.remove('tuition-print-mode');
  };

  // 청구서 저장
  const handleSaveInvoice = async () => {
    if (!studentInfo.name.trim()) {
      alert('학생 이름을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const totalAmount = calculateTotal();
      if (currentInvoiceId) {
        await updateInvoice({
          id: currentInvoiceId,
          studentInfo,
          courses: selectedCourses,
          extras: selectedExtras,
          discounts: selectedDiscounts,
          totalAmount,
        });
      } else {
        const newId = await saveInvoice({
          studentInfo,
          courses: selectedCourses,
          extras: selectedExtras,
          discounts: selectedDiscounts,
          totalAmount,
        });
        setCurrentInvoiceId(newId as string);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('청구서 저장 오류:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 청구서 불러오기
  const handleSelectInvoice = (invoice: TuitionSavedInvoice) => {
    setCurrentInvoiceId(invoice.id);
    setStudentInfo(invoice.studentInfo);
    setSelectedCourses(invoice.courses);
    setSelectedExtras(invoice.extras);
    setSelectedDiscounts(invoice.discounts || []);
    setAppMode('calculator');
  };

  // 새 청구서
  const handleNewInvoice = () => {
    setCurrentInvoiceId(null);
    setStudentInfo(createInitialStudentInfo(staffName));
    setSelectedCourses([]);
    setSelectedExtras([]);
    setSelectedDiscounts([]);
  };

  return (
    <div className="min-h-full bg-[#f5f5f5] flex flex-col">
      {/* 상단 툴바 */}
      <header className="bg-[#081429] text-white p-4 shadow-md no-print sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-2">
          <div className="font-bold text-xl tracking-wider flex items-center gap-2">
            <span>인재원</span>
            <span className="text-[#fdb813]">수강료 계산기</span>
            {isSaving && (
              <span className="flex items-center gap-1 text-sm text-gray-300 font-normal">
                <Loader2 className="w-4 h-4 animate-spin" />
                저장 중...
              </span>
            )}
            {saveSuccess && (
              <span className="text-sm text-[#fdb813] font-normal">
                저장 완료!
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            {/* 저장된 청구서 버튼 */}
            <button
              onClick={() => setAppMode(appMode === 'invoiceList' ? 'calculator' : 'invoiceList')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                appMode === 'invoiceList'
                  ? 'bg-[#373d41] text-white'
                  : 'bg-transparent text-gray-300 hover:text-white'
              }`}
            >
              <FileText size={20} />
              저장된 청구서
            </button>

            {/* 설정 버튼 */}
            <button
              onClick={() => setAppMode(appMode === 'manage' ? 'calculator' : 'manage')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                appMode === 'manage'
                  ? 'bg-[#373d41] text-white'
                  : 'bg-transparent text-gray-300 hover:text-white'
              }`}
            >
              {appMode === 'manage' ? <Calculator size={20} /> : <Settings size={20} />}
              {appMode === 'manage' ? '계산기 모드' : '설정'}
            </button>

            {appMode === 'calculator' && (
              <>
                <button
                  onClick={handleSaveInvoice}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-[#373d41] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#4a5158] transition-colors shadow disabled:opacity-50"
                >
                  <Save size={20} />
                  {currentInvoiceId ? '수정 저장' : '청구서 저장'}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-[#fdb813] text-[#081429] px-4 py-2 rounded-lg font-bold hover:bg-[#fdc943] transition-colors shadow"
                >
                  <Printer size={20} />
                  출력하기
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        {appMode === 'invoiceList' ? (
          <div className="w-full">
            <Suspense fallback={<LoadingFallback />}>
              <TuitionInvoiceList
                onSelectInvoice={handleSelectInvoice}
                onClose={() => setAppMode('calculator')}
              />
            </Suspense>
          </div>
        ) : appMode === 'manage' ? (
          <div className="w-full flex flex-col gap-4">
            {/* 관리 탭 네비게이션 */}
            <div className="flex gap-2 border-b border-[#373d41]/20 pb-2 overflow-x-auto no-print">
              {([
                { key: 'courses', label: '수강료 설정', icon: GraduationCap },
                { key: 'extras', label: '교재/기타 설정', icon: BookOpen },
                { key: 'discounts', label: '할인 설정', icon: Percent },
                { key: 'holidays', label: '공휴일 설정', icon: Calendar },
                { key: 'sessions', label: '세션 설정', icon: ClipboardList },
              ] as Array<{ key: TuitionManageTab; label: string; icon: React.ElementType }>).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setManageTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
                    manageTab === key
                      ? 'bg-[#081429] text-white shadow-md'
                      : 'bg-white text-[#373d41] hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </div>

            <Suspense fallback={<LoadingFallback />}>
              {manageTab === 'courses' && (
                <TuitionPriceViewer
                  courses={availableCourses}
                  canManage={canManage}
                  isEmpty={isCoursesEmpty}
                  onUpdatePrice={updateCoursePrice}
                  onAddCourse={addNewCourse}
                  onDeleteCourse={deleteExistingCourse}
                  onSeed={seedCourses}
                  isUpdating={isCourseUpdating}
                  isSeeding={isCourseSeeding}
                />
              )}
              {manageTab === 'extras' && (
                <TuitionExtrasViewer
                  extras={serviceExtras}
                  canManage={canManage}
                  isEmpty={isExtrasEmpty}
                  onUpdateExtra={updateExtraItem}
                  onAddExtra={addNewExtra}
                  onDeleteExtra={deleteExistingExtra}
                  onSeed={seedExtras}
                  isUpdating={isExtraUpdating}
                  isSeeding={isExtraSeeding}
                />
              )}
              {manageTab === 'discounts' && (
                <TuitionDiscountViewer
                  discounts={availableDiscounts}
                  canManage={canManage}
                  isEmpty={isDiscountsEmpty}
                  onUpdateDiscount={updateDiscountItem}
                  onAddDiscount={addNewDiscount}
                  onDeleteDiscount={deleteExistingDiscount}
                  onSeed={seedDiscounts}
                  isUpdating={isDiscountUpdating}
                  isSeeding={isDiscountSeeding}
                />
              )}
              {manageTab === 'holidays' && (
                <TuitionHolidayManager />
              )}
              {manageTab === 'sessions' && (
                <TuitionSessionManager />
              )}
            </Suspense>
          </div>
        ) : (
          <div className="w-full flex flex-col lg:flex-row gap-6">
            {/* 왼쪽: 입력 패널 */}
            <div className="w-full lg:flex-1 lg:max-w-md no-print">
              {currentInvoiceId && (
                <button
                  onClick={handleNewInvoice}
                  className="w-full mb-4 flex items-center justify-center gap-2 bg-[#081429] text-white px-4 py-3 rounded-lg font-bold hover:bg-[#0c1e3d] transition-colors"
                >
                  <Plus size={20} />
                  새 청구서 작성
                </button>
              )}
              <TuitionInputSection
                studentInfo={studentInfo}
                setStudentInfo={setStudentInfo}
                students={students}
                availableCourses={availableCourses}
                selectedCourses={selectedCourses}
                addCourse={addCourse}
                removeCourse={removeCourse}
                updateCourse={updateCourse}
                availableExtras={availableExtras}
                selectedExtras={selectedExtras}
                addExtra={addExtra}
                removeExtra={removeExtra}
                updateExtra={updateExtra}
                availableDiscounts={availableDiscounts}
                selectedDiscounts={selectedDiscounts}
                addDiscount={addDiscount}
                removeDiscount={removeDiscount}
                updateDiscount={updateDiscount}
                holidayDateSet={holidayDateSet}
              />
            </div>

            {/* 오른쪽: 미리보기 (화면) */}
            <div className="w-full lg:flex-[2] no-print">
              <TuitionInvoicePreview
                studentInfo={studentInfo}
                selectedCourses={selectedCourses}
                selectedExtras={selectedExtras}
                selectedDiscounts={selectedDiscounts}
                sessionPeriods={sessionPeriods}
                holidayDateSet={holidayDateSet}
              />
            </div>

            {/* 인쇄 전용 (전체 크기) */}
            <div className="hidden print:block print:w-full">
              <TuitionInvoicePreview
                studentInfo={studentInfo}
                selectedCourses={selectedCourses}
                selectedExtras={selectedExtras}
                selectedDiscounts={selectedDiscounts}
                sessionPeriods={sessionPeriods}
                holidayDateSet={holidayDateSet}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TuitionCalculatorTab;
