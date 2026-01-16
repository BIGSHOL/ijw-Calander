import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, Loader, PlayCircle, RefreshCw } from 'lucide-react';
import {
  migratePhase1_ExtendStaffSchema,
  migratePhase2_MergeUserData,
  migratePhase3_Verify,
  runFullMigration
} from '../../scripts/migrateUsersToStaff';

interface MigrationModalProps {
  onClose: () => void;
}

type MigrationStatus = 'idle' | 'running' | 'success' | 'error';

const UserStaffMigrationModal: React.FC<MigrationModalProps> = ({ onClose }) => {
  const [phase1Status, setPhase1Status] = useState<MigrationStatus>('idle');
  const [phase2Status, setPhase2Status] = useState<MigrationStatus>('idle');
  const [phase3Status, setPhase3Status] = useState<MigrationStatus>('idle');
  const [phase2Report, setPhase2Report] = useState<any>(null);
  const [phase3Report, setPhase3Report] = useState<any>(null);
  const [isRunningFull, setIsRunningFull] = useState(false);

  const runPhase1 = async () => {
    setPhase1Status('running');
    try {
      await migratePhase1_ExtendStaffSchema();
      setPhase1Status('success');
    } catch (error) {
      console.error(error);
      setPhase1Status('error');
    }
  };

  const runPhase2 = async () => {
    setPhase2Status('running');
    try {
      const report = await migratePhase2_MergeUserData();
      setPhase2Report(report);
      setPhase2Status('success');
    } catch (error) {
      console.error(error);
      setPhase2Status('error');
    }
  };

  const runPhase3 = async () => {
    setPhase3Status('running');
    try {
      const report = await migratePhase3_Verify();
      setPhase3Report(report);
      setPhase3Status('success');
    } catch (error) {
      console.error(error);
      setPhase3Status('error');
    }
  };

  const runAll = async () => {
    setIsRunningFull(true);
    setPhase1Status('idle');
    setPhase2Status('idle');
    setPhase3Status('idle');
    setPhase2Report(null);
    setPhase3Report(null);

    try {
      // Phase 1
      setPhase1Status('running');
      await migratePhase1_ExtendStaffSchema();
      setPhase1Status('success');

      // Phase 2
      setPhase2Status('running');
      const report2 = await migratePhase2_MergeUserData();
      setPhase2Report(report2);
      setPhase2Status('success');

      // Phase 3
      setPhase3Status('running');
      const report3 = await migratePhase3_Verify();
      setPhase3Report(report3);
      setPhase3Status('success');

      alert('✅ 마이그레이션이 성공적으로 완료되었습니다!');
    } catch (error) {
      console.error(error);
      alert('❌ 마이그레이션 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    } finally {
      setIsRunningFull(false);
    }
  };

  const getStatusIcon = (status: MigrationStatus) => {
    switch (status) {
      case 'idle':
        return null;
      case 'running':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: MigrationStatus) => {
    switch (status) {
      case 'idle':
        return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">대기</span>;
      case 'running':
        return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">실행중...</span>;
      case 'success':
        return <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded">완료</span>;
      case 'error':
        return <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded">실패</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-[#081429]">
          <div>
            <h2 className="text-xl font-bold text-white">사용자 → 직원 통합 마이그레이션</h2>
            <p className="text-sm text-gray-300 mt-1">Users 컬렉션 데이터를 Staff 컬렉션으로 통합</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-amber-900 text-sm mb-1">주의사항</h4>
              <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                <li>마이그레이션 실행 전 데이터 백업을 권장합니다.</li>
                <li>Phase 1은 안전하며 기존 데이터에 영향을 주지 않습니다.</li>
                <li>Phase 2는 데이터를 수정/생성하므로 신중히 실행하세요.</li>
                <li>단계별 실행 또는 전체 실행을 선택할 수 있습니다.</li>
              </ul>
            </div>
          </div>

          {/* Phase 1 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(phase1Status)}
                <div>
                  <h3 className="font-bold text-[#081429]">Phase 1: 스키마 확장</h3>
                  <p className="text-xs text-gray-500">staff 컬렉션에 새 필드 추가 (안전)</p>
                </div>
              </div>
              {getStatusBadge(phase1Status)}
            </div>
            <button
              onClick={runPhase1}
              disabled={phase1Status === 'running' || isRunningFull}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              Phase 1 실행
            </button>
          </div>

          {/* Phase 2 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(phase2Status)}
                <div>
                  <h3 className="font-bold text-[#081429]">Phase 2: 데이터 병합</h3>
                  <p className="text-xs text-gray-500">users 데이터를 staff로 병합 (수정 발생)</p>
                </div>
              </div>
              {getStatusBadge(phase2Status)}
            </div>
            <button
              onClick={runPhase2}
              disabled={phase2Status === 'running' || isRunningFull}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              Phase 2 실행
            </button>

            {phase2Report && (
              <div className="mt-3 bg-gray-50 rounded p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">총 사용자:</span>
                  <span className="font-medium">{phase2Report.totalUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">기존 직원:</span>
                  <span className="font-medium">{phase2Report.totalStaff}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">매칭됨:</span>
                  <span className="font-medium text-blue-600">{phase2Report.matched}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">신규 생성:</span>
                  <span className="font-medium text-green-600">{phase2Report.staffCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">업데이트:</span>
                  <span className="font-medium text-orange-600">{phase2Report.staffUpdated}</span>
                </div>
                {phase2Report.errors.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">오류:</span>
                    <span className="font-medium text-red-600">{phase2Report.errors.length}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phase 3 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(phase3Status)}
                <div>
                  <h3 className="font-bold text-[#081429]">Phase 3: 검증</h3>
                  <p className="text-xs text-gray-500">마이그레이션 결과 검증</p>
                </div>
              </div>
              {getStatusBadge(phase3Status)}
            </div>
            <button
              onClick={runPhase3}
              disabled={phase3Status === 'running' || isRunningFull}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              Phase 3 실행
            </button>

            {phase3Report && (
              <div className="mt-3 bg-gray-50 rounded p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">총 사용자:</span>
                  <span className="font-medium">{phase3Report.totalUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">총 직원:</span>
                  <span className="font-medium">{phase3Report.totalStaff}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">연동됨:</span>
                  <span className="font-medium text-green-600">{phase3Report.matched}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">미연동:</span>
                  <span className="font-medium text-orange-600">{phase3Report.totalUsers - phase3Report.matched}</span>
                </div>
                {phase3Report.errors.length > 0 && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    <div className="text-red-600 font-medium mb-1">오류 목록:</div>
                    <div className="space-y-0.5">
                      {phase3Report.errors.map((err: string, idx: number) => (
                        <div key={idx} className="text-red-500">• {err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            닫기
          </button>
          <button
            onClick={runAll}
            disabled={isRunningFull}
            className="flex items-center gap-2 px-6 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#0a1a35] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {isRunningFull ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>실행 중...</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>전체 실행 (Phase 1+2+3)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserStaffMigrationModal;
