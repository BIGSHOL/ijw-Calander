import React from 'react';
import { Trash2, Check, X, Plus } from 'lucide-react';

export interface MergedClass {
    className: string;
    room: string;
}

export interface InputData {
    className: string;
    room: string;
    merged: MergedClass[];
    note?: string; // note is present in existing data, keeping it for compatibility or future use
}

interface BatchInputBarProps {
    selectedCells: Set<string>;
    inputData: InputData;
    setInputData: React.Dispatch<React.SetStateAction<InputData>>;
    isWarningOff: boolean;
    setIsWarningOff: (val: boolean) => void;
    addMerged: () => void;
    updateMerged: (index: number, field: keyof MergedClass, value: string) => void;
    removeMerged: (index: number) => void;
    handleBatchSave: () => void;
    handleBatchDelete: () => void;
}

const BatchInputBar: React.FC<BatchInputBarProps> = ({
    selectedCells,
    inputData,
    setInputData,
    isWarningOff,
    setIsWarningOff,
    addMerged,
    updateMerged,
    removeMerged,
    handleBatchSave,
    handleBatchDelete,
}) => {
    return (
        <div className="flex-none bg-white border-t border-[#081429] shadow-[0_-5px_20px_rgba(0,0,0,0.15)] px-6 py-3 z-[50] animate-in slide-in-from-bottom duration-200 flex flex-col gap-2">

            {/* Top Status + Actions */}
            <div className="flex items-center justify-between pb-1 border-b border-gray-100 mb-1">
                {/* Selected Count */}
                <div className="flex items-center gap-3">
                    <span className="bg-[#081429] text-white px-3 py-0.5 rounded-full text-xs font-bold">
                        {selectedCells.size}개 선택됨
                    </span>
                    <span className="text-[10px] text-gray-400">Ctrl/Cmd+Click for Multi-select</span>
                </div>

                {/* Right Buttons */}
                <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-1 cursor-pointer mr-3 select-none">
                        <input
                            type="checkbox"
                            checked={isWarningOff}
                            onChange={(e) => setIsWarningOff(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-[#081429] focus:ring-[#081429]"
                        />
                        <span className="text-xs text-gray-500 font-bold">경고 끄기</span>
                    </label>

                    <button
                        onClick={handleBatchDelete}
                        className="flex items-center gap-1 px-4 py-1.5 rounded bg-white border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
                    >
                        <Trash2 size={12} />
                        삭제
                    </button>

                    <button
                        onClick={handleBatchSave}
                        className="flex items-center gap-1 px-6 py-1.5 rounded bg-[#081429] text-white text-xs font-bold hover:bg-[#081429]/90 shadow-md transition-colors"
                    >
                        <Check size={12} />
                        저장
                    </button>
                </div>
            </div>

            {/* Main Input Area */}
            <div className="flex gap-3 items-stretch h-[72px]">

                {/* Main Class Input */}
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 flex gap-2 items-center shadow-sm w-[350px] shrink-0">
                    <div className="flex-1">
                        <div className="text-[10px] text-gray-400 mb-1 ml-1 font-bold">
                            메인 수업
                        </div>
                        <input
                            value={inputData.className}
                            onChange={(e) =>
                                setInputData({ ...inputData, className: e.target.value })
                            }
                            placeholder="수업명"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm h-8 focus:outline-none focus:border-[#fdb813]"
                        />
                    </div>

                    {/* Room Input */}
                    <div className="w-20">
                        <div className="text-[10px] text-gray-400 mb-1 ml-1 font-bold">
                            강의실
                        </div>
                        <input
                            value={inputData.room}
                            onChange={(e) =>
                                setInputData({ ...inputData, room: e.target.value })
                            }
                            placeholder="호실"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-center h-8 focus:outline-none focus:border-[#fdb813]"
                        />
                    </div>
                </div>

                {/* Add Merged Class Button */}
                <button
                    onClick={addMerged}
                    className="w-[60px] rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#fdb813] hover:text-[#fdb813] hover:bg-yellow-50 flex flex-col items-center justify-center gap-1 shrink-0 transition-all"
                >
                    <Plus size={20} />
                    <span className="text-[10px] font-bold">합반</span>
                </button>

                {/* Merged List */}
                {inputData.merged.length > 0 && (
                    <div className="flex-1 flex gap-2 overflow-x-auto items-center custom-scrollbar px-1 py-1">
                        {inputData.merged.map((m, idx) => (
                            <div
                                key={idx}
                                className="bg-[#fff9db] p-2 rounded-lg border border-yellow-200 shadow-sm flex flex-col gap-1 w-32 shrink-0 relative group animate-in zoom-in duration-200"
                            >
                                <div className="flex justify-between -mt-1">
                                    <span className="text-[10px] font-bold text-yellow-700">
                                        #{idx + 1}
                                    </span>
                                    <button
                                        onClick={() => removeMerged(idx)}
                                        className="text-red-400 hover:text-red-600 font-bold"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>

                                <input
                                    value={m.className}
                                    onChange={(e) => updateMerged(idx, "className", e.target.value)}
                                    placeholder="수업명"
                                    className="w-full text-xs border border-yellow-200/50 rounded px-1 py-0.5 bg-white/50 focus:bg-white focus:outline-none focus:border-[#fdb813] text-center"
                                />

                                <input
                                    value={m.room}
                                    onChange={(e) => updateMerged(idx, "room", e.target.value)}
                                    placeholder="호실"
                                    className="w-full text-xs border border-yellow-200/50 rounded px-1 py-0.5 bg-white/50 focus:bg-white focus:outline-none focus:border-[#fdb813] text-center"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BatchInputBar;
