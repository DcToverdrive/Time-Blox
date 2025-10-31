import React, { useMemo } from 'react';
import { ScheduleItem, MasterDay } from '../types';

interface DateTabsProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    allSchedules: { [key: string]: ScheduleItem[] };
    // Day copy props
    draggedDateKey: string | null;
    dropTargetDateKey: string | null;
    onDateDragStart: (dateKey: string) => void;
    onDateDragOver: (e: React.DragEvent, dateKey: string) => void;
    onDateDragLeave: () => void;
    onDateDrop: (dateKey: string) => void;
    onDateDragEnd: () => void;
    onDayDoubleClick: (dateKey: string) => void;
    copyLinks: { [copiedDateKey: string]: string };
    // Month copy props
    copiedMonthKey: string | null;
    justCopiedMonthKey: string | null;
    monthCopyLinks: { [copiedMonthKey: string]: string };
    pastedMonthKey: string | null;
    onCopyMonth: (monthKey: string) => void;
    onRequestPasteMonth: (monthKey: string) => void;
    // Settings props
    showCopyIndicators: boolean;
    showTodayIndicator: boolean;
    masterDays: MasterDay[];
}

const formatDateKey = (date: Date): string => {
    // Use UTC methods to prevent timezone shifts from changing the date
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatMonthKeyToFriendlyName = (monthKey: string): string => {
    const [year, month] = monthKey.split('-').map(Number);
    // Use UTC date to be consistent with formatDateKey
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const DateTabs: React.FC<DateTabsProps> = ({ 
    selectedDate, 
    onDateChange, 
    allSchedules,
    draggedDateKey,
    dropTargetDateKey,
    onDateDragStart,
    onDateDragOver,
    onDateDragLeave,
    onDateDrop,
    onDateDragEnd,
    onDayDoubleClick,
    copyLinks,
    copiedMonthKey,
    justCopiedMonthKey,
    monthCopyLinks,
    pastedMonthKey,
    onCopyMonth,
    onRequestPasteMonth,
    showCopyIndicators,
    showTodayIndicator,
    masterDays,
}) => {
    const today = new Date();

    const handlePrevMonth = () => {
        const newDate = new Date(selectedDate);
        newDate.setUTCDate(1); // Avoid issues with day overflow
        newDate.setUTCMonth(newDate.getUTCMonth() - 1);
        onDateChange(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(selectedDate);
        newDate.setUTCDate(1);
        newDate.setUTCMonth(newDate.getUTCMonth() + 1);
        onDateChange(newDate);
    };

    const handleDayClick = (day: number) => {
        const newDate = new Date(selectedDate);
        newDate.setUTCDate(day);
        onDateChange(newDate);
    };

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const { currentMonthKey, currentMonthFriendlyName, copiedMonthFriendlyName } = useMemo(() => {
        const year = selectedDate.getUTCFullYear();
        const month = selectedDate.getUTCMonth();
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        const name = formatMonthKeyToFriendlyName(key);
        const copiedName = copiedMonthKey ? formatMonthKeyToFriendlyName(copiedMonthKey) : '';
        return { currentMonthKey: key, currentMonthFriendlyName: name, copiedMonthFriendlyName: copiedName };
    }, [selectedDate, copiedMonthKey]);


    const renderCalendarGrid = () => {
        const year = selectedDate.getUTCFullYear();
        const month = selectedDate.getUTCMonth();

        const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        
        const calendarDays = [];

        // Add blank cells for the days before the first of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarDays.push(<div key={`blank-${i}`} className="w-10 h-10"></div>);
        }

        // Add the actual day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(year, month, day));
            const dateKey = formatDateKey(currentDate);

            const isToday = day === today.getUTCDate() && month === today.getUTCMonth() && year === today.getUTCFullYear();
            const isSelected = day === selectedDate.getUTCDate() && month === selectedDate.getUTCMonth() && year === selectedDate.getUTCFullYear();
            const hasSchedule = allSchedules[dateKey] && allSchedules[dateKey].length > 0;
            
            // Temporary drag/drop state indicators
            const isBeingDragged = dateKey === draggedDateKey;
            const isDropTarget = dateKey === dropTargetDateKey;
            
            // Temporary highlight for pasted days
            const isPastedDay = pastedMonthKey === currentMonthKey && hasSchedule;
            
            const renderIndicator = () => {
                // A day must have a schedule and the setting must be enabled to show any indicator.
                if (!showCopyIndicators || !hasSchedule) {
                    return null;
                }
            
                // PRIORITY 1: Is this day a designated Master Day?
                // If so, it ALWAYS gets a white line, regardless of any other status.
                if (masterDays.some(md => md.dateKey === dateKey)) {
                    return <div className="absolute top-0.5 left-1 right-1 h-0.5 bg-white rounded-full" title="Master Day Template" />;
                }
            
                // PRIORITY 2: If not a Master Day, is it a copy of another day?
                const sourceKey = copyLinks[dateKey];
                if (sourceKey) {
                    // It's a copy. Let's find out what color it should be.
                    // If its source is a Master Day, use that master's color.
                    const sourceIsMaster = masterDays.find(md => md.dateKey === sourceKey);
                    const indicatorColor = sourceIsMaster ? sourceIsMaster.color : 'bg-sky-400'; // Default color
                    return <div className={`absolute top-0.5 left-1 right-1 h-0.5 ${indicatorColor} rounded-full`} title="Copied Day" />;
                }
                
                // If none of the above, render nothing.
                return null;
            };

            let dayClasses = `
                relative w-10 h-10 text-xs font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center flex-grow
                ${hasSchedule ? 'cursor-grab' : 'cursor-pointer'}
            `;

            if (isSelected) {
                dayClasses += ' bg-sky-600 text-white shadow';
            } else if (isDropTarget) {
                 dayClasses += ' bg-slate-600/50 ring-1 ring-sky-500';
            } else if (isToday && showTodayIndicator) {
                 dayClasses += ' bg-slate-600 text-sky-300 ring-1 ring-slate-500';
            } else if (isPastedDay) {
                dayClasses += ' bg-sky-500/60 ring-1 ring-sky-400';
            }
            else {
                dayClasses += ' text-slate-300 hover:bg-slate-700/60';
            }
            
            calendarDays.push(
                <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    onDoubleClick={() => onDayDoubleClick(dateKey)}
                    className={dayClasses}
                    draggable={hasSchedule}
                    onDragStart={() => onDateDragStart(dateKey)}
                    onDragOver={(e) => onDateDragOver(e, dateKey)}
                    onDragLeave={onDateDragLeave}
                    onDrop={(e) => {
                        e.preventDefault();
                        onDateDrop(dateKey);
                    }}
                    onDragEnd={onDateDragEnd}
                >
                    {day}
                    {/* Temporary indicator for the item being dragged */}
                    {isBeingDragged && (
                        <div className="absolute top-0.5 left-1 right-1 h-0.5 bg-white rounded-full opacity-50"></div>
                    )}
                    {/* Temporary indicator for the drop target */}
                    {isDropTarget && (
                        <div className="absolute top-0.5 left-1 right-1 h-0.5 bg-sky-400 rounded-full opacity-50"></div>
                    )}
                    
                    {renderIndicator()}
                </button>
            );
        }

        return calendarDays;
    };
    
    // A month is a "master" if it's currently selected for copy OR if it has been used as a source for a paste.
    const isCurrentlyCopied = showCopyIndicators && copiedMonthKey === currentMonthKey;
    const isAPasteSource = showCopyIndicators && Object.values(monthCopyLinks).includes(currentMonthKey);
    const isMasterMonth = isCurrentlyCopied || isAPasteSource;

    // A month is a "copy" if it is the destination of a paste.
    const isCopiedMonth = showCopyIndicators && !!monthCopyLinks[currentMonthKey];

    return (
        <div className="bg-slate-800/50 rounded-lg p-2 shadow-lg mb-4">
            {/* Month Header */}
            <div className="flex justify-between items-center gap-1 md:gap-2">
                <button onClick={handlePrevMonth} className="text-slate-400 hover:text-slate-200 p-2 rounded-full" aria-label="Previous month">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="flex-grow flex justify-center items-center gap-2">
                     {/* Paste Button (appears when a month is copied) */}
                     {copiedMonthKey && copiedMonthKey !== currentMonthKey && (
                        <button
                            onClick={() => onRequestPasteMonth(currentMonthKey)}
                            className="p-2 text-sky-300 hover:bg-slate-700/50 rounded-full transition-colors"
                            title={`Paste schedule from ${copiedMonthFriendlyName} to ${currentMonthFriendlyName}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 5.25 6h.008a2.25 2.25 0 0 1 2.242 2.135 48.425 48.425 0 0 0 .1 1.071 2.25 2.25 0 0 1-2.242 2.288H5.25a2.25 2.25 0 0 1-2.25-2.25V6.25a2.25 2.25 0 0 1 2.25-2.25h.008a2.25 2.25 0 0 1 2.242-2.135 48.425 48.425 0 0 0-.1-1.071A2.25 2.25 0 0 1 5.25 3h-.008a2.25 2.25 0 0 1-2.242-2.135 48.425 48.425 0 0 0-1.123.08A2.25 2.25 0 0 0 3 6.108v9.642a2.25 2.25 0 0 0 2.25 2.25H15m3 .75-3-3m0 0-3 3m3-3v12" />
                            </svg>
                        </button>
                     )}
                     
                    <div className="relative text-center px-3 py-2">
                        <h3 className="text-sm md:text-base font-bold text-slate-200 w-32">
                            {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                        </h3>
                        {isMasterMonth && <div className="absolute top-0.5 left-2 right-2 h-0.5 bg-white rounded-full"></div>}
                        {isCopiedMonth && <div className="absolute top-0.5 left-2 right-2 h-0.5 bg-sky-400 rounded-full"></div>}
                    </div>

                    {/* Copy Button container */}
                    <div className="relative">
                        <button
                            onClick={() => onCopyMonth(currentMonthKey)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors"
                            title={`Copy schedule for ${currentMonthFriendlyName}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                            </svg>
                        </button>
                         {/* "Copied!" Text Indicator */}
                         {justCopiedMonthKey === currentMonthKey && (
                            <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-semibold text-sky-300 pointer-events-none animate-pulse">
                                Copied!
                            </span>
                        )}
                    </div>
                </div>
                
                <button onClick={handleNextMonth} className="text-slate-400 hover:text-slate-200 p-2 rounded-full" aria-label="Next month">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            <hr className="border-slate-700/50 my-2" />

            {/* Day of Week Headers & Calendar Grid */}
            <div className="grid grid-cols-7 justify-items-center gap-1">
                 {daysOfWeek.map(day => (
                    <div key={day} className="w-10 h-10 text-xs font-bold text-slate-500 flex items-center justify-center">
                        {day}
                    </div>
                ))}
                {renderCalendarGrid()}
            </div>
        </div>
    );
};

export default DateTabs;