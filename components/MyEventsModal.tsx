import React, { useState, useEffect, useMemo } from 'react';
import { CalendarEvent, UserProfile } from '../types';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { X, Calendar, Clock, MapPin } from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'joined' | 'declined';

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
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

    // Compute filtered events based on current user and selected status
    // NOTE: Hooks must be called before any conditional return
    const filteredEvents = useMemo(() => {
        if (!currentUser || !isOpen) return [];

        // First, filter by participation
        const participated = events.filter(event => {
            if (event.attendance && event.attendance[currentUser.uid]) {
                return true;
            }
            const userName = currentUser.email.split('@')[0];
            return event.participants?.includes(userName) || false;
        });

        // Then, filter by status
        const statusFiltered = filterStatus === 'all'
            ? participated
            : participated.filter(event => {
                const myStatus = event.attendance?.[currentUser.uid] || 'pending';
                return myStatus === filterStatus;
            });

        // Sort: upcoming first, then past
        const now = new Date();
        const upcoming = statusFiltered.filter(e => isAfter(parseISO(e.endDate), now)).sort((a, b) => a.startDate.localeCompare(b.startDate));
        const past = statusFiltered.filter(e => isBefore(parseISO(e.endDate), now)).sort((a, b) => b.startDate.localeCompare(a.startDate));

        return [...upcoming, ...past];
    }, [events, currentUser, filterStatus, isOpen]);

    // Count by status for badge display
    const statusCounts = useMemo(() => {
        if (!currentUser || !isOpen) return { all: 0, pending: 0, joined: 0, declined: 0 };

        const participated = events.filter(event => {
            if (event.attendance && event.attendance[currentUser.uid]) return true;
            const userName = currentUser.email.split('@')[0];
            return event.participants?.includes(userName) || false;
        });

        return {
            all: participated.length,
            pending: participated.filter(e => (e.attendance?.[currentUser.uid] || 'pending') === 'pending').length,
            joined: participated.filter(e => e.attendance?.[currentUser.uid] === 'joined').length,
            declined: participated.filter(e => e.attendance?.[currentUser.uid] === 'declined').length,
        };
    }, [events, currentUser, isOpen]);

    // Conditional render AFTER all hooks
    if (!isOpen || !currentUser) return null;

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

                {/* Filter Tabs */}
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex gap-2">
                    {(['all', 'pending', 'joined', 'declined'] as StatusFilter[]).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5
                                ${filterStatus === status
                                    ? status === 'all' ? 'bg-[#081429] text-white'
                                        : status === 'pending' ? 'bg-[#fdb813] text-[#081429]'
                                            : status === 'joined' ? 'bg-[#081429] text-white'
                                                : 'bg-gray-400 text-white'
                                    : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                                }
                            `}
                        >
                            {status === 'all' && '전체'}
                            {status === 'pending' && '미정'}
                            {status === 'joined' && '참석'}
                            {status === 'declined' && '불참'}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterStatus === status ? 'bg-white/20' : 'bg-gray-100'}`}>
                                {statusCounts[status]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {filteredEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Calendar size={48} className="mb-2 opacity-20" />
                            <p className="font-bold text-sm">
                                {filterStatus === 'all' ? '참여 중인 일정이 없습니다.' : `해당 상태의 일정이 없습니다.`}
                            </p>
                        </div>
                    ) : (
                        filteredEvents.map(event => {
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
