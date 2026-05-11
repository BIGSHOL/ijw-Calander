import React from 'react';

interface ClassesTabProps {
    isMaster: boolean;
    canEdit?: boolean;
}

// [DEPRECATED] 수업 키워드 기반 색상 시스템 폐기됨 (수업 1:1 색상으로 대체)
// 이 탭은 더 이상 사용되지 않으며, 수업별 색상은 수업 정보 편집 모달에서 직접 설정합니다.
const ClassesTab: React.FC<ClassesTabProps> = () => {
    return (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-700">
                수업별 색상은 각 수업의 정보 편집 화면에서 직접 설정할 수 있습니다.
            </p>
        </div>
    );
};

export default ClassesTab;
