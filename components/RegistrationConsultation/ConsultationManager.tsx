import React, { useState, useCallback, Suspense, lazy } from 'react';
import { ConsultationRecord, UserProfile, UnifiedStudent, SchoolGrade, ConsultationSubject, ConsultationStatus, LevelTest } from '../../types';
import { useConsultations, useCreateConsultation, useUpdateConsultation, useDeleteConsultation } from '../../hooks/useConsultations';
import { useStudents } from '../../hooks/useStudents';
import { usePermissions } from '../../hooks/usePermissions';
import { useAddLevelTest, determineLevel } from '../../hooks/useGradeProfile';
import { ConsultationDashboard } from './ConsultationDashboard';
import { ConsultationTable } from './ConsultationTable';
import { ConsultationYearView } from './ConsultationYearView';
import { ConsultationForm } from './ConsultationForm';
import { LayoutDashboard, List, Calendar, Plus, ChevronLeft, ChevronRight, Upload, Loader2, Search, Settings2 } from 'lucide-react';
import { TabSubNavigation } from '../Common/TabSubNavigation';
import { TabButton } from '../Common/TabButton';
import { VideoLoading } from '../Common/VideoLoading';

const RegistrationMigrationModal = lazy(() => import('./RegistrationMigrationModal'));

/**
 * 레벨테스트 점수 문자열 파싱
 * @param scoreStr "85점", "85", "85.5", "85.5점" 등의 형식
 * @returns 숫자 점수 또는 null (파싱 실패 시)
 */
function parseLevelTestScore(scoreStr: string | undefined): number | null {
    if (!scoreStr) return null;

    // 숫자와 소수점만 추출
    const match = scoreStr.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;

    const score = parseFloat(match[1]);
    return isNaN(score) ? null : score;
}

interface ConsultationManagerProps {
    userProfile: UserProfile | null;
}

const ConsultationManager: React.FC<ConsultationManagerProps> = ({ userProfile }) => {
    const { hasPermission } = usePermissions(userProfile);
    const isMaster = userProfile?.role === 'master';

    // 권한 체크
    const canView = isMaster || hasPermission('consultation.view') || hasPermission('consultation.manage');
    const canCreate = isMaster || hasPermission('consultation.create');
    const canEdit = isMaster || hasPermission('consultation.edit') || hasPermission('consultation.manage');
    const canManage = isMaster || hasPermission('consultation.manage'); // 모든 상담 관리 가능
    const canConvert = isMaster || hasPermission('consultation.convert');

    const [view, setView] = useState<'dashboard' | 'table' | 'yearly'>('dashboard');
    const [viewColumns, setViewColumns] = useState<1 | 2>(1); // 1단/2단 보기 상태
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

    // Search & Settings State (lifted from ConsultationTable)
    const [searchTerm, setSearchTerm] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<ConsultationRecord | null>(null);
    const [showMigrationModal, setShowMigrationModal] = useState(false);

    // Firestore hooks - pass year as number or undefined for 'all'
    // 대시보드(통계 비교), 연간뷰(전체 흐름)에서는 전체 데이터를 불러와야 함
    const yearParam = (selectedYear === 'all' || view === 'dashboard' || view === 'yearly') ? undefined : parseInt(selectedYear, 10);
    const queryMonth = (view === 'yearly' || view === 'dashboard') ? 'all' : selectedMonth;
    const { data: consultations = [], isLoading } = useConsultations({ month: queryMonth, year: yearParam });
    const createConsultation = useCreateConsultation();
    const updateConsultation = useUpdateConsultation();
    const deleteConsultation = useDeleteConsultation();

    // 원생 전환을 위한 학생 관리 hook
    const { students: existingStudents, addStudent } = useStudents();
    const addLevelTest = useAddLevelTest();

    const handleAddRecord = useCallback((record: Omit<ConsultationRecord, 'id' | 'createdAt'>) => {
        createConsultation.mutate({
            ...record,
            authorId: userProfile?.uid
        } as Omit<ConsultationRecord, 'id'>, {
            onSuccess: () => {
                setIsFormOpen(false);
            },
            onError: (error) => {
                console.error('상담 등록 오류:', error);
                alert('상담 등록에 실패했습니다.');
            }
        });
    }, [createConsultation, userProfile?.uid]);

    const handleUpdateRecord = useCallback((record: Omit<ConsultationRecord, 'id' | 'createdAt'>) => {
        if (!editingRecord) return;

        updateConsultation.mutate({
            id: editingRecord.id,
            updates: record,
        }, {
            onSuccess: () => {
                setEditingRecord(null);
                setIsFormOpen(false);
            },
            onError: (error) => {
                console.error('상담 수정 오류:', error);
                alert('상담 수정에 실패했습니다.');
            }
        });
    }, [editingRecord, updateConsultation]);

    const handleDeleteRecord = useCallback((id: string) => {
        deleteConsultation.mutate(id, {
            onError: (error) => {
                console.error('상담 삭제 오류:', error);
                alert('상담 삭제에 실패했습니다.');
            }
        });
    }, [deleteConsultation]);

    // 학교 이름 정규화 함수 (축약형 → 전체 이름)
    const normalizeSchoolName = (schoolName: string | undefined): string => {
        if (!schoolName) return '';
        const name = schoolName.trim();
        // 이미 전체 이름이면 그대로 반환
        if (name.includes('초등학교') || name.includes('중학교') || name.includes('고등학교')) {
            return name;
        }
        // 축약형 → 전체 이름 변환
        if (name.includes('초')) return name.replace('초', '초등학교');
        if (name.includes('중')) return name.replace('중', '중학교');
        if (name.includes('고')) return name.replace('고', '고등학교');
        return name;
    };

    // 원생 전환 핸들러
    const handleConvertToStudent = useCallback(async (consultation: ConsultationRecord) => {
        // 중복 방지 체크
        if (consultation.registeredStudentId) {
            alert('이미 원생으로 전환된 상담입니다.');
            return;
        }

        // Performance: js-index-maps - Map을 사용한 O(1) 중복 검색 (이름 + 학교)
        const normalizedConsultSchool = normalizeSchoolName(consultation.schoolName);
        const studentKey = `${consultation.studentName}_${normalizedConsultSchool}`;
        const studentMap = new Map(
            existingStudents
                .filter(s => s.status !== 'withdrawn')
                .map(s => [`${s.name}_${normalizeSchoolName(s.school)}`, s])
        );
        const existingStudent = studentMap.get(studentKey);

        if (existingStudent) {
            // 기존 학생이 있으면 자동 연동 확인
            const confirmMsg = `✅ 동일한 학생이 이미 등록되어 있습니다!\n\n` +
                `이름: ${existingStudent.name}\n` +
                `학교: ${existingStudent.school}\n` +
                `학년: ${existingStudent.grade}\n` +
                `연락처: ${existingStudent.parentPhone}\n` +
                `상태: ${existingStudent.status === 'active' ? '재원 중' : existingStudent.status}\n\n` +
                `이 학생과 상담 기록을 연동하시겠습니까?\n(새로 생성하지 않고 기존 학생 데이터와 연결됩니다)`;

            if (!confirm(confirmMsg)) {
                return;
            }

            try {
                // 기존 학생과 연동 (새로 생성하지 않음)
                await updateConsultation.mutateAsync({
                    id: consultation.id,
                    updates: {
                        registeredStudentId: existingStudent.id,
                        status: ConsultationStatus.Registered, // 등록 완료 상태로 변경
                    }
                });

                alert(`✅ "${consultation.studentName}" 상담 기록이 기존 학생과 연동되었습니다!`);
                return;
            } catch (error) {
                console.error('학생 연동 오류:', error);
                alert('학생 연동에 실패했습니다.');
                return;
            }
        }

        // 확인 다이얼로그 (신규 학생 생성)
        if (!confirm(`"${consultation.studentName}" 학생을 원생 관리로 전환하시겠습니까?\n\n전환 후 학생 관리 탭에서 수업 배정 및 추가 정보를 입력하실 수 있습니다.`)) {
            return;
        }

        try {
            // 1. 학생 데이터 생성
            const newStudentData: Omit<UnifiedStudent, 'id' | 'createdAt' | 'updatedAt'> = {
                // 기본 정보
                name: consultation.studentName,
                englishName: consultation.englishName || undefined,
                gender: consultation.gender,
                school: consultation.schoolName,
                grade: consultation.grade, // SchoolGrade enum → string으로 자동 변환
                graduationYear: consultation.graduationYear || undefined,

                // 연락처
                studentPhone: consultation.studentPhone || undefined,
                homePhone: consultation.homePhone || undefined,
                parentPhone: consultation.parentPhone,
                parentName: consultation.parentName || undefined,
                parentRelation: consultation.parentRelation || undefined,

                // 주소
                zipCode: consultation.zipCode || undefined,
                address: consultation.address || undefined,
                addressDetail: consultation.addressDetail || undefined,

                // 추가 정보
                birthDate: consultation.birthDate || undefined,
                nickname: consultation.nickname || undefined,
                enrollmentReason: consultation.enrollmentReason || undefined,

                // 상태 및 날짜
                status: 'active',
                startDate: consultation.consultationDate, // 상담일을 입학일로 사용

                // 수강 정보 - 상담 과목으로 기본 enrollment 생성
                enrollments: [{
                    subject: (consultation.subject === ConsultationSubject.English || consultation.subject === ConsultationSubject.EiE || (consultation.subject as string) === 'English') ? 'english' :
                             (consultation.subject === ConsultationSubject.Math || (consultation.subject as string) === 'Math') ? 'math' :
                             (consultation.subject === ConsultationSubject.Korean || (consultation.subject as string) === 'Korean') ? 'korean' : 'other',
                    classId: '', // 수업 ID는 나중에 배정
                    className: `미배정 (${consultation.subject})`, // 임시 수업명
                    staffId: '', // 강사는 나중에 배정
                    teacher: '', // 호환성
                    days: [], // 요일은 나중에 배정
                    enrollmentDate: consultation.consultationDate,
                }],
            };

            // 2. 학생 생성
            const studentId = await addStudent(newStudentData);

            // 2-1. 레벨테스트 자동 생성 (있는 경우)
            const levelTestPromises: Promise<any>[] = [];

            // 수학 레벨테스트 생성
            if (consultation.mathConsultation?.levelTestScore) {
                const score = parseLevelTestScore(consultation.mathConsultation.levelTestScore);
                if (score !== null) {
                    const maxScore = 100; // 기본 만점
                    const percentage = (score / maxScore) * 100;
                    const recommendedLevel = determineLevel('math', percentage);

                    const mathLevelTest: Omit<LevelTest, 'id'> = {
                        studentId,
                        studentName: consultation.studentName,
                        testDate: consultation.consultationDate,
                        subject: 'math',
                        testType: 'placement', // 배치 테스트
                        score,
                        maxScore,
                        percentage,
                        recommendedLevel,
                        recommendedClass: consultation.mathConsultation.recommendedClass,
                        evaluatorId: userProfile?.uid || '',
                        evaluatorName: userProfile?.name || consultation.counselor || '상담자',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };

                    levelTestPromises.push(addLevelTest.mutateAsync(mathLevelTest));
                }
            }

            // 영어 레벨테스트 생성
            if (consultation.englishConsultation?.levelTestScore) {
                const score = parseLevelTestScore(consultation.englishConsultation.levelTestScore);
                if (score !== null) {
                    const maxScore = 100;
                    const percentage = (score / maxScore) * 100;
                    const recommendedLevel = determineLevel('english', percentage);

                    const englishLevelTest: Omit<LevelTest, 'id'> = {
                        studentId,
                        studentName: consultation.studentName,
                        testDate: consultation.consultationDate,
                        subject: 'english',
                        testType: 'placement',
                        score,
                        maxScore,
                        percentage,
                        recommendedLevel,
                        recommendedClass: consultation.englishConsultation.recommendedClass,
                        evaluatorId: userProfile?.uid || '',
                        evaluatorName: userProfile?.name || consultation.counselor || '상담자',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };

                    levelTestPromises.push(addLevelTest.mutateAsync(englishLevelTest));
                }
            }

            // 레벨테스트 저장 (비동기 병렬 처리)
            if (levelTestPromises.length > 0) {
                try {
                    await Promise.all(levelTestPromises);
                } catch (error) {
                    console.error('레벨테스트 저장 오류:', error);
                    // 레벨테스트 저장 실패해도 학생 전환은 계속 진행
                }
            }

            // 3. 상담 기록 업데이트
            await updateConsultation.mutateAsync({
                id: consultation.id,
                updates: {
                    registeredStudentId: studentId,
                    status: ConsultationStatus.Registered, // 등록 완료 상태로 변경
                }
            });

            // 성공 메시지 생성
            let successMsg = `✅ "${consultation.studentName}" 학생이 원생으로 전환되었습니다!\n\n[자동 등록됨]\n과목: ${consultation.subject}\n수업: 미배정 (나중에 배정 필요)`;

            // 레벨테스트 자동 생성 안내
            if (levelTestPromises.length > 0) {
                const subjects: string[] = [];
                if (consultation.mathConsultation?.levelTestScore) subjects.push('수학');
                if (consultation.englishConsultation?.levelTestScore) subjects.push('영어');
                successMsg += `\n\n[레벨테스트 자동 생성]\n과목: ${subjects.join(', ')}\n→ 성적 탭에서 확인 가능`;
            }

            successMsg += `\n\n학생 관리 탭에서 수업을 배정해주세요.`;

            alert(successMsg);
        } catch (error) {
            console.error('원생 전환 오류:', error);
            alert('❌ 원생 전환에 실패했습니다.\n\n' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        }
    }, [existingStudents, addStudent, updateConsultation, addLevelTest, userProfile]);

    const openAddModal = () => {
        setEditingRecord(null);
        setIsFormOpen(true);
    };

    const openEditModal = (record: ConsultationRecord) => {
        setEditingRecord(record);
        setIsFormOpen(true);
    };


    // Month navigation - arrows only navigate months (skip 'all')
    const handlePrevMonth = () => {
        if (selectedYear === 'all') return; // 연도 전체일 때는 화살표 비활성화

        if (selectedMonth === 'all') {
            // 전체에서 왼쪽: 작년 12월로
            const currentYear = parseInt(selectedYear, 10);
            setSelectedYear(String(currentYear - 1));
            setSelectedMonth('12');
        } else {
            const currentMonth = parseInt(selectedMonth, 10);
            if (currentMonth === 1) {
                // 1월에서 왼쪽: 작년 12월
                const currentYear = parseInt(selectedYear, 10);
                setSelectedYear(String(currentYear - 1));
                setSelectedMonth('12');
            } else {
                setSelectedMonth(String(currentMonth - 1));
            }
        }
    };

    const handleNextMonth = () => {
        if (selectedYear === 'all') return; // 연도 전체일 때는 화살표 비활성화

        if (selectedMonth === 'all') {
            // 전체에서 오른쪽: 내년 1월로
            const currentYear = parseInt(selectedYear, 10);
            setSelectedYear(String(currentYear + 1));
            setSelectedMonth('1');
        } else {
            const currentMonth = parseInt(selectedMonth, 10);
            if (currentMonth === 12) {
                // 12월에서 오른쪽: 내년 1월
                const currentYear = parseInt(selectedYear, 10);
                setSelectedYear(String(currentYear + 1));
                setSelectedMonth('1');
            } else {
                setSelectedMonth(String(currentMonth + 1));
            }
        }
    };

    const getMonthDisplay = (m: string) => {
        if (m === 'all') return '전체';
        return `${m}월`;
    };

    // Loading state
    if (isLoading) {
        return <VideoLoading className="flex-1 h-full" />;
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">
            {/* Desktop Header - Dark Theme to match Main Calendar */}
            <TabSubNavigation
                variant="compact"
                showBorder={false}
                className="hidden md:flex justify-between border-b border-white/10 px-6 relative"
            >
                <div className="flex items-center gap-4">
                    {/* Consistent Title Style (Optional, or remove) */}
                    {/* <h2 className="text-sm font-bold text-white tracking-wide">상담 관리</h2>
                    <div className="h-4 w-px bg-white/10"></div> */}

                    {/* View Switcher Tabs */}
                    <div className="flex bg-white/10 p-0.5 rounded-sm border border-white/10">
                        <TabButton
                            active={view === 'dashboard'}
                            onClick={() => setView('dashboard')}
                            icon={<LayoutDashboard size={12} />}
                        >
                            대시보드
                        </TabButton>
                        <TabButton
                            active={view === 'table'}
                            onClick={() => setView('table')}
                            icon={<List size={12} />}
                        >
                            상담목록
                        </TabButton>
                        <TabButton
                            active={view === 'yearly'}
                            onClick={() => setView('yearly')}
                            icon={<Calendar size={12} />}
                        >
                            연간뷰
                        </TabButton>
                    </div>

                    {/* Year/Month Filter - Show based on view */}
                    {(view === 'table' || view === 'dashboard') && (
                        <>
                            <div className="h-4 w-px bg-white/20"></div>
                            <div className="flex items-center gap-2">
                                {/* Year Select */}
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="px-2 py-0.5 rounded bg-[#1e293b] border border-gray-600 text-white text-xs font-bold focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                    style={{ color: 'white' }}
                                >
                                    <option value="all" style={{ backgroundColor: 'white', color: 'black' }}>전체 연도</option>
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                        <option key={year} value={year} style={{ backgroundColor: 'white', color: 'black' }}>{year}년</option>
                                    ))}
                                </select>

                                {/* Month Select & Navigation */}
                                <div className="flex items-center bg-[#1e293b] rounded border border-gray-600 p-0">
                                    <button
                                        onClick={handlePrevMonth}
                                        disabled={selectedYear === 'all'}
                                        className="p-0.5 text-gray-400 hover:text-[#fdb813] disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        disabled={selectedYear === 'all'}
                                        className="bg-transparent text-white text-xs font-bold px-2 py-1 outline-none text-center min-w-[60px] cursor-pointer disabled:opacity-50"
                                        style={{ color: 'white' }}
                                    >
                                        <option value="all" style={{ backgroundColor: 'white', color: 'black' }}>전체</option>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={String(m)} style={{ backgroundColor: 'white', color: 'black' }}>{m}월</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleNextMonth}
                                        disabled={selectedYear === 'all'}
                                        className="p-1 text-gray-400 hover:text-[#fdb813] disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Search & Settings - Only for Table View */}
                    {view === 'table' && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                    <Search className="h-3.5 w-3.5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    className="block w-56 pl-8 pr-2.5 py-1.5 rounded-sm text-xs leading-5 placeholder-gray-500 bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] transition-all"
                                    placeholder="학생명, 번호, 담당자 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-1.5 rounded-sm border transition-all"
                                style={{
                                    backgroundColor: showSettings ? 'rgba(253,184,19,0.2)' : 'rgba(255,255,255,0.1)',
                                    borderColor: showSettings ? '#fdb813' : 'rgba(255,255,255,0.2)',
                                    color: showSettings ? '#fdb813' : 'rgba(255,255,255,0.6)'
                                }}
                                title="보기 설정"
                            >
                                <Settings2 size={14} />
                            </button>
                        </>
                    )}

                    {/* View Column Toggle - Only for Yearly View */}
                    {view === 'yearly' && (
                        <div className="flex bg-black/20 p-0.5 rounded-sm border border-white/5">
                            {([1, 2] as const).map((cols) => (
                                <TabButton
                                    key={cols}
                                    active={viewColumns === cols}
                                    onClick={() => setViewColumns(cols)}
                                >
                                    {cols}단
                                </TabButton>
                            ))}
                        </div>
                    )}

                    {/* DB 불러오기: 전환 또는 관리 권한 필요 */}
                    {(canConvert || canManage) && (
                        <button
                            onClick={() => setShowMigrationModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-sm shadow-lg hover:shadow-green-500/30 transition-all text-xs font-bold"
                        >
                            <Upload size={16} />
                            DB 불러오기
                        </button>
                    )}

                    {/* 상담 등록: 생성 권한 필요 */}
                    {canCreate && (
                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-sm shadow-lg hover:shadow-blue-500/30 transition-all text-xs font-bold"
                        >
                            <Plus size={16} />
                            상담 등록
                        </button>
                    )}
                </div>
            </TabSubNavigation>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-20 bg-slate-50 pt-2 pb-2 px-4">
                <div className="bg-white rounded-sm shadow-sm border border-slate-200 flex items-center justify-between px-2 py-3">
                    <button
                        onClick={handlePrevMonth}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-3">
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedYear(val);
                                if (val === 'all') {
                                    setSelectedMonth('all');
                                }
                            }}
                            className="appearance-none bg-transparent text-slate-800 font-bold text-base cursor-pointer outline-none pr-4"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}
                        >
                            <option value="all">전체</option>
                            {[2024, 2025, 2026, 2027, 2028].map(y => (
                                <option key={y} value={String(y)}>{y}년</option>
                            ))}
                        </select>

                        <div className="w-px h-4 bg-slate-200"></div>

                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={selectedYear === 'all'}
                            className={`appearance-none bg-transparent text-slate-800 font-bold text-base cursor-pointer outline-none pr-4 ${selectedYear === 'all' ? 'opacity-50' : ''}`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}
                        >
                            <option value="all">전체</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                <option key={m} value={String(m)}>{m}월</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleNextMonth}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-auto p-4 md:p-6" style={{ backgroundColor: '#f8fafc' }}>
                    {view === 'dashboard' && (
                        <ConsultationDashboard
                            data={consultations}
                            month={selectedMonth}
                            year={selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear, 10)}
                        />
                    )}

                    {view === 'table' && (
                        <ConsultationTable
                            data={consultations}
                            onEdit={openEditModal}
                            onDelete={handleDeleteRecord}
                            onConvertToStudent={handleConvertToStudent}
                            currentUserId={userProfile?.uid}
                            canEdit={canEdit}
                            canManage={canManage}
                            canConvert={canConvert}
                            searchTerm={searchTerm}
                            showSettings={showSettings}
                            onShowSettingsChange={setShowSettings}
                        />
                    )}

                    {view === 'yearly' && (
                        <div className="flex flex-col md:flex-row gap-4 h-full">
                            {/* Current Year View */}
                            <div className="flex-1 flex flex-col h-full bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
                                <ConsultationYearView
                                    data={consultations}
                                    currentYear={selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear, 10)}
                                    onYearChange={(y) => setSelectedYear(String(y))}
                                />
                            </div>

                            {/* Previous Year Comparison View (2 Columns) */}
                            {viewColumns === 2 && (
                                <div className="flex-1 flex flex-col h-full bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-right duration-300">
                                    <ConsultationYearView
                                        data={consultations}
                                        currentYear={(selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear, 10)) - 1} // 1년 전
                                        onYearChange={(y) => {/* Comparison view logic if needed */ }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Mobile Floating Action Button - 생성 권한 필요 */}
            {canCreate && (
                <button
                    onClick={openAddModal}
                    className="md:hidden fixed bottom-24 right-5 bg-indigo-600 text-white p-4 rounded-sm shadow-lg shadow-indigo-400/50 z-40 hover:scale-105 active:scale-95 transition-all"
                >
                    <Plus size={28} strokeWidth={2.5} />
                </button>
            )}

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-20 pb-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setView('dashboard')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}
                >
                    <LayoutDashboard size={24} strokeWidth={view === 'dashboard' ? 2.5 : 2} />
                    <span className="text-xxs font-medium">대시보드</span>
                </button>
                <button
                    onClick={() => setView('table')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'table' ? 'text-indigo-600' : 'text-slate-400'}`}
                >
                    <List size={24} strokeWidth={view === 'table' ? 2.5 : 2} />
                    <span className="text-xxs font-medium">상담목록</span>
                </button>
            </div>

            {/* Modal */}
            <ConsultationForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={editingRecord ? handleUpdateRecord : handleAddRecord}
                initialData={editingRecord}
                onDelete={handleDeleteRecord}
                onConvertToStudent={handleConvertToStudent}
                canDelete={canManage || (canEdit && editingRecord?.authorId === userProfile?.uid)}
                canConvert={canConvert}
            />

            {/* Migration Modal */}
            {showMigrationModal && (
                <Suspense fallback={<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>}>
                    <RegistrationMigrationModal
                        onClose={() => setShowMigrationModal(false)}
                        onSuccess={() => {
                            setShowMigrationModal(false);
                            // 마이그레이션 성공 시 데이터 새로고침은 react-query가 자동으로 처리
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default ConsultationManager;
