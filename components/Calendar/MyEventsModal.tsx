import React, { useState, useEffect, useMemo } from 'react';
import { CalendarEvent, UserProfile } from '../../types';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { X, Calendar, Clock, MapPin, Filter } from 'lucide-react';

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

        // First, filter by participation (user is in participants list)
        const participated = events.filter(event => {
            // Check 1: User's displayName is in participants string
            const userName = currentUser.email.split('@')[0];
            const displayName = currentUser.displayName || userName;
            const jobTitle = currentUser.jobTitle;

            // Extract name from jobTitle if it contains it (e.g., "박소선 부장" -> "박소선")
            const nameFromJobTitle = jobTitle ? jobTitle.split(' ')[0] : null;

            // Build possible name formats to check
            const possibleNames = [
                userName,
                displayName,
                nameFromJobTitle,  // Add extracted name from jobTitle
                jobTitle,          // Add full jobTitle
                jobTitle ? `${userName} (${jobTitle})` : null,
                jobTitle ? `${displayName} (${jobTitle})` : null,
                nameFromJobTitle ? `${userName} (${nameFromJobTitle})` : null,
                nameFromJobTitle ? `${nameFromJobTitle} (${jobTitle})` : null,
            ].filter(Boolean);

            const isInParticipants = possibleNames.some(name =>
                event.participants?.includes(name as string)
            );

            // Check 2: User has explicit attendance entry (regardless of status)
            const hasAttendanceEntry = event.attendance && currentUser.uid in event.attendance;

            return isInParticipants || hasAttendanceEntry;
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
            const userName = currentUser.email.split('@')[0];
            const displayName = currentUser.displayName || userName;
            const jobTitle = currentUser.jobTitle;

            // Extract name from jobTitle if it contains it (e.g., "박소선 부장" -> "박소선")
            const nameFromJobTitle = jobTitle ? jobTitle.split(' ')[0] : null;

            const possibleNames = [
                userName,
                displayName,
                nameFromJobTitle,  // Add extracted name from jobTitle
                jobTitle,          // Add full jobTitle
                jobTitle ? `${userName} (${jobTitle})` : null,
                jobTitle ? `${displayName} (${jobTitle})` : null,
                nameFromJobTitle ? `${userName} (${nameFromJobTitle})` : null,
                nameFromJobTitle ? `${nameFromJobTitle} (${jobTitle})` : null,
            ].filter(Boolean);

            const isInParticipants = possibleNames.some(name =>
                event.participants?.includes(name as string)
            );

            const hasAttendanceEntry = event.attendance && currentUser.uid in event.attendance;

            return isInParticipants || hasAttendanceEntry;
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
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', transform: 'translateZ(0)', transition: 'none', zIndex: 9998 }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded-sm shadow-xl max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                        <Calendar className="text-accent" size={18} />
                        {customTitle || '내 일정 모아보기'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content with Section Headers */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    <div className="p-4 space-y-2">

                        {/* Section 1: 필터 */}
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <Filter className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">필터</h3>
                            </div>
                            <div className="px-2 py-2 flex gap-2">
                                {(['all', 'pending', 'joined', 'declined'] as StatusFilter[]).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5
                                            ${filterStatus === status
                                                ? status === 'all' ? 'bg-primary text-white'
                                                    : status === 'pending' ? 'bg-accent text-primary'
                                                        : status === 'joined' ? 'bg-primary text-white'
                                                            : 'bg-gray-400 text-white'
                                                : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                                            }
                                        `}
                                    >
                                        {status === 'all' && '전체'}
                                        {status === 'pending' && '미정'}
                                        {status === 'joined' && '참석'}
                                        {status === 'declined' && '불참'}
                                        <span className={`text-xxs px-1.5 py-0.5 rounded-sm ${filterStatus === status ? 'bg-white/20' : 'bg-gray-100'}`}>
                                            {statusCounts[status]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 2: 이벤트 목록 */}
                        <div className="bg-white border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                                <Calendar className="w-3 h-3 text-primary" />
                                <h3 className="text-primary font-bold text-xs">이벤트 목록</h3>
                            </div>
                            <div className="p-2 space-y-3 bg-gray-50">
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
                                                className={`bg-white rounded-sm p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden
                                        ${isPast ? 'opacity-60 grayscale-[0.5]' : ''}
                                    `}
                                            >
                                                {/* Left Accent Bar based on status */}
                                                <div className={`absolute top-0 bottom-0 left-0 w-1
                                                    ${myStatus === 'joined' ? 'bg-primary' : ''}
                                                    ${myStatus === 'declined' ? 'bg-gray-300' : ''}
                                                    ${myStatus === 'pending' ? 'bg-accent' : ''}
                                                `} />

                                                <div className="pl-2">
                                                    <div className="flex items-start justify-between mb-1.5">
                                                        <div className="flex flex-col gap-1 w-full">
                                                            <div className="flex items-center gap-2">
                                                                {/* Status Badge - Unified Font Size */}
                                                                <span className={`
                                                                    text-xs px-2 py-0.5 rounded-sm font-bold tracking-tight border
                                                                    ${myStatus === 'joined' ? 'bg-primary/5 text-primary border-primary/10' : ''}
                                                                    ${myStatus === 'declined' ? 'bg-gray-100 text-gray-500 border-gray-200' : ''}
                                                                    ${myStatus === 'pending' ? 'bg-accent/10 text-accent border-accent/20' : ''}
                                                                `}>
                                                                    {myStatus === 'joined' && '참석'}
                                                                    {myStatus === 'declined' && '불참'}
                                                                    {myStatus === 'pending' && '미정'}
                                                                </span>

                                                                {/* Department Badge */}
                                                                <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-sm border border-gray-200">
                                                                    {event.departmentId === 'school' ? '학교행사' : event.departmentId}
                                                                </span>
                                                            </div>

                                                            {/* Title - Unified Font Size & Color #373d41 */}
                                                            <h3 className="font-bold text-primary-700 text-sm md:text-base leading-snug group-hover:text-primary transition-colors">
                                                                {event.title}
                                                            </h3>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 text-xs text-gray-500 font-medium mt-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={13} className="text-accent" />
                                                            <span className={isPast ? 'line-through decoration-gray-300' : 'text-gray-700 font-bold'}>
                                                                {event.startDate}
                                                            </span>
                                                        </div>
                                                        {(event.startTime || event.isAllDay) && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock size={13} className="text-accent" />
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
                </div>

            </div>
        </div>
    );
};

export default MyEventsModal;
