import React from 'react';

interface GanttProgressBarProps {
    progress: number;
}

const GanttProgressBar: React.FC<GanttProgressBarProps> = ({ progress }) => {
    return (
        <div className="w-full bg-white p-6 rounded-sm shadow-sm border border-slate-200 mb-6 flex flex-col items-center justify-center">
            <div className="flex justify-between w-full mb-2">
                <span className="text-sm font-semibold text-primary-700 uppercase tracking-wider">임무 진행률</span>
                <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-4 bg-slate-100 rounded-sm overflow-hidden">
                <div
                    className="h-full bg-accent transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
            {progress === 100 && (
                <div className="mt-4 text-accent font-bold animate-bounce drop-shadow-sm" style={{ textShadow: "1px 1px 0px rgb(8, 20, 41)" /* primary */ }}>
                    🎉 임무 완료!
                </div>
            )}
        </div>
    );
};

export default GanttProgressBar;
