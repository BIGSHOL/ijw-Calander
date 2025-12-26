// Style Utility Functions

// Embedded Injaewon Logo Path
export const INJAEWON_LOGO = "/logo.png";

// Job Title Style Mapping
export const getJobTitleStyle = (title: string = '') => {
    if (title.includes('원장') || title.includes('대표')) return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (title.includes('이사')) return 'bg-purple-100 text-purple-700 border border-purple-200';
    if (title.includes('부장')) return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
    if (title.includes('실장') || title.includes('팀장')) return 'bg-blue-100 text-blue-700 border border-blue-200';
    if (title.includes('대리')) return 'bg-green-100 text-green-700 border border-green-200';
    if (title.includes('강사')) return 'bg-pink-100 text-pink-700 border border-pink-200';
    return 'bg-gray-100 text-gray-600 border border-gray-200';
};
