import React from 'react';
import { Student } from '../types';
import { X, UserPlus, UserMinus } from 'lucide-react';
import { formatSchoolGrade } from '../../../utils/studentUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  students: Student[];
  type: 'new' | 'dropped';
}

const StudentListModal: React.FC<Props> = ({ isOpen, onClose, title, students, type }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-center p-4 border-b ${type === 'new' ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${type === 'new' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
              {type === 'new' ? <UserPlus size={18} /> : <UserMinus size={18} />}
            </div>
            <h3 className={`font-bold text-lg ${type === 'new' ? 'text-yellow-900' : 'text-red-900'}`}>{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/50 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {students.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">해당 기간에 기록된 학생이 없습니다.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {students.map(student => (
                <li key={student.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:border-gray-200 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-800">{student.name}</p>
                      {student.isHomeroom && <span className="text-xxs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">담임</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatSchoolGrade(student.school, student.grade)} <span className="text-gray-300">|</span> {student.group || '그룹 미지정'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xxs text-gray-400 mb-0.5">{type === 'new' ? '등록일' : '퇴원일'}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${type === 'new' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {type === 'new' ? student.startDate : student.endDate}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">총 {students.length}명</p>
        </div>
      </div>
    </div>
  );
};

export default StudentListModal;