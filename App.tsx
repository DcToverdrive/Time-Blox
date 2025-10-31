import React, { useState, useCallback, useEffect } from 'react';
import { ScheduleItem, MasterDay, ActivityCategory } from './types';
import { generateSchedule } from './services/geminiService';
import { playCalendarTickSound } from './utils/sounds';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import ScheduleDisplay from './components/ScheduleDisplay';
import EditModal from './components/EditModal';
import ConfirmationModal from './components/ConfirmationModal';
import DateTabs from './components/DateTabs';
import SettingsPanel from './components/SettingsPanel';

// Helper functions for time conversion
const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let [, hoursStr, minutesStr, modifier] = match;
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes: number): string => {
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = Math.round(totalMinutes % 60);
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const modifier = hours24 >= 12 ? 'PM' : 'AM';
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${modifier}`;
};

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


const App: React.FC = () => {
    const [tasksInput, setTasksInput] = useState<string>('Write report (2h, preferred before noon), Meeting with design team (1h, after 2pm), Finish code review (1h), Grocery shopping (30m, after 5pm). My workday: 9am–6pm.');
    const [allSchedules, setAllSchedules] = useState<{ [key: string]: ScheduleItem[] }>({});
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activity, setActivity] = useState<'idle' | 'generating'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [editingState, setEditingState] = useState<{ item: ScheduleItem; index: number | null } | null>(null);
    const [deletingItemIndex, setDeletingItemIndex] = useState<number | null>(null);
    const [clearingDateKey, setClearingDateKey] = useState<string | null>(null);
    const [newBlockConfirmation, setNewBlockConfirmation] = useState<{ startTime: string } | null>(null);
    const [breakInConfirmation, setBreakInConfirmation] = useState<{ droppedItemIndex: number; targetItemIndex: number; newStartTime: string; newEndTime: string; } | null>(null);
    const [activeActionBlockIndex, setActiveActionBlockIndex] = useState<number | null>(null);
    const [copyButtonText, setCopyButtonText] = useState('Copy to Clipboard');
    const [scrollToTime, setScrollToTime] = useState<string | null>(null);

    // State for calendar drag-and-drop copy (DAY)
    const [draggedDateKey, setDraggedDateKey] = useState<string | null>(null);
    const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(null);
    const [copyLinks, setCopyLinks] = useState<{ [copiedDateKey: string]: string }>({});
    const [overrideConfirmation, setOverrideConfirmation] = useState<{ dragged: string; target: string } | null>(null);
    
    // State for calendar copy/paste (MONTH)
    const [copiedMonthKey, setCopiedMonthKey] = useState<string | null>(null);
    const [justCopiedMonthKey, setJustCopiedMonthKey] = useState<string | null>(null);
    const [monthPasteConfirmationKey, setMonthPasteConfirmationKey] = useState<string | null>(null);
    const [monthCopyLinks, setMonthCopyLinks] = useState<{ [copiedMonthKey: string]: string }>({});
    const [pastedMonthKey, setPastedMonthKey] = useState<string | null>(null);


    // State for Settings
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showCopyIndicators, setShowCopyIndicators] = useState(true);
    const [showTodayIndicator, setShowTodayIndicator] = useState(true);
    
    // State for the 5 Master Day templates
    const [masterDays, setMasterDays] = useState<MasterDay[]>([
        { id: 1, dateKey: null, color: 'bg-sky-500', name: 'Master 1', colorName: 'Blue' },
        { id: 2, dateKey: null, color: 'bg-yellow-400', name: 'Master 2', colorName: 'Yellow' },
        { id: 3, dateKey: null, color: 'bg-orange-500', name: 'Master 3', colorName: 'Orange' },
        { id: 4, dateKey: null, color: 'bg-green-500', name: 'Master 4', colorName: 'Green' },
        { id: 5, dateKey: null, color: 'bg-red-500', name: 'Master 5', colorName: 'Red' },
    ]);
    const [deletingMasterDayId, setDeletingMasterDayId] = useState<number | null>(null);
    
    // State for Activity Categories
    const [activityCategories, setActivityCategories] = useState<ActivityCategory[]>([
        { id: '1', name: 'Work', color: 'bg-red-500' },
        { id: '2', name: 'Rest', color: 'bg-blue-500' },
        { id: '3', name: 'Workout', color: 'bg-green-500' },
        { id: '4', name: 'Meeting', color: 'bg-orange-500' },
        { id: '5', name: 'Meal', color: 'bg-amber-500' },
        { id: '6', name: 'Errand', color: 'bg-purple-500' },
        { id: '7', name: 'Focus', color: 'bg-sky-500' },
        { id: '8', name: 'Uncategorized', color: 'bg-slate-600' },
    ]);

    const dateKey = formatDateKey(selectedDate);
    const currentSchedule = allSchedules[dateKey] || null;

    // Reset active block when the selected date changes
    useEffect(() => {
        setActiveActionBlockIndex(null);
    }, [selectedDate]);

    const handleGenerateSchedule = useCallback(async () => {
        if (!tasksInput.trim()) {
            setError("Please enter your tasks for the day.");
            return;
        }
        setActivity('generating');
        setError(null);
        setActiveActionBlockIndex(null); // Close any open action panels
        
        try {
            const result = await generateSchedule(tasksInput, selectedDate, activityCategories);
            // Auto-scroll only when a new schedule is generated
            if (result && result.length > 0) {
                setScrollToTime(result[0].startTime);
            }
            setAllSchedules(prev => ({ ...prev, [dateKey]: result }));
        } catch (e: unknown) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError("An unknown error occurred.");
            }
        } finally {
            setActivity('idle');
        }
    }, [tasksInput, selectedDate, dateKey, activityCategories]);
    
    const handleScrolled = useCallback(() => {
        setScrollToTime(null);
    }, []);

    const formatScheduleForCopy = useCallback(() => {
        if (!currentSchedule) return '';
        return currentSchedule.map(item =>
            `${item.startTime} - ${item.endTime} | ${item.title} (${item.category})`
        ).join('\n');
    }, [currentSchedule]);

    const handleCopy = useCallback(() => {
        const textToCopy = formatScheduleForCopy();
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy to Clipboard'), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            setCopyButtonText('Failed to copy');
            setTimeout(() => setCopyButtonText('Copy to Clipboard'), 2000);
        });
    }, [formatScheduleForCopy]);

    const handleBlockClick = (index: number) => {
        if (!currentSchedule) return;
        setEditingState({ item: currentSchedule[index], index });
    };
    
    const handleRequestDelete = (index: number) => {
        setDeletingItemIndex(index);
    };

    const handleConfirmDelete = () => {
        if (deletingItemIndex === null || !currentSchedule) return;
        
        const newDaySchedule = currentSchedule.filter((_, index) => index !== deletingItemIndex);
        
        // If the schedule is now empty, remove its "copied" link if it exists
        if (newDaySchedule.length === 0) {
            setCopyLinks(prev => {
                const newLinks = {...prev};
                if (newLinks[dateKey]) {
                    delete newLinks[dateKey];
                }
                return newLinks;
            });
        }
        
        setAllSchedules(prev => ({...prev, [dateKey]: newDaySchedule}));
        
        setDeletingItemIndex(null);
        setActiveActionBlockIndex(null); // Close panel after deletion
    };
    
    const handleCancelDelete = () => {
        setDeletingItemIndex(null);
    };


    const handleCloseModal = () => {
        setEditingState(null);
    };

    const handleSaveItem = (updatedItem: ScheduleItem) => {
        if (!editingState) return;
        
        const { index } = editingState;
        const daySchedule = currentSchedule || [];

        // Ensure color is consistent with the chosen category
        const matchingCategory = activityCategories.find(c => c.name === updatedItem.category);
        if (matchingCategory) {
            updatedItem.color = matchingCategory.color;
        }

        let newDaySchedule;
        
        if (index !== null) { // Editing existing item
            newDaySchedule = [...daySchedule];
            newDaySchedule[index] = updatedItem;
        } else { // Adding a new item
            newDaySchedule = [...daySchedule, updatedItem];
        }

        newDaySchedule.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        setAllSchedules(prev => ({...prev, [dateKey]: newDaySchedule}));
        
        setEditingState(null);
        setActiveActionBlockIndex(null); // Close panel after saving
    };
    
    const handleItemDrop = useCallback((droppedItemIndex: number, newStartTimeStr: string, newEndTimeStr: string, collidedWithIndex: number | null) => {
        if (!currentSchedule) return;

        // If dropped on another block, show confirmation
        if (collidedWithIndex !== null && collidedWithIndex !== droppedItemIndex) {
            setBreakInConfirmation({
                droppedItemIndex,
                targetItemIndex: collidedWithIndex,
                newStartTime: newStartTimeStr,
                newEndTime: newEndTimeStr
            });
            return;
        }

        let newDaySchedule = JSON.parse(JSON.stringify(currentSchedule)) as ScheduleItem[];
        
        const movedItem = newDaySchedule[droppedItemIndex];
        movedItem.startTime = newStartTimeStr;
        movedItem.endTime = newEndTimeStr;

        newDaySchedule.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        setAllSchedules(prev => ({ ...prev, [dateKey]: newDaySchedule }));
    }, [currentSchedule, dateKey]);

     const handleConfirmBreakIn = () => {
        if (!breakInConfirmation || !currentSchedule) return;

        const { droppedItemIndex, targetItemIndex, newStartTime, newEndTime } = breakInConfirmation;
        let schedule = JSON.parse(JSON.stringify(currentSchedule)) as ScheduleItem[];

        const droppedItem = schedule[droppedItemIndex];
        const targetItem = schedule[targetItemIndex];
        const originalTargetItem = { ...targetItem };

        const newStartMinutes = timeToMinutes(newStartTime);
        const newEndMinutes = timeToMinutes(newEndTime);
        const targetStartMinutes = timeToMinutes(originalTargetItem.startTime);
        const targetEndMinutes = timeToMinutes(originalTargetItem.endTime);

        // Update the dropped item's time
        droppedItem.startTime = newStartTime;
        droppedItem.endTime = newEndTime;
        
        const newBlocks: ScheduleItem[] = [];

        // Part 1: The portion of the target block *before* the new block
        if (newStartMinutes > targetStartMinutes) {
            const firstPart = { ...originalTargetItem, endTime: newStartTime };
            // only add if it has a meaningful duration
            if (timeToMinutes(firstPart.endTime) - timeToMinutes(firstPart.startTime) >= 5) {
                newBlocks.push(firstPart);
            }
        }
        
        // Part 2: The dropped block itself (will be handled by moving it)
        
        // Part 3: The portion of the target block *after* the new block
        if (targetEndMinutes > newEndMinutes) {
            const secondPart = { ...originalTargetItem, startTime: newEndTime };
             // only add if it has a meaningful duration
             if (timeToMinutes(secondPart.endTime) - timeToMinutes(secondPart.startTime) >= 5) {
                newBlocks.push(secondPart);
            }
        }

        // Remove the original target item, replace with the new pieces
        schedule.splice(targetItemIndex, 1, ...newBlocks);

        schedule.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        setAllSchedules(prev => ({ ...prev, [dateKey]: schedule }));
        setBreakInConfirmation(null);
    };

    const handleCancelBreakIn = () => {
        setBreakInConfirmation(null);
    };

    const handleBlockDurationChange = useCallback((itemIndex: number, durationDeltaMinutes: number) => {
        if (!currentSchedule) return;
    
        let newDaySchedule = JSON.parse(JSON.stringify(currentSchedule)) as ScheduleItem[];
        const targetItem = newDaySchedule[itemIndex];
    
        const startMinutes = timeToMinutes(targetItem.startTime);
        const endMinutes = timeToMinutes(targetItem.endTime);
        const currentDuration = endMinutes - startMinutes;
    
        const newDuration = Math.max(15, currentDuration + durationDeltaMinutes);
        const newEndMinutes = startMinutes + newDuration;
    
        targetItem.endTime = minutesToTime(newEndMinutes);
    
        for (let i = itemIndex + 1; i < newDaySchedule.length; i++) {
            const prevItem = newDaySchedule[i - 1];
            const currentItem = newDaySchedule[i];
    
            const prevItemEndMinutes = timeToMinutes(prevItem.endTime);
            const currentItemStartMinutes = timeToMinutes(currentItem.startTime);
    
            if (currentItemStartMinutes < prevItemEndMinutes) {
                const currentItemDuration = timeToMinutes(currentItem.endTime) - currentItemStartMinutes;
                const newCurrentItemStartMinutes = prevItemEndMinutes;
                const newCurrentItemEndMinutes = newCurrentItemStartMinutes + currentItemDuration;
    
                currentItem.startTime = minutesToTime(newCurrentItemStartMinutes);
                currentItem.endTime = minutesToTime(newCurrentItemEndMinutes);
            }
        }
    
        setAllSchedules(prev => ({ ...prev, [dateKey]: newDaySchedule }));
    }, [currentSchedule, dateKey]);

    const handleBlockResize = useCallback((index: number, newStartTime: string, newEndTime: string) => {
        if (!currentSchedule) return;
        
        const newDaySchedule = [...currentSchedule];
        const resizedItem = { ...newDaySchedule[index] }; // Create a new object for the item
        resizedItem.startTime = newStartTime;
        resizedItem.endTime = newEndTime;
        
        newDaySchedule[index] = resizedItem; // Replace the old item with the new one
        
        setAllSchedules(prev => ({ ...prev, [dateKey]: newDaySchedule }));
    }, [currentSchedule, dateKey]);
    
    const handleLongPressOnEmptySlot = useCallback((startTime: string) => {
        setNewBlockConfirmation({ startTime });
    }, []);
    
    const handleConfirmAddNewBlock = () => {
        if (!newBlockConfirmation) return;
        const startMinutes = timeToMinutes(newBlockConfirmation.startTime);
        
        const defaultCategory = activityCategories[0] || { name: 'Uncategorized', color: 'bg-slate-600' };

        const newItem: ScheduleItem = {
            startTime: newBlockConfirmation.startTime,
            endTime: minutesToTime(startMinutes + 60), // Default 1 hour
            title: 'New Task',
            category: defaultCategory.name,
            color: defaultCategory.color,
            notes: '',
        };

        setEditingState({ item: newItem, index: null }); // index is null for new items
        setNewBlockConfirmation(null);
    };
    
    const handleCancelAddNewBlock = () => {
        setNewBlockConfirmation(null);
    };

    // --- Refactored Day Clearing Logic ---
    const clearDayAndAssociatedLinks = useCallback((dateKeyToClear: string) => {
        // Clear the schedule itself.
        setAllSchedules(prev => {
            const newSchedules = { ...prev };
            newSchedules[dateKeyToClear] = []; // Setting to empty array effectively clears it.
            return newSchedules;
        });

        // If this day was a Master Day, unset it.
        setMasterDays(prev => 
            prev.map(md => 
                md.dateKey === dateKeyToClear ? { ...md, dateKey: null } : md
            )
        );

        // Update the copy links graph.
        setCopyLinks(prevLinks => {
            const newLinks = { ...prevLinks };
            // 1. If the cleared day was itself a copy, remove its incoming link.
            if (newLinks[dateKeyToClear]) {
                delete newLinks[dateKeyToClear];
            }
            // 2. Find all days that were copies OF the cleared day, and remove their links.
            const childrenOfClearedDay = Object.keys(newLinks).filter(key => newLinks[key] === dateKeyToClear);
            childrenOfClearedDay.forEach(childKey => {
                delete newLinks[childKey];
            });
            return newLinks;
        });
    }, []);


    // --- Calendar Day Clearing Handlers (double-click) ---
    const handleRequestClearDay = (dateKeyToClear: string) => {
        setClearingDateKey(dateKeyToClear);
    };

    const handleConfirmClearDay = () => {
        if (clearingDateKey) {
            clearDayAndAssociatedLinks(clearingDateKey);
            setClearingDateKey(null);
        }
    };

    const handleCancelClearDay = () => {
        setClearingDateKey(null);
    };

    // --- Master Day Deletion Handlers (from settings) ---
    const handleRequestDeleteMasterDay = (id: number) => {
        setDeletingMasterDayId(id);
    };
    
    const handleConfirmDeleteMasterDay = () => {
        if (deletingMasterDayId === null) return;
        const masterDayToDelete = masterDays.find(md => md.id === deletingMasterDayId);
        
        if (masterDayToDelete && masterDayToDelete.dateKey) {
            clearDayAndAssociatedLinks(masterDayToDelete.dateKey);
        }
        
        setDeletingMasterDayId(null);
    };

    const handleCancelDeleteMasterDay = () => {
        setDeletingMasterDayId(null);
    };


    // --- Calendar Day Drag-and-Drop Copy Handlers ---
    const handleDateDragStart = useCallback((dateKeyToDrag: string) => {
        // Only proceed if there's a schedule to drag
        if (!allSchedules[dateKeyToDrag] || allSchedules[dateKeyToDrag].length === 0) {
            return;
        }
    
        // Check if the dragged day is NOT already a copy and NOT already a master.
        const isCopy = !!copyLinks[dateKeyToDrag];
        const isMaster = masterDays.some(md => md.dateKey === dateKeyToDrag);
    
        if (!isCopy && !isMaster) {
            // It's a "free" day with a schedule, so let's make it a master.
            // Find the first available master day slot.
            const nextAvailableSlotIndex = masterDays.findIndex(md => md.dateKey === null);
            
            if (nextAvailableSlotIndex !== -1) {
                // An empty slot is available, assign this day to it.
                setMasterDays(prevMasterDays => {
                    const newMasterDays = [...prevMasterDays];
                    newMasterDays[nextAvailableSlotIndex] = {
                        ...newMasterDays[nextAvailableSlotIndex],
                        dateKey: dateKeyToDrag,
                    };
                    return newMasterDays;
                });
            }
            // If no slot is available, we can't make it a master, but the drag can still proceed.
        }
        
        // Original drag start logic
        setDraggedDateKey(dateKeyToDrag);
    }, [allSchedules, copyLinks, masterDays]);

    const handleDateDragOver = useCallback((e: React.DragEvent, dateKeyOver: string) => {
        e.preventDefault();
        if (draggedDateKey && draggedDateKey !== dateKeyOver) {
            if (dateKeyOver !== dropTargetDateKey) {
                setDropTargetDateKey(dateKeyOver);
                playCalendarTickSound();
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }
            }
        }
    }, [draggedDateKey, dropTargetDateKey]);

    const handleDateDragLeave = useCallback(() => {
        setDropTargetDateKey(null);
    }, []);

    const handleDateDrop = useCallback((targetDateKey: string) => {
        if (!draggedDateKey || draggedDateKey === targetDateKey) {
            setDraggedDateKey(null);
            setDropTargetDateKey(null);
            return;
        }
    
        const sourceSchedule = allSchedules[draggedDateKey];
        if (!sourceSchedule || sourceSchedule.length === 0) {
            setDraggedDateKey(null);
            setDropTargetDateKey(null);
            return;
        }
        
        const targetHasSchedule = allSchedules[targetDateKey] && allSchedules[targetDateKey].length > 0;
        const targetIsCopy = !!copyLinks[targetDateKey];
    
        // If target has a schedule AND it's a color-coded copy, ask for confirmation
        if (targetHasSchedule && targetIsCopy) {
            setOverrideConfirmation({ dragged: draggedDateKey, target: targetDateKey });
            // Don't clean up drag state here; modal handlers will do it.
            return;
        }
    
        // No confirmation needed, proceed with copy and cleanup.
        const copiedSchedule = JSON.parse(JSON.stringify(sourceSchedule));
        setAllSchedules(prev => ({ ...prev, [targetDateKey]: copiedSchedule }));
        
        const ultimateSourceKey = copyLinks[draggedDateKey] || draggedDateKey;
        setCopyLinks(prev => ({...prev, [targetDateKey]: ultimateSourceKey}));
    
        setDraggedDateKey(null);
        setDropTargetDateKey(null);
    }, [draggedDateKey, allSchedules, copyLinks]);

    const handleConfirmOverride = () => {
        if (!overrideConfirmation) return;
    
        const { dragged, target } = overrideConfirmation;
        const sourceSchedule = allSchedules[dragged];
        if (sourceSchedule) {
            const copiedSchedule = JSON.parse(JSON.stringify(sourceSchedule));
            setAllSchedules(prev => ({ ...prev, [target]: copiedSchedule }));
            
            const ultimateSourceKey = copyLinks[dragged] || dragged;
            setCopyLinks(prev => ({...prev, [target]: ultimateSourceKey}));
        }
    
        setOverrideConfirmation(null);
        setDraggedDateKey(null);
        setDropTargetDateKey(null);
    };
    
    const handleCancelOverride = () => {
        setOverrideConfirmation(null);
        setDraggedDateKey(null);
        setDropTargetDateKey(null);
    };

    const handleDateDragEnd = useCallback(() => {
        // This will only be called if a drop did NOT happen (e.g., user hits Esc or drops outside a valid target)
        // If a drop happens, the cleanup is handled in handleDateDrop or the override handlers.
        // We add a check to ensure we don't clear state while a confirmation modal is active.
        if (!overrideConfirmation) {
             setDraggedDateKey(null);
             setDropTargetDateKey(null);
        }
    }, [overrideConfirmation]);

    // --- Calendar Month Copy/Paste Handlers ---
    const handleCopyMonth = useCallback((monthKey: string) => {
        setCopiedMonthKey(monthKey);
        setJustCopiedMonthKey(monthKey); // Set which month was just copied
        setTimeout(() => setJustCopiedMonthKey(null), 2000); // Clear after 2 seconds
    }, []);

    const handleRequestPasteMonth = useCallback((monthKey: string) => {
        if (copiedMonthKey && copiedMonthKey !== monthKey) {
            setMonthPasteConfirmationKey(monthKey);
        }
    }, [copiedMonthKey]);

    const handleCancelPasteMonth = useCallback(() => {
        setMonthPasteConfirmationKey(null);
    }, []);

    const handleConfirmPasteMonth = useCallback(() => {
        if (!copiedMonthKey || !monthPasteConfirmationKey) return;

        const [destYear, destMonth] = monthPasteConfirmationKey.split('-').map(Number);
        
        let newSchedules = { ...allSchedules };
        let newCopyLinks = { ...copyLinks };

        // 1. Clear all schedules and copy links in the destination month
        const destKeysToRemove = Object.keys(allSchedules).filter(key => key.startsWith(monthPasteConfirmationKey));
        destKeysToRemove.forEach(key => {
            delete newSchedules[key];
            delete newCopyLinks[key]; // Also clear old copy links
        });

        // 2. Get source schedules to copy
        const sourceKeysToCopy = Object.keys(allSchedules).filter(key =>
            key.startsWith(copiedMonthKey) && allSchedules[key]?.length > 0
        );
        
        // 3. Find the first day of the destination month to calculate offsets
        const firstDayOfDestMonth = new Date(Date.UTC(destYear, destMonth - 1, 1));
        const firstDayOfWeekOfDestMonth = firstDayOfDestMonth.getUTCDay(); // 0 for Sunday

        // 4. Copy schedules from source to destination based on weekday occurrence
        sourceKeysToCopy.forEach(sourceKey => {
            const sourceDate = new Date(`${sourceKey}T12:00:00Z`); // Use midday UTC
            const sourceDay = sourceDate.getUTCDate();
            const sourceDayOfWeek = sourceDate.getUTCDay(); // 0=Sun, 6=Sat

            // Calculate which occurrence of the weekday this is (e.g., 1st Mon, 2nd Mon)
            const occurrence = Math.floor((sourceDay - 1) / 7) + 1;

            // Calculate the date of the first occurrence of this weekday in the destination month
            let dayDiff = sourceDayOfWeek - firstDayOfWeekOfDestMonth;
            if (dayDiff < 0) {
                dayDiff += 7;
            }
            const firstOccurrenceDate = 1 + dayDiff;

            // Calculate the date of the Nth occurrence
            const destDayOfMonth = firstOccurrenceDate + (occurrence - 1) * 7;

            // Create the destination date and check if it's valid for that month
            const destDate = new Date(Date.UTC(destYear, destMonth - 1, destDayOfMonth));

            // Only paste if the calculated date is within the destination month
            if (destDate.getUTCMonth() === destMonth - 1) {
                const destKey = formatDateKey(destDate);
                // Deep copy the schedule
                newSchedules[destKey] = JSON.parse(JSON.stringify(allSchedules[sourceKey]));
                // Find the ultimate source for this day. If it's a copy itself, trace back to the original master.
                const ultimateSourceKey = copyLinks[sourceKey] || sourceKey;
                newCopyLinks[destKey] = ultimateSourceKey;
            }
        });

        setAllSchedules(newSchedules);
        setCopyLinks(newCopyLinks); // Set the new day-level copy links
        setMonthCopyLinks(prev => ({ ...prev, [monthPasteConfirmationKey]: copiedMonthKey }));
        setPastedMonthKey(monthPasteConfirmationKey); // For temporary highlight
        setTimeout(() => setPastedMonthKey(null), 3000); // Clear highlight after 3 seconds
        setCopiedMonthKey(null);
        setMonthPasteConfirmationKey(null);
    }, [copiedMonthKey, monthPasteConfirmationKey, allSchedules, copyLinks]);

    // --- Settings Handlers ---
    const handleToggleSettings = () => {
        setIsSettingsOpen(prev => !prev);
    };

    const handleToggleCopyIndicators = () => {
        setShowCopyIndicators(prev => !prev);
    };

    const handleToggleTodayIndicator = () => {
        setShowTodayIndicator(prev => !prev);
    };
    
    // --- Activity Category Handlers ---
    const handleUpdateActivityCategory = (id: string, updates: Partial<ActivityCategory>) => {
        setActivityCategories(prev =>
            prev.map(cat => (cat.id === id ? { ...cat, ...updates } : cat))
        );
    };

    const handleDeleteActivityCategory = (id: string) => {
        setActivityCategories(prev => prev.filter(cat => cat.id !== id));
    };

    const handleAddActivityCategory = () => {
        const newCategory: ActivityCategory = {
            id: `${Date.now()}`,
            name: 'New Category',
            color: 'bg-slate-500',
        };
        setActivityCategories(prev => [...prev, newCategory]);
    };

    const isLoading = activity !== 'idle';

    return (
        <div className="min-h-screen bg-slate-900 font-sans">
            <Header onToggleSettings={handleToggleSettings} />
            <main className="container mx-auto p-4 md:p-8">
                <div className="flex flex-col md:flex-row gap-8">
                    
                    {/* --- Left Column: Controls --- */}
                    <div className="w-full md:w-96 flex-shrink-0 space-y-8">
                        {/* Generate Schedule Card */}
                        <div className="bg-slate-800/50 rounded-lg p-6 shadow-lg">
                            <label htmlFor="task-input" className="block text-lg font-medium text-slate-300 mb-2">
                                What's on your plate?
                            </label>
                            <p className="text-sm text-slate-500 mb-4">
                                List tasks with durations. E.g., "Team meeting (1h, 10am), Lunch (30m), Write proposal (3h)".
                            </p>
                            <textarea
                                id="task-input"
                                rows={5}
                                value={tasksInput}
                                onChange={(e) => setTasksInput(e.target.value)}
                                placeholder="My workday is from 9am to 5pm. I need to..."
                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors duration-200 text-slate-200"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleGenerateSchedule}
                                disabled={isLoading}
                                className="w-full mt-4 px-6 py-3 text-lg font-bold text-white bg-sky-600 rounded-md hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                {activity === 'generating' ? 'Generating...' : 'Plan My Day'}
                            </button>
                        </div>
                        
                        {/* Calendar */}
                        <DateTabs 
                            selectedDate={selectedDate} 
                            onDateChange={setSelectedDate}
                            allSchedules={allSchedules}
                            // Day copy props
                            draggedDateKey={draggedDateKey}
                            dropTargetDateKey={dropTargetDateKey}
                            onDateDragStart={handleDateDragStart}
                            onDateDragOver={handleDateDragOver}
                            onDateDragLeave={handleDateDragLeave}
                            onDateDrop={handleDateDrop}
                            onDateDragEnd={handleDateDragEnd}
                            onDayDoubleClick={handleRequestClearDay}
                            copyLinks={copyLinks}
                            // Month copy props
                            copiedMonthKey={copiedMonthKey}
                            justCopiedMonthKey={justCopiedMonthKey}
                            monthCopyLinks={monthCopyLinks}
                            pastedMonthKey={pastedMonthKey}
                            onCopyMonth={handleCopyMonth}
                            onRequestPasteMonth={handleRequestPasteMonth}
                            // Settings props
                            showCopyIndicators={showCopyIndicators}
                            showTodayIndicator={showTodayIndicator}
                            masterDays={masterDays}
                        />
                    </div>

                    {/* --- Right Column: Schedule Display --- */}
                    <div className="flex-grow min-w-0">
                         <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-slate-200">
                                Schedule for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </h2>
                            {currentSchedule && currentSchedule.length > 0 && (
                                <button
                                    onClick={handleCopy}
                                    className="px-4 py-2 text-sm font-semibold text-sky-300 bg-sky-900/50 rounded-md hover:bg-sky-800/50 transition-colors duration-200"
                                >
                                    {copyButtonText}
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="my-4 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-md">
                                <p><strong>Oops! Something went wrong.</strong></p>
                                <p className="text-sm">{error}</p>
                            </div>
                        )}
                        
                        <div className="relative">
                            {activity === 'generating' && <LoadingSpinner />}
                            
                            {activity !== 'generating' && currentSchedule && currentSchedule.length > 0 && (
                                <ScheduleDisplay 
                                    schedule={currentSchedule} 
                                    onBlockClick={handleBlockClick}
                                    onBlockDelete={handleRequestDelete}
                                    onItemDrop={handleItemDrop}
                                    onExtendBlock={(index) => handleBlockDurationChange(index, 60)}
                                    onShortenBlock={(index) => handleBlockDurationChange(index, -60)}
                                    onLongPressEmptySlot={handleLongPressOnEmptySlot}
                                    onBlockResize={handleBlockResize}
                                    activeActionBlockIndex={activeActionBlockIndex}
                                    onSetActiveActionBlockIndex={setActiveActionBlockIndex}
                                    scrollToTime={scrollToTime}
                                    onScrolled={handleScrolled}
                                />
                            )}
                            
                            {activity !== 'generating' && (!currentSchedule || currentSchedule.length === 0) && (
                                <div className="text-center mt-4 p-8 bg-slate-800/50 rounded-lg h-96 flex flex-col justify-center">
                                    <p className="text-slate-400 font-medium">Nothing scheduled for this day.</p>
                                    <p className="text-slate-500 text-sm mt-1">Use the controls on the left to plan your day.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <SettingsPanel 
                    isOpen={isSettingsOpen}
                    onClose={handleToggleSettings}
                    showCopyIndicators={showCopyIndicators}
                    onToggleCopyIndicators={handleToggleCopyIndicators}
                    showTodayIndicator={showTodayIndicator}
                    onToggleTodayIndicator={handleToggleTodayIndicator}
                    masterDays={masterDays}
                    onRequestDeleteMasterDay={handleRequestDeleteMasterDay}
                    activityCategories={activityCategories}
                    onUpdateActivityCategory={handleUpdateActivityCategory}
                    onDeleteActivityCategory={handleDeleteActivityCategory}
                    onAddActivityCategory={handleAddActivityCategory}
                />
                 
                {editingState && (
                    <EditModal
                        item={editingState.item}
                        onSave={handleSaveItem}
                        onClose={handleCloseModal}
                        activityCategories={activityCategories}
                        onDeleteRequest={editingState.index !== null ? () => {
                            if (editingState.index === null) return;
                            handleRequestDelete(editingState.index);
                            handleCloseModal();
                        } : undefined}
                    />
                )}

                {deletingItemIndex !== null && currentSchedule && (
                    <ConfirmationModal
                        isOpen={deletingItemIndex !== null}
                        title="Confirm Deletion"
                        message={`Are you sure you want to delete "${currentSchedule[deletingItemIndex].title}"? This action cannot be undone.`}
                        onConfirm={handleConfirmDelete}
                        onCancel={handleCancelDelete}
                        confirmText="Yes, Delete"
                        cancelText="No, Cancel"
                    />
                )}
                 
                {clearingDateKey && (
                     <ConfirmationModal
                        isOpen={!!clearingDateKey}
                        title="Clear Entire Day?"
                        message={`Are you sure you want to delete all events for ${new Date(clearingDateKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}? This will also clear any template status and unlink all copies.`}
                        onConfirm={handleConfirmClearDay}
                        onCancel={handleCancelClearDay}
                        confirmText="Yes, Clear Day"
                        cancelText="Cancel"
                    />
                )}
                    
                {breakInConfirmation && currentSchedule && (
                    <ConfirmationModal
                        isOpen={!!breakInConfirmation}
                        title="Modify Schedule?"
                        message={`Are you sure you want to place this block here? It will adjust "${currentSchedule[breakInConfirmation.targetItemIndex].title}".`}
                        onConfirm={handleConfirmBreakIn}
                        onCancel={handleCancelBreakIn}
                        confirmText="Yes, Adjust"
                        cancelText="Cancel"
                        confirmColorClass="bg-sky-600 hover:bg-sky-500"
                    />
                )}

                {newBlockConfirmation && (
                        <ConfirmationModal
                        isOpen={!!newBlockConfirmation}
                        title="Add A Time Blox?"
                        message={`Do you want to add a new time block at ${newBlockConfirmation.startTime}?`}
                        onConfirm={handleConfirmAddNewBlock}
                        onCancel={handleCancelAddNewBlock}
                        confirmText="Yes, Add"
                        cancelText="Cancel"
                        confirmColorClass="bg-sky-600 hover:bg-sky-500"
                    />
                )}

                {monthPasteConfirmationKey && copiedMonthKey && (
                     <ConfirmationModal
                        isOpen={!!monthPasteConfirmationKey}
                        title="Paste Month Schedule?"
                        message={`Paste the schedule from ${formatMonthKeyToFriendlyName(copiedMonthKey)} to ${formatMonthKeyToFriendlyName(monthPasteConfirmationKey)}? This will override all existing events in the destination month.`}
                        onConfirm={handleConfirmPasteMonth}
                        onCancel={handleCancelPasteMonth}
                        confirmText="Yes, Paste & Override"
                        cancelText="Cancel"
                        confirmColorClass="bg-sky-600 hover:bg-sky-500"
                    />
                )}
                
                {deletingMasterDayId !== null && (
                     <ConfirmationModal
                        isOpen={deletingMasterDayId !== null}
                        title="Delete Master Template?"
                        message={`Are you sure you want to delete this master template? The schedule for this day will be cleared and all copies will be unlinked.`}
                        onConfirm={handleConfirmDeleteMasterDay}
                        onCancel={handleCancelDeleteMasterDay}
                        confirmText="Yes, Delete"
                        cancelText="Cancel"
                    />
                )}

                {overrideConfirmation && (
                    <ConfirmationModal
                        isOpen={!!overrideConfirmation}
                        title="Override Schedule?"
                        message={`This day already has a color-coded schedule. Are you sure you want to override it?`}
                        onConfirm={handleConfirmOverride}
                        onCancel={handleCancelOverride}
                        confirmText="Yes, Override"
                        cancelText="Cancel"
                        confirmColorClass="bg-orange-600 hover:bg-orange-500"
                    />
                )}
            </main>
            <footer className="text-center py-4 mt-8 text-slate-600 text-sm border-t border-slate-800">
                <p>Powered by Gemini API</p>
            </footer>
        </div>
    );
};

export default App;