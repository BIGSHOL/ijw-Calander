import React, { useState, KeyboardEvent } from 'react';

interface AddStudentFormProps {
    onAdd: (student: { name: string; englishName: string; school: string; grade: string }) => void;
}

const AddStudentForm: React.FC<AddStudentFormProps> = ({ onAdd }) => {
    const [name, setName] = useState('');
    const [englishName, setEnglishName] = useState('');
    const [school, setSchool] = useState('');
    const [grade, setGrade] = useState('');

    const handleSubmit = () => {
        if (!name.trim()) return;
        onAdd({ name, englishName, school, grade });
        // Reset form
        setName('');
        setEnglishName('');
        setSchool('');
        setGrade('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
            <div className="flex items-end gap-2">
                <div className="flex-1 grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                        <label className="text-[10px] text-gray-500 font-bold mb-1 block">이름</label>
                        <input
                            type="text"
                            placeholder="이름"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="text-[10px] text-gray-500 font-bold mb-1 block">E.Name</label>
                        <input
                            type="text"
                            placeholder="영어이름"
                            value={englishName}
                            onChange={(e) => setEnglishName(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="text-[10px] text-gray-500 font-bold mb-1 block">학교</label>
                        <input
                            type="text"
                            placeholder="학교"
                            value={school}
                            onChange={(e) => setSchool(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="text-[10px] text-gray-500 font-bold mb-1 block">학년</label>
                        <input
                            type="text"
                            placeholder="학년"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={!name.trim()}
                    className="px-3 py-1.5 bg-[#fdb813] text-[#081429] rounded font-bold text-xs hover:bg-[#e5a712] disabled:opacity-50 h-[34px] self-end"
                >
                    추가
                </button>
            </div>
        </div>
    );
};

export default AddStudentForm;
