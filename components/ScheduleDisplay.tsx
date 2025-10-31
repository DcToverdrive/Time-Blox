import React, { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { ScheduleItem } from '../types';
import ScheduleBlock from './ScheduleBlock';
import DragPreviewBlock from './DragPreviewBlock';
import { playClickSound } from '../utils/sounds';

interface ScheduleDisplayProps {
    schedule: ScheduleItem[];
    onBlockClick: (index: number) => void;
    onBlockDelete: (index: number) => void;
    onItemDrop: (itemIndex: number, newStartTime: string, newEndTime: string, collidedWithIndex: number | null) => void;
    onExtendBlock: (index: number) => void;
    onShortenBlock: (index: number) => void;
    onLongPressEmptySlot: (startTime: string) => void;
    onBlockResize: (index: number, newStartTime: string, newEndTime: string) => void;
    activeActionBlockIndex: number | null;
    onSetActiveActionBlockIndex: (index: number | null) => void;
    scrollToTime: string | null;
    onScrolled: () => void;
}

const SNAP_INCREMENT_MINUTES = 5; // Snap to 5-minute intervals for dragging
const NEW_BLOCK_SNAP_MINUTES = 15; // Snap to 15-minute intervals for new blocks
const BLOCK_VERTICAL_GAP = 3; // 3px gap above each block
const LONG_PRESS_DELAY = 700;
const MIN_BLOCK_DURATION_MINUTES = 15;
const MOBILE_BREAKPOINT = 768;
const MIN_PIXELS_PER_MINUTE = 1.8; // The default is now the minimum zoom level

const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;

    let [, hoursStr, minutesStr, modifier] = match;
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (modifier.toUpperCase() === 'PM' && hours < 12) {
        hours += 12;
    }
    if (modifier.toUpperCase() === 'AM' && hours === 12) {
        hours = 0; // Midnight case
    }
    return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number): string => {
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.round(totalMinutes % 60);
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const modifier = hours24 >= 12 ? 'PM' : 'AM';
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${modifier}`;
};


const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({ schedule, onBlockClick, onBlockDelete, onItemDrop, onExtendBlock, onShortenBlock, onLongPressEmptySlot, onBlockResize, activeActionBlockIndex, onSetActiveActionBlockIndex, scrollToTime, onScrolled }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pixelsPerMinute, setPixelsPerMinute] = useState(MIN_PIXELS_PER_MINUTE);
    const longPressTimerRef = useRef<number>();
    
    const [squishedBlockInfo, setSquishedBlockInfo] = useState<{ index: number; newHeight: number; newTop: number } | null>(null);
    
    // --- Unified Interaction State ---
    const interactionInfoRef = useRef<{
        type: 'drag' | 'resize';
        index: number;
        handle: 'top' | 'bottom' | null;
        initialY: number;
        initialTop: number;
        cursorOffset: number;
        initialStartMinutes: number;
        initialEndMinutes: number;
        duration: number;
    } | null>(null);

    const [interactionPreview, setInteractionPreview] = useState<{
        index: number,
        top: number,
        startTime: string,
        endTime: string,
        isDragging: boolean,
        isResizing: boolean,
    } | null>(null);

    // --- Ref to fix stale closures in event handlers ---
    const latestStateRef = useRef({
        schedule,
        pixelsPerMinute,
        dayStartMinutes: 0,
        interactionInfoRef,
        interactionPreview,
        squishedBlockInfo,
        onBlockResize,
        onItemDrop,
        setInteractionPreview,
        setSquishedBlockInfo,
        lastSnappedMinutes: null as number | null,
    });


    const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
    
    // Ref for centered zooming
    const scrollAdjustmentRef = useRef<{ scrollByY: number } | null>(null);


    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const { dayStartMinutes, totalDayHeight, timeLabels, minuteMarkers } = useMemo(() => {
        const dayStartMinutes = 0;
        const totalDayDurationMinutes = 24 * 60;
        const totalDayHeight = totalDayDurationMinutes * pixelsPerMinute;

        const activeItem = activeActionBlockIndex !== null && schedule ? schedule[activeActionBlockIndex] : null;
        const activeStartHour = activeItem ? Math.floor(timeToMinutes(activeItem.startTime) / 60) : -1;
        const activeEndHour = activeItem ? Math.ceil(timeToMinutes(activeItem.endTime) / 60) : -1;

        const hourDotPositionPx = isMobile ? 48 : 64;

        const labels = [];
        for (let hour = 0; hour <= 24; hour++) {
            const date = new Date();
            date.setHours(hour, 0, 0, 0);
            
            const isLineContracted = activeItem ? (hour >= activeStartHour && hour < activeEndHour) : false;
            
            labels.push({
                label: date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(':00', ''),
                top: (hour * 60 - dayStartMinutes) * pixelsPerMinute,
                isLineContracted: isLineContracted
            });
        }
        
        const markers = [];
        const endLoopMinutes = dayStartMinutes + totalDayDurationMinutes;
        for (let currentMinuteInDay = dayStartMinutes; currentMinuteInDay < endLoopMinutes; currentMinuteInDay += 5) {
            if (currentMinuteInDay % 60 === 0) continue; 

            const top = (currentMinuteInDay - dayStartMinutes) * pixelsPerMinute;
            let type: 'short' | 'medium' | 'long' = 'short';
            
            if (currentMinuteInDay % 30 === 0) type = 'long';
            else if (currentMinuteInDay % 15 === 0) type = 'medium';

            const markerRightPaddingPx = 6;
            const longMarkerWidth = 16;
            const mediumMarkerWidth = 10;
            const shortMarkerWidth = 5;

            const width = type === 'long' ? longMarkerWidth : type === 'medium' ? mediumMarkerWidth : shortMarkerWidth;
            const left = hourDotPositionPx - width - markerRightPaddingPx;
            
            markers.push({ top, type, left, width });
        }
        
        latestStateRef.current.dayStartMinutes = dayStartMinutes;
        return { dayStartMinutes, totalDayHeight, timeLabels: labels, minuteMarkers: markers };
    }, [pixelsPerMinute, schedule, activeActionBlockIndex, isMobile]);
    
    useLayoutEffect(() => {
        if (scrollAdjustmentRef.current) {
            window.scrollBy({ top: scrollAdjustmentRef.current.scrollByY, behavior: 'auto' });
            scrollAdjustmentRef.current = null; // Reset after applying
        }
    }, [pixelsPerMinute]);

    const handleZoom = useCallback((factor: number) => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const oldPixelsPerMinute = pixelsPerMinute;

        // Calculate new zoom level, respecting the min/max limits.
        const newPixelsPerMinute = oldPixelsPerMinute * factor;
        const clampedNewPixelsPerMinute = Math.max(MIN_PIXELS_PER_MINUTE, Math.min(newPixelsPerMinute, 7.2));
        
        // If the zoom level doesn't change (e.g., already at max/min), do nothing.
        if (clampedNewPixelsPerMinute === oldPixelsPerMinute) return;
        
        // Find the pixel offset of the viewport center within the timeline container.
        const viewportCenterOffset = (window.innerHeight / 2) - containerRect.top;
        
        // Calculate where that same point in time will be with the new zoom level.
        const newViewportCenterOffset = viewportCenterOffset * (clampedNewPixelsPerMinute / oldPixelsPerMinute);
        
        // The difference is how much we need to scroll by to keep the point centered.
        const scrollByY = newViewportCenterOffset - viewportCenterOffset;

        // Store the calculated scroll delta in a ref.
        scrollAdjustmentRef.current = { scrollByY };
        
        // Update the state to trigger a re-render with the new zoom level.
        // The useLayoutEffect will read from the ref and apply the scroll adjustment.
        setPixelsPerMinute(clampedNewPixelsPerMinute);

    }, [pixelsPerMinute]);

    const handleZoomIn = useCallback(() => handleZoom(1.25), [handleZoom]);
    const handleZoomOut = useCallback(() => handleZoom(0.8), [handleZoom]);

    useEffect(() => {
        latestStateRef.current = {
            ...latestStateRef.current,
            schedule,
            pixelsPerMinute,
            interactionInfoRef,
            interactionPreview,
            squishedBlockInfo,
            onBlockResize,
            onItemDrop,
            setInteractionPreview,
            setSquishedBlockInfo,
        };
    });
    
    // Auto-scroll to the first event when a new schedule is loaded
    useEffect(() => {
        if (scrollToTime && containerRef.current) {
            const startMinutes = timeToMinutes(scrollToTime);
            const itemTopWithinContainer = (startMinutes - dayStartMinutes) * pixelsPerMinute;
            
            const containerTopOnPage = containerRef.current.getBoundingClientRect().top + window.scrollY;
            
            const finalScrollPosition = containerTopOnPage + itemTopWithinContainer;

            // Add some padding so the item isn't at the very top edge of the screen
            const paddingTop = 24; 
            
            window.scrollTo({
                top: Math.max(0, finalScrollPosition - paddingTop),
                behavior: 'smooth',
            });

            // Notify parent that we've handled the scroll request
            onScrolled();
        }
    }, [scrollToTime, pixelsPerMinute, dayStartMinutes, onScrolled]);
    
    
    const startLongPress = (y: number, target: HTMLDivElement) => {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = window.setTimeout(() => {
            const rect = target.getBoundingClientRect();
            const relativeY = y - rect.top;
            const minutesFromTop = relativeY / pixelsPerMinute;
            const newStartMinutesRaw = dayStartMinutes + minutesFromTop;
            const snappedStartMinutes = Math.round(newStartMinutesRaw / NEW_BLOCK_SNAP_MINUTES) * NEW_BLOCK_SNAP_MINUTES;
            const newStartTime = minutesToTime(snappedStartMinutes);
            onLongPressEmptySlot(newStartTime);
        }, LONG_PRESS_DELAY);
    };

    const cancelLongPress = () => {
        clearTimeout(longPressTimerRef.current);
    };
    
    const handleEmptyAreaMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            startLongPress(e.clientY, e.currentTarget);
        }
    };
    
    const handleEmptyAreaTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            startLongPress(e.touches[0].clientY, e.currentTarget);
        }
    };

    // --- Unified Interaction Logic (Stable Handlers) ---
    const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
        const state = latestStateRef.current;
        if (!state.interactionInfoRef.current || !state.schedule) return;

        const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const { type, index, handle, initialY, initialStartMinutes, initialEndMinutes, duration, cursorOffset } = state.interactionInfoRef.current;
        const deltaY = currentY - initialY;
        
        if (type === 'resize') {
            const deltaMinutes = Math.round((deltaY / state.pixelsPerMinute) / SNAP_INCREMENT_MINUTES) * SNAP_INCREMENT_MINUTES;
            let newStartMinutes = initialStartMinutes;
            let newEndMinutes = initialEndMinutes;

            if (handle === 'top') {
                newStartMinutes = initialStartMinutes + deltaMinutes;
                newStartMinutes = Math.min(newStartMinutes, initialEndMinutes - MIN_BLOCK_DURATION_MINUTES);
                if (index > 0) {
                    const prevBlockEndMinutes = timeToMinutes(state.schedule[index - 1].endTime);
                    newStartMinutes = Math.max(newStartMinutes, prevBlockEndMinutes);
                }
                newStartMinutes = Math.max(newStartMinutes, 0);
            } else { // handle === 'bottom'
                newEndMinutes = initialEndMinutes + deltaMinutes;
                newEndMinutes = Math.max(newEndMinutes, initialStartMinutes + MIN_BLOCK_DURATION_MINUTES);
                if (index < state.schedule.length - 1) {
                    const nextBlockStartMinutes = timeToMinutes(state.schedule[index + 1].startTime);
                    newEndMinutes = Math.min(newEndMinutes, nextBlockStartMinutes);
                }
                newEndMinutes = Math.min(newEndMinutes, 24 * 60);
            }
            
            const newStartTime = minutesToTime(newStartMinutes);
            const newEndTime = minutesToTime(newEndMinutes);
            const newSnappedMinutes = handle === 'top' ? newStartMinutes : newEndMinutes;

            if (state.lastSnappedMinutes !== newSnappedMinutes) {
                playClickSound();
                if (navigator.vibrate) navigator.vibrate(10);
                state.lastSnappedMinutes = newSnappedMinutes;
            }
            
            state.setInteractionPreview({ index, startTime: newStartTime, endTime: newEndTime, top: 0, isDragging: false, isResizing: true });

        } else if (type === 'drag') {
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (!containerRect) return;

            const y = currentY - containerRect.top - cursorOffset;
            const minutesFromTop = y / state.pixelsPerMinute;
            const newStartMinutesRaw = state.dayStartMinutes + minutesFromTop;
            const snappedStartMinutes = Math.round(newStartMinutesRaw / SNAP_INCREMENT_MINUTES) * SNAP_INCREMENT_MINUTES;

            if (state.lastSnappedMinutes !== snappedStartMinutes) {
                playClickSound();
                if (navigator.vibrate) navigator.vibrate(10);
                state.lastSnappedMinutes = snappedStartMinutes;
            }
            const newEndMinutes = snappedStartMinutes + duration;
            const newStartTime = minutesToTime(snappedStartMinutes);
            const newEndTime = minutesToTime(newEndMinutes);
            
            state.setInteractionPreview({ index, top: y, startTime: newStartTime, endTime: newEndTime, isDragging: true, isResizing: false });

            let collidedIndex: number | null = null;
            for (let i = 0; i < state.schedule.length; i++) {
                if (i === index) continue;
                const item = state.schedule[i];
                const itemStartMinutes = timeToMinutes(item.startTime);
                const itemEndMinutes = timeToMinutes(item.endTime);
                if (snappedStartMinutes < itemEndMinutes && newEndMinutes > itemStartMinutes) {
                    collidedIndex = i;
                    break;
                }
            }
            
            if (collidedIndex !== null) {
                const targetItem = state.schedule[collidedIndex];
                const targetStartMinutes = timeToMinutes(targetItem.startTime);
                const newTargetEndMinutes = snappedStartMinutes;
                const newDuration = newTargetEndMinutes - targetStartMinutes;
                
                if (newDuration >= 15) {
                    const newTop = (targetStartMinutes - state.dayStartMinutes) * state.pixelsPerMinute + BLOCK_VERTICAL_GAP;
                    const newHeight = newDuration * state.pixelsPerMinute - (BLOCK_VERTICAL_GAP * 2);
                    state.setSquishedBlockInfo({ index: collidedIndex, newHeight, newTop });
                } else {
                    state.setSquishedBlockInfo(null);
                }
            } else {
                state.setSquishedBlockInfo(null);
            }
        }
    }, []);

    const handleInteractionEnd = useCallback(() => {
        const state = latestStateRef.current;
        if (state.interactionInfoRef.current && state.interactionPreview) {
            const { type, index } = state.interactionInfoRef.current;
            if (type === 'resize') {
                state.onBlockResize(index, state.interactionPreview.startTime, state.interactionPreview.endTime);
            } else if (type === 'drag') {
                const snappedStartMinutes = timeToMinutes(state.interactionPreview.startTime);
                const newEndMinutes = snappedStartMinutes + state.interactionInfoRef.current.duration;
                let collidedIndex: number | null = null;
                for (let i = 0; i < state.schedule.length; i++) {
                    if (i === index) continue;
                    const item = state.schedule[i];
                    const itemStartMinutes = timeToMinutes(item.startTime);
                    const itemEndMinutes = timeToMinutes(item.endTime);
                    if (snappedStartMinutes < itemEndMinutes && newEndMinutes > itemStartMinutes) {
                        collidedIndex = i;
                        break;
                    }
                }
                state.onItemDrop(index, state.interactionPreview.startTime, state.interactionPreview.endTime, collidedIndex);
            }
        }

        document.removeEventListener('mousemove', handleInteractionMove);
        document.removeEventListener('mouseup', handleInteractionEnd);
        document.removeEventListener('touchmove', handleInteractionMove);
        document.removeEventListener('touchend', handleInteractionEnd);
        
        state.interactionInfoRef.current = null;
        state.setInteractionPreview(null);
        state.setSquishedBlockInfo(null);
        state.lastSnappedMinutes = null;
    }, []);

    const handleInteractionStart = useCallback((index: number, type: 'drag' | 'resize', handle: 'top' | 'bottom' | null, e: React.MouseEvent | React.TouchEvent) => {
        if (!schedule || interactionInfoRef.current) return;
        onSetActiveActionBlockIndex(null); // Close actions panel on any interaction

        document.addEventListener('mousemove', handleInteractionMove);
        document.addEventListener('mouseup', handleInteractionEnd);
        document.addEventListener('touchmove', handleInteractionMove);
        document.addEventListener('touchend', handleInteractionEnd);
        
        const initialY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const item = schedule[index];
        const initialStartMinutes = timeToMinutes(item.startTime);
        const initialEndMinutes = timeToMinutes(item.endTime);
        const duration = initialEndMinutes - initialStartMinutes;
        
        let cursorOffset = 0;
        if (type === 'drag') {
            const blockElement = e.currentTarget as HTMLElement;
            if (blockElement) {
                const rect = blockElement.getBoundingClientRect();
                 cursorOffset = initialY - rect.top;
            }
        }
        
        interactionInfoRef.current = {
            type,
            index,
            handle,
            initialY,
            cursorOffset,
            initialTop: 0, // Placeholder, not used currently
            initialStartMinutes,
            initialEndMinutes,
            duration,
        };
        
        setInteractionPreview({ index, top: 0, startTime: item.startTime, endTime: item.endTime, isDragging: type === 'drag', isResizing: type === 'resize'});

    }, [schedule, handleInteractionMove, handleInteractionEnd, onSetActiveActionBlockIndex]);
    
    useEffect(() => {
        return () => {
            // Ensure listeners are cleaned up on unmount
            document.removeEventListener('mousemove', handleInteractionMove);
            document.removeEventListener('mouseup', handleInteractionEnd);
            document.removeEventListener('touchmove', handleInteractionMove);
            document.removeEventListener('touchend', handleInteractionEnd);
        };
    }, [handleInteractionMove, handleInteractionEnd]);

    if (!schedule || schedule.length === 0) {
        return null;
    }

    const isInteracting = interactionPreview !== null;
    const interactionRulerStartTime = isInteracting ? interactionPreview.startTime : '';
    const interactionRulerEndTime = isInteracting ? interactionPreview.endTime : '';
    const interactionRulerStartTop = isInteracting ? (timeToMinutes(interactionRulerStartTime) - dayStartMinutes) * pixelsPerMinute : 0;
    const interactionRulerEndTop = isInteracting ? (timeToMinutes(interactionRulerEndTime) - dayStartMinutes) * pixelsPerMinute : 0;

    return (
        <div className="bg-slate-800/50 rounded-lg p-4 md:p-6 shadow-lg relative">
             <div className="sticky top-6 left-2 z-30 flex flex-col gap-2">
                <button
                    onClick={handleZoomIn}
                    className="w-7 h-7 flex items-center justify-center bg-slate-700/80 hover:bg-slate-600/80 rounded-full text-slate-300 transition-colors"
                    aria-label="Zoom In / Expand View"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                    </svg>
                </button>
                <button
                    onClick={handleZoomOut}
                    disabled={pixelsPerMinute <= MIN_PIXELS_PER_MINUTE}
                    className="w-7 h-7 flex items-center justify-center bg-slate-700/80 hover:bg-slate-600/80 rounded-full text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Zoom Out / Contract View"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
            </div>

            <div 
                ref={containerRef}
                className="relative" 
                style={{ height: `${totalDayHeight}px` }}
                onMouseDown={handleEmptyAreaMouseDown}
                onMouseUp={cancelLongPress}
                onMouseMove={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={handleEmptyAreaTouchStart}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
            >
                {/* Timeline Grid Layer */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {minuteMarkers.map(({ top, left, width }) => (
                        <div 
                            key={`marker-${top}`}
                            className={`absolute h-px bg-white/20 -translate-y-12`}
                            style={{ top: `${top}px`, left: `${left}px`, width: `${width}px` }}
                        />
                    ))}
                    {timeLabels.map(({ label, top, isLineContracted }) => (
                         <div key={label} className="absolute w-full" style={{ top: `${top}px` }}>
                             <div className="flex items-center -translate-y-1/2">
                                 <span className="w-12 md:w-16 text-right pr-2 text-sm font-bold text-white/80 whitespace-nowrap">{label}</span>
                                 <div className="w-1.5 h-1.5 bg-white/80 rounded-full shadow"></div>
                                 <div className={`h-px bg-white/30 ml-2 transition-all duration-300 ease-in-out ${isLineContracted ? 'mr-20 md:mr-24' : 'flex-1'}`}></div>
                             </div>
                         </div>
                    ))}
                </div>

                {/* Ruler Highlights for Dragging or Resizing */}
                {isInteracting && (
                    <>
                        <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ transform: `translateY(${interactionRulerStartTop}px)` }}>
                            <div className="flex items-center -translate-y-1/2">
                                <span className="w-auto text-right pr-2 text-sm font-bold text-white bg-slate-900/80 rounded-r-md px-1">{interactionRulerStartTime}</span>
                                <div className="w-2 h-2 bg-sky-300 rounded-full shadow-lg ring-2 ring-slate-900"></div>
                                <div className="flex-1 h-0.5 bg-sky-300/70 ml-2"></div>
                            </div>
                        </div>
                        <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ transform: `translateY(${interactionRulerEndTop}px)` }}>
                            <div className="flex items-center -translate-y-1/2">
                                <span className="w-auto text-right pr-2 text-sm font-bold text-white bg-slate-900/80 rounded-r-md px-1">{interactionRulerEndTime}</span>
                                <div className="w-2 h-2 bg-sky-300 rounded-full shadow-lg ring-2 ring-slate-900"></div>
                                <div className="flex-1 h-0.5 bg-sky-300/70 ml-2"></div>
                            </div>
                        </div>
                    </>
                )}
                
                {/* Schedule Blocks Layer */}
                {schedule.map((item, index) => {
                     const isCurrentlyInteracting = interactionPreview?.index === index;
                     const displayStartTime = isCurrentlyInteracting ? interactionPreview.startTime : item.startTime;
                     const displayEndTime = isCurrentlyInteracting ? interactionPreview.endTime : item.endTime;

                     const itemStartMinutes = timeToMinutes(displayStartTime);
                     const itemEndMinutes = timeToMinutes(displayEndTime);
                     const duration = itemEndMinutes - itemStartMinutes;
                     
                     if (duration <= 0) return null;

                     const top = (itemStartMinutes - dayStartMinutes) * pixelsPerMinute + BLOCK_VERTICAL_GAP;
                     const height = duration * pixelsPerMinute - (BLOCK_VERTICAL_GAP * 2);

                     let finalStyle = {
                        top: `${top}px`,
                        height: `${Math.max(0, height)}px`,
                     };

                     if (squishedBlockInfo && squishedBlockInfo.index === index) {
                         finalStyle = {
                             top: `${squishedBlockInfo.newTop}px`,
                             height: `${Math.max(0, squishedBlockInfo.newHeight)}px`,
                         };
                     }

                     return (
                        <ScheduleBlock
                            key={`${item.title}-${index}-${item.startTime}`}
                            item={item}
                            style={finalStyle}
                            startTime={displayStartTime}
                            endTime={displayEndTime}
                            onEdit={() => onBlockClick(index)}
                            onDelete={() => onBlockDelete(index)}
                            onDoubleClick={onExtendBlock}
                            onLongPress={onShortenBlock}
                            onInteractionStart={handleInteractionStart}
                            index={index}
                            isBeingDragged={isCurrentlyInteracting && interactionPreview.isDragging}
                            isBeingResized={isCurrentlyInteracting && interactionPreview.isResizing}
                            isActionsOpen={activeActionBlockIndex === index}
                            onToggleActions={() => onSetActiveActionBlockIndex(activeActionBlockIndex === index ? null : index)}
                        />
                     );
                })}

                {interactionPreview?.isDragging && interactionInfoRef.current && (
                    <DragPreviewBlock
                        item={schedule[interactionPreview.index]}
                        startTime={interactionPreview.startTime}
                        endTime={interactionPreview.endTime}
                        style={{
                            height: `${interactionInfoRef.current.duration * pixelsPerMinute}px`,
                            transform: `translateY(${interactionPreview.top}px)`,
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default ScheduleDisplay;