import React, { useState, useEffect } from 'react';
import { ScheduleItem, ActivityCategory } from '../types';

interface EditModalProps {
    item: ScheduleItem;
    onSave: (item: ScheduleItem) => void;
    onClose: () => void;
    activityCategories: ActivityCategory[];
    onDeleteRequest?: () => void;
}

const EditModal: React.FC<EditModalProps> = ({ item, onSave, onClose, activityCategories, onDeleteRequest }) => {
    const [editedItem, setEditedItem] = useState<ScheduleItem>(item);

    useEffect(() => {
        setEditedItem(item);
    }, [item]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setEditedItem(prev => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedCategoryName = e.target.value;
        const selectedCategory = activityCategories.find(cat => cat.name === selectedCategoryName);
        if (selectedCategory) {
            setEditedItem(prev => ({
                ...prev,
                category: selectedCategory.name,
                color: selectedCategory.color,
            }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(editedItem);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-md p-6 border border-slate-700"
                onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
            >
                <h2 className="text-2xl font-bold mb-4 text-slate-200">Edit Task</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-slate-400">Title</label>
                        <input
                            type="text"
                            name="title"
                            id="title"
                            value={editedItem.title}
                            onChange={handleFormChange}
                            className="mt-1 w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label htmlFor="startTime" className="block text-sm font-medium text-slate-400">Start Time</label>
                            <input
                                type="text"
                                name="startTime"
                                id="startTime"
                                value={editedItem.startTime}
                                onChange={handleFormChange}
                                className="mt-1 w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="endTime" className="block text-sm font-medium text-slate-400">End Time</label>
                            <input
                                type="text"
                                name="endTime"
                                id="endTime"
                                value={editedItem.endTime}
                                onChange={handleFormChange}
                                className="mt-1 w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="category" className="block text-sm font-medium text-slate-400">Category</label>
                        <div className="mt-1 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-md ${editedItem.color} ring-1 ring-slate-500 flex-shrink-0`}></div>
                            <select
                                name="category"
                                id="category"
                                value={editedItem.category}
                                onChange={handleCategoryChange}
                                className="w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500"
                            >
                                {/* If the current item's category doesn't exist in the list, add it as a disabled option */}
                                {!activityCategories.some(cat => cat.name === editedItem.category) && (
                                    <option value={editedItem.category} disabled>{editedItem.category} (deleted)</option>
                                )}
                                {activityCategories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-slate-400">Notes</label>
                        <textarea
                            name="notes"
                            id="notes"
                            value={editedItem.notes || ''}
                            onChange={handleFormChange}
                            rows={2}
                            className="mt-1 w-full p-2 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                    <div className="flex justify-between items-center gap-3 pt-4">
                        <div>
                             {onDeleteRequest && (
                                <button
                                    type="button"
                                    onClick={onDeleteRequest}
                                    className="px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-900/50 rounded-md transition-colors"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-semibold text-slate-300 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-md hover:bg-sky-500 transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditModal;
