import React, { useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useContracts } from '../../hooks/useContracts';
import { Search, Plus, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ContractsTabProps {
  currentUser?: UserProfile | null;
}

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  draft: { label: '작성 중', style: 'bg-gray-100 text-gray-600' },
  signed: { label: '서명 완료', style: 'bg-blue-100 text-blue-700' },
  active: { label: '진행 중', style: 'bg-green-100 text-green-700' },
  expired: { label: '만료', style: 'bg-yellow-100 text-yellow-700' },
  terminated: { label: '해지', style: 'bg-red-100 text-red-700' },
};

export default function ContractsTab({ currentUser }: ContractsTabProps) {
  const { contracts, isLoading, createContract, updateContract } = useContracts();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    if (!contracts) return [];
    return contracts.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return c.studentName.toLowerCase().includes(q) || c.parentName.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [contracts, statusFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">계약 관리</h1>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700">
          <Plus size={14} /> 계약 작성
        </button>
      </div>

      <div className="bg-white border-b px-4 py-2 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="학생명, 학부모명 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'signed', 'draft', 'expired', 'terminated'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs rounded ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'all' ? '전체' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-400 text-sm py-8">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-8"><FileText size={32} className="mx-auto mb-2" /><p className="text-sm">계약 내역이 없습니다</p></div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xxs px-1.5 py-0.5 rounded ${STATUS_CONFIG[c.status]?.style}`}>{STATUS_CONFIG[c.status]?.label}</span>
                      <span className="text-xxs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {c.type === 'enrollment' ? '신규 등록' : c.type === 'renewal' ? '재등록' : '특별'}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">{c.studentName}</h3>
                    <div className="text-xxs text-gray-500 mt-1">
                      학부모: {c.parentName} | 기간: {c.startDate} ~ {c.endDate}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{c.monthlyFee.toLocaleString()}원/월</div>
                    <div className="text-xxs text-gray-400">총 {c.totalAmount.toLocaleString()}원</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
