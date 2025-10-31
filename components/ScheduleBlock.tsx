import React, { useRef } from 'react';
import { ScheduleItem } from '../types';

interface ScheduleBlockProps {
    item: ScheduleItem;
    style: React.CSSProperties;
    startTime: string;
    endTime: string;
    onEdit: () => void;
    onDelete: () => void;
    onDoubleClick: (index: number) => void;
    onLongPress: (index: number) => void;
    onInteractionStart: (index: number, type: 'drag' | 'resize', handle: 'top' | 'bottom' | null, e: React.MouseEvent | React.TouchEvent) => void;
    index: number;
    isBeingDragged: boolean;
    isBeingResized: boolean;
    isActionsOpen: boolean;
    onToggleActions: () => void;
}

const LONG_PRESS_DELAY = 700;

const ScheduleBlock: React.FC<ScheduleBlockProps> = ({ item, style, startTime, endTime, onEdit, onDelete, onDoubleClick, onLongPress, onInteractionStart, index, isBeingDragged, isBeingResized, isActionsOpen, onToggleActions }) => {
    const heightInPixels = parseInt(style.height as string, 10) || 0;
    
    // Define visibility thresholds
    const canShowSidePanel = heightInPixels >= 60;
    const canShowDetails = heightInPixels >= 45;
    // 18px is low enough to catch 15-min blocks on smaller zoom levels (e.g. 1.2 * 15 = 18)
    const canShowChevron = heightInPixels >= 18;


    const timerRef = useRef<number>();
    const longPressTriggered = useRef(false);

    const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button')) {
            return; // Ignore clicks on any button (edit, delete, toggle)
        }

        // Prevent default browser actions like text selection or image dragging
        e.preventDefault();

        const topHandle = target.closest('[data-resize-handle="top"]');
        const bottomHandle = target.closest('[data-resize-handle="bottom"]');

        if (topHandle) {
            onInteractionStart(index, 'resize', 'top', e);
        } else if (bottomHandle) {
            onInteractionStart(index, 'resize', 'bottom', e);
        } else {
            // This is a drag interaction, set up the long press timer
            longPressTriggered.current = false;
            timerRef.current = window.setTimeout(() => {
                onLongPress(index);
                longPressTriggered.current = true;
            }, LONG_PRESS_DELAY);
            onInteractionStart(index, 'drag', null, e);
        }
    };
    
    // We only need a single handler for mouse up/leave/touch end to clear the long press timer
    const cancelLongPress = () => {
        clearTimeout(timerRef.current);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit();
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
    };

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (canShowSidePanel) {
            onToggleActions(); // Original behavior: open side panel
        } else {
            onEdit(); // New behavior for small blocks: open modal directly
        }
    };

    return (
        <div 
            style={style}
            className={`
                absolute left-14 md:left-20 right-0 rounded-lg shadow-lg z-10 flex
                transition-all duration-200 ease-in-out group
                ${isBeingDragged ? 'invisible' : 'opacity-100'}
                ${item.color}
                ${isBeingResized ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''}
            `}
            aria-label={`Schedule item: ${item.title} from ${startTime} to ${endTime}`}
            onMouseDown={handleInteraction}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onTouchStart={handleInteraction}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress} // Cancel if finger moves
            onDoubleClick={() => onDoubleClick(index)}
        >
             {/* Top Resizer */}
            <div
                data-resize-handle="top"
                className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-20 flex items-start justify-center"
            >
                <div className="w-8 h-1 bg-sky-300/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Bottom Resizer */}
            <div
                data-resize-handle="bottom"
                className="absolute -bottom-1 left-0 right-0 h-2 cursor-ns-resize z-20 flex items-end justify-center"
            >
                <div className="w-8 h-1 bg-sky-300/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Main Content Area */}
            <div className="relative flex-grow p-2 md:p-3 flex flex-col justify-start text-white cursor-grab active:cursor-grabbing select-none overflow-hidden">
                {/* Text content - give it padding on the right to not overlap with button */}
                <div className="pr-8">
                    <p className="font-bold text-sm md:text-base leading-tight truncate">{item.title}</p>
                    <p className="font-mono text-xs text-white/80">{startTime} - {endTime}</p>
                </div>

                {/* Absolutely positioned chevron button */}
                {canShowChevron && (
                    <button 
                        onClick={handleChevronClick}
                        className="absolute top-0 right-0 p-1 text-white/60 hover:text-white transition-colors z-10"
                        aria-label={`Open actions for ${item.title}`}
                    >
                        <svg className={`w-5 h-5 transition-transform duration-300 ${isActionsOpen && canShowSidePanel ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                )}

                {/* Details section */}
                {canShowDetails && (
                    <div className="mt-2 text-xs">
                        <span className="inline-block px-2 py-0.5 font-medium rounded-full bg-black/20">
                            {item.category}
                        </span>
                        {item.notes && <p className="text-white/70 italic truncate mt-1">{item.notes}</p>}
                    </div>
                )}
            </div>
            
            {canShowSidePanel && (
                <div className={`flex-shrink-0 grid grid-cols-2 text-white transition-all duration-300 ease-in-out overflow-hidden rounded-r-lg ${isActionsOpen ? 'w-20 md:w-24' : 'w-0'}`}>
                    <button
                        onClick={handleEditClick}
                        className="h-full flex items-center justify-center relative hover:bg-black/20 transition-colors"
                        style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}
                        aria-label={`Edit ${item.title}`}
                    >
                        <div className="absolute top-0 left-0 bottom-0 w-px bg-black/25"></div>
                        <svg className="w-5 h-5 opacity-80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                    </button>
                    
                    <button
                        onClick={handleDeleteClick}
                        className="h-full flex items-center justify-center bg-red-600/70 hover:bg-red-600 transition-colors relative"
                        aria-label={`Delete ${item.title}`}
                    >
                        <div className="absolute top-0 left-0 bottom-0 w-px bg-black/25"></div>
                        <svg className="w-5 h-5 opacity-80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScheduleBlock;