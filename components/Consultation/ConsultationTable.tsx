import React, { useState, useMemo } from 'react';
import { ConsultationRecord, CONSULTATION_STATUS_COLORS } from '../../types';
import { Search, Edit2, Trash2, ChevronLeft, ChevronRight, User, Banknote, Phone, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ConsultationTableProps {
    data: ConsultationRecord[];
    onEdit: (record: ConsultationRecord) => void;
    onDelete: (id: string) => void;
}

export const ConsultationTable: React.FC<ConsultationTableProps> = ({ data, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredData = useMemo(() => {
        return data.filter(r =>
            r.studentName.includes(searchTerm) ||
            r.parentPhone.includes(searchTerm) ||
            r.schoolName.includes(searchTerm) ||
            r.counselor.includes(searchTerm) ||
            r.registrar.includes(searchTerm)
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Search Bar - Responsive */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="hidden sm:flex text-lg font-bold text-slate-800 items-center">
                    <span className="w-2 h-6 bg-indigo-500 rounded-sm mr-2"></span>
                    상담 기록 목록
                    <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{filteredData.length}</span>
                </h3>

                <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:placeholder-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                        placeholder="학생명, 번호, 담당자 검색..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">학생 정보</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상담 과목/학교</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">등록/상담자</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상담일/경로</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">결제/후속</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {currentData.length > 0 ? (
                                currentData.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-900">{record.studentName}</span>
                                                <span className="text-xs text-slate-500">{record.parentPhone}</span>
                                                <span className="text-xs text-slate-400 mt-0.5">{record.grade}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-semibold text-slate-700">{record.subject}</div>
                                            <div className="text-xs text-slate-500">{record.schoolName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center text-xs text-slate-600">
                                                    <span className="w-10 text-slate-400">상담:</span> {record.counselor || '-'}
                                                </div>
                                                <div className="flex items-center text-xs text-slate-600">
                                                    <span className="w-10 text-slate-400">등록:</span> {record.registrar || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-slate-900">
                                                {format(new Date(record.consultationDate), 'yy.MM.dd(eee)', { locale: ko })}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {record.consultationPath || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
                                                {record.status}
                                            </span>
                                            {record.nonRegistrationReason && (
                                                <div className="text-[10px] text-red-500 mt-1 truncate max-w-[100px]">{record.nonRegistrationReason}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {record.paymentAmount ? (
                                                <div className="flex items-center text-sm text-slate-700">
                                                    <Banknote className="w-3 h-3 mr-1 text-emerald-500" />
                                                    {record.paymentAmount}
                                                </div>
                                            ) : record.followUpDate ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-amber-600">후속: {format(new Date(record.followUpDate), 'yy.MM.dd', { locale: ko })}</span>
                                                    <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{record.followUpContent}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => onEdit(record)}
                                                    className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded-md transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('정말로 삭제하시겠습니까?')) onDelete(record.id);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-md transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        검색 결과가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {currentData.length > 0 ? (
                    currentData.map((record) => (
                        <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg font-bold text-slate-900">{record.studentName}</span>
                                        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{record.grade}</span>
                                    </div>
                                    <span className="text-sm text-slate-500">{record.schoolName}</span>
                                </div>
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
                                    {record.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">과목</span>
                                    <span className="font-medium">{record.subject}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">날짜</span>
                                    <span className="font-medium">{format(new Date(record.consultationDate), 'yy.MM.dd', { locale: ko })}</span>
                                </div>
                                <div className="flex items-center gap-2 col-span-2">
                                    <span className="text-xs text-slate-400">연락처</span>
                                    <span className="font-medium">{record.parentPhone}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="flex items-center text-slate-500">
                                        <User size={12} className="mr-1" /> {record.counselor}
                                    </div>
                                    {record.paymentAmount && (
                                        <div className="flex items-center text-emerald-600 font-medium">
                                            <Banknote size={12} className="mr-1" /> {record.paymentAmount}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onEdit(record)}
                                        className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (window.confirm('삭제하시겠습니까?')) onDelete(record.id);
                                        }}
                                        className="p-2 text-red-500 bg-red-50 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white p-8 rounded-xl text-center text-slate-400">
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-700 hidden sm:block">
                    총 <span className="font-medium">{filteredData.length}</span>개 중 <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span>
                </p>

                <nav className="flex justify-between w-full sm:w-auto gap-2" aria-label="Pagination">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex-1 sm:flex-none relative inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> 이전
                    </button>
                    <span className="sm:hidden flex items-center text-sm font-medium text-slate-700">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="flex-1 sm:flex-none relative inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        다음 <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                </nav>
            </div>
        </div>
    );
};
