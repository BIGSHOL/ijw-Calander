import React, { useState, useEffect } from 'react';
import { CalendarEvent, UserProfile } from '../types';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { X, Calendar, Clock, MapPin } from 'lucide-react';

interface MyEventsModalProps {
    isOpen: boolean;
    onClose: () => void;
    events: CalendarEvent[];
    currentUser: UserProfile | null;
    onEventClick: (event: CalendarEvent) => void;
    readOnly?: boolean;
    customTitle?: string;
}

const MyEventsModal: React.FC<MyEventsModalProps> = ({
    isOpen,
    onClose,
    events,
    currentUser,
    onEventClick,
    readOnly = false,
    customTitle,
}) => {
    if (!isOpen || !currentUser) return null;

    const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        if (isOpen && currentUser) {
            // Filter events where the user is a participant
            // Logic: Check if 'participants' string contains part of email or name (Legacy) 
            // OR if 'attendance' record contains the UID (New Schema)

            const filtered = events.filter(event => {
                // 1. Check Attendance Map (Reliable)
                if (event.attendance && event.attendance[currentUser.uid]) {
                    return true;
                }

                // 2. Check Participants String (Legacy/Fallback)
                // Need a somewhat loose match because participants is just a free-form string
                const userName = currentUser.email.split('@')[0];
                const userNameInParticipants = event.participants?.includes(userName) || false;

                return userNameInParticipants;
            });

            // Sort by date: Upcoming first, then past
            const now = new Date();
            const upcoming = filtered.filter(e => isAfter(parseISO(e.endDate), now)).sort((a, b) => a.startDate.localeCompare(b.startDate));
            const past = filtered.filter(e => isBefore(parseISO(e.endDate), now)).sort((a, b) => b.startDate.localeCompare(a.startDate)); // Descending for past

            setMyEvents([...upcoming, ...past]);
        }
    }, [isOpen, events, currentUser]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-[#f8fafc]">
                    <h2 className="text-lg font-extrabold text-[#081429] flex items-center gap-2">
                        <Calendar className="text-[#fdb813]" size={24} />
                        {customTitle || '내 일정 모아보기'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {myEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Calendar size={48} className="mb-2 opacity-20" />
                            <p className="font-bold text-sm">참여 중인 일정이 없습니다.</p>
                        </div>
                    ) : (
                        myEvents.map(event => {
                            const isPast = isBefore(parseISO(event.endDate), new Date());
                            const myStatus = event.attendance?.[currentUser.uid] || 'pending';

                            return (
                                <div
                                    key={event.id}
                                    onClick={() => {
                                        onClose();
                                        onEventClick(event);
                                    }}
                                    className={`bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden
                            ${isPast ? 'opacity-60 grayscale-[0.5]' : ''}
                        `}
                                >
                                    {/* Left Accent Bar based on status */}
                                    <div className={`absolute top-0 bottom-0 left-0 w-1 
                                        ${myStatus === 'joined' ? 'bg-[#081429]' : ''}
                                        ${myStatus === 'declined' ? 'bg-gray-300' : ''}
                                        ${myStatus === 'pending' ? 'bg-[#fdb813]' : ''}
                                    `} />

                                    <div className="pl-2">
                                        <div className="flex items-start justify-between mb-1.5">
                                            <div className="flex flex-col gap-1 w-full">
                                                <div className="flex items-center gap-2">
                                                    {/* Status Badge - Unified Font Size */}
                                                    <span className={`
                                                        text-xs px-2 py-0.5 rounded-md font-bold tracking-tight border
                                                        ${myStatus === 'joined' ? 'bg-[#081429]/5 text-[#081429] border-[#081429]/10' : ''}
                                                        ${myStatus === 'declined' ? 'bg-gray-100 text-gray-500 border-gray-200' : ''}
                                                        ${myStatus === 'pending' ? 'bg-[#fdb813]/10 text-[#fdb813] border-[#fdb813]/20' : ''}
                                                    `}>
                                                        {myStatus === 'joined' && '참석'}
                                                        {myStatus === 'declined' && '불참'}
                                                        {myStatus === 'pending' && '미정'}
                                                    </span>

                                                    {/* Department Badge */}
                                                    <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                                                        {event.departmentId === 'school' ? '학교행사' : event.departmentId}
                                                    </span>
                                                </div>

                                                {/* Title - Unified Font Size & Color #373d41 */}
                                                <h3 className="font-bold text-[#373d41] text-sm md:text-base leading-snug group-hover:text-[#081429] transition-colors">
                                                    {event.title}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={13} className="text-[#fdb813]" />
                                                <span className={isPast ? 'line-through decoration-gray-300' : 'text-gray-700 font-bold'}>
                                                    {event.startDate}
                                                </span>
                                            </div>
                                            {(event.startTime || event.isAllDay) && (
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={13} className="text-[#fdb813]" />
                                                    <span>
                                                        {event.isAllDay ? '하루종일' : `${event.startTime} ${event.endTime ? `~ ${event.endTime}` : ''}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

            </div>
        </div>
    );
};

export default MyEventsModal;
