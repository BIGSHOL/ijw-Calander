import { Department } from './types';

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: '학교일정', name: '학교일정', order: 1, color: 'bg-red-50' },
  { id: 'EiE', name: 'EiE', order: 2, color: 'bg-orange-50' },
  { id: '인재원영어', name: '인재원영어', order: 3, color: 'bg-yellow-50' },
  { id: '인재원수학', name: '인재원수학', order: 4, color: 'bg-green-50' },
  { id: '수학교재', name: '수학교재', order: 5, color: 'bg-emerald-50' },
  { id: '인재원과학/국어', name: '인재원과학/국어', order: 6, color: 'bg-cyan-50' },
  { id: '고등수학관', name: '고등수학관', order: 7, color: 'bg-sky-50' },
  { id: '행사일정', name: '행사일정', order: 8, color: 'bg-violet-50' },
  { id: '마케팅일정', name: '마케팅일정', order: 9, color: 'bg-fuchsia-50' },
  { id: '기타일정', name: '기타일정', order: 10, color: 'bg-gray-50' },
];

export const EVENT_COLORS = [
  { label: '빨강', value: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  { label: '주황', value: '#ffedd5', border: '#f97316', text: '#9a3412' },
  { label: '노랑', value: '#fef9c3', border: '#eab308', text: '#854d0e' },
  { label: '초록', value: '#dcfce7', border: '#22c55e', text: '#166534' },
  { label: '파랑', value: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  { label: '보라', value: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  { label: '분홍', value: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  { label: '회색', value: '#f3f4f6', border: '#9ca3af', text: '#374151' },
];