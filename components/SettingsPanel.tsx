import React, { useState } from 'react';
import { MasterDay, ActivityCategory } from '../types';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    showCopyIndicators: boolean;
    onToggleCopyIndicators: () => void;
    showTodayIndicator: boolean;
    onToggleTodayIndicator: () => void;
    masterDays: MasterDay[];
    onRequestDeleteMasterDay: (id: number) => void;
    activityCategories: ActivityCategory[];
    onUpdateActivityCategory: (id: string, updates: Partial<ActivityCategory>) => void;
    onDeleteActivityCategory: (id: string) => void;
    onAddActivityCategory: () => void;
}

const COLOR_PALETTE = [
    'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
    'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 
    'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 
    'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
    'bg-pink-500', 'bg-rose-500'
];


const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    isOpen, 
    onClose, 
    showCopyIndicators, 
    onToggleCopyIndicators,
    showTodayIndicator,
    onToggleTodayIndicator,
    masterDays,
    onRequestDeleteMasterDay,
    activityCategories,
    onUpdateActivityCategory,
    onDeleteActivityCategory,
    onAddActivityCategory
}) => {
    const [isMasterDaySectionOpen, setIsMasterDaySectionOpen] = useState(false);
    const [isCalendarSectionOpen, setIsCalendarSectionOpen] = useState(false);
    const [isCategorySectionOpen, setIsCategorySectionOpen] = useState(false);
    const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex justify-end"
            onClick={() => {
                setActiveColorPickerId(null);
                onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
        >
            <div 
                className="w-full max-w-sm h-full bg-slate-800 shadow-2xl border-l border-slate-700 flex flex-col"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside panel
            >
                {/* Panel Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 id="settings-title" className="text-xl font-bold text-slate-200">Settings</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors"
                        aria-label="Close settings panel"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Panel Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="space-y-6">
                         {/* Activity Category Settings */}
                         <div>
                            <button 
                                className="w-full flex items-center justify-between text-lg font-semibold text-slate-300 mb-3"
                                onClick={() => setIsCategorySectionOpen(prev => !prev)}
                                aria-expanded={isCategorySectionOpen}
                            >
                                <span>Activity Categories</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-5 h-5 transition-transform duration-300 ${isCategorySectionOpen ? 'rotate-180' : ''}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                             <div className={`grid transition-all duration-300 ease-in-out ${isCategorySectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    <div className="space-y-2">
                                        {activityCategories.map(cat => (
                                            <div key={cat.id} className="relative flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                                                <div className="relative">
                                                    <button 
                                                        className={`w-6 h-6 rounded-md ${cat.color} ring-2 ring-slate-600 hover:opacity-80 transition-opacity`}
                                                        onClick={() => setActiveColorPickerId(activeColorPickerId === cat.id ? null : cat.id)}
                                                    />
                                                    {activeColorPickerId === cat.id && (
                                                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-10 bg-slate-700 p-2 rounded-lg shadow-lg grid grid-cols-6 gap-2 w-48">
                                                            {COLOR_PALETTE.map(color => (
                                                                <button
                                                                    key={color}
                                                                    className={`w-6 h-6 rounded-md ${color} ring-1 ring-black/20 hover:ring-white transition-all`}
                                                                    onClick={() => {
                                                                        onUpdateActivityCategory(cat.id, { color });
                                                                        setActiveColorPickerId(null);
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={cat.name}
                                                    onChange={(e) => onUpdateActivityCategory(cat.id, { name: e.target.value })}
                                                    className="flex-grow bg-transparent text-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-2 py-1"
                                                />
                                                <button 
                                                    onClick={() => onDeleteActivityCategory(cat.id)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/50 rounded-full transition-colors"
                                                    title={`Delete ${cat.name} category`}
                                                >
                                                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={onAddActivityCategory}
                                        className="w-full mt-3 px-3 py-2 text-sm font-semibold text-sky-300 bg-sky-900/50 rounded-md hover:bg-sky-800/50 transition-colors"
                                    >
                                        Add New Category
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <hr className="border-slate-700/50" />

                        {/* Master Day Settings */}
                        <div>
                            <button 
                                className="w-full flex items-center justify-between text-lg font-semibold text-slate-300 mb-3"
                                onClick={() => setIsMasterDaySectionOpen(prev => !prev)}
                                aria-expanded={isMasterDaySectionOpen}
                            >
                                <span>Master Day Templates</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-5 h-5 transition-transform duration-300 ${isMasterDaySectionOpen ? 'rotate-180' : ''}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                             <div className={`grid transition-all duration-300 ease-in-out ${isMasterDaySectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    <div className="space-y-3">
                                        {masterDays.map(md => (
                                            <div key={md.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-4 h-4 rounded-full ${md.color}`}></span>
                                                    <span className="text-slate-300 text-sm">
                                                        {md.name} ({md.colorName})
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-slate-700 text-slate-300 text-sm font-mono rounded border border-slate-600 p-1 w-32 h-[28px] flex items-center justify-center">
                                                        {md.dateKey 
                                                            ? new Date(md.dateKey + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) 
                                                            : <span className="text-slate-500">Empty</span>
                                                        }
                                                    </div>
                                                    {md.dateKey && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onRequestDeleteMasterDay(md.id); }}
                                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-900/50 rounded-full transition-colors"
                                                            title={`Clear Master Day ${md.id} template`}
                                                        >
                                                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 px-1">
                                        Drag a day on the calendar to make it a Master. Double-click or use the trash icon to clear it.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Divider */}
                        <hr className="border-slate-700/50" />

                        {/* Calendar Settings */}
                        <div>
                             <button 
                                className="w-full flex items-center justify-between text-lg font-semibold text-slate-300 mb-3"
                                onClick={() => setIsCalendarSectionOpen(prev => !prev)}
                                aria-expanded={isCalendarSectionOpen}
                            >
                                <span>Calendar Display</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-5 h-5 transition-transform duration-300 ${isCalendarSectionOpen ? 'rotate-180' : ''}`}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                            <div className={`grid transition-all duration-300 ease-in-out ${isCalendarSectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden">
                                    <div className="space-y-3">
                                        {/* Copy Indicators Setting */}
                                        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                                            <label htmlFor="copy-indicators-toggle" className="text-slate-300 cursor-pointer text-sm">
                                                Show Copy/Paste Lines
                                            </label>
                                            
                                            {/* Custom Toggle Switch */}
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    id="copy-indicators-toggle"
                                                    className="sr-only peer" 
                                                    checked={showCopyIndicators}
                                                    onChange={onToggleCopyIndicators}
                                                />
                                                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-500/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                                            </label>
                                        </div>

                                        {/* Today Indicator Setting */}
                                        <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                                            <label htmlFor="today-indicator-toggle" className="text-slate-300 cursor-pointer text-sm">
                                                Highlight Today's Date
                                            </label>
                                            
                                            {/* Custom Toggle Switch */}
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    id="today-indicator-toggle"
                                                    className="sr-only peer" 
                                                    checked={showTodayIndicator}
                                                    onChange={onToggleTodayIndicator}
                                                />
                                                <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-sky-500/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 px-1">
                                        Customize visual helpers on the calendar grid.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;