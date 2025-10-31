import React from 'react';
import { ScheduleItem } from '../types';

interface DragPreviewBlockProps {
    item: ScheduleItem;
    style: React.CSSProperties;
    startTime: string;
    endTime: string;
}

const DragPreviewBlock: React.FC<DragPreviewBlockProps> = ({ item, style, startTime, endTime }) => {
    return (
        <div
            style={style}
            className={`absolute left-14 md:left-20 right-0 rounded-lg p-2 md:p-3 flex flex-col justify-start text-white shadow-2xl pointer-events-none z-30 ring-2 ring-white ring-offset-2 ring-offset-slate-900 ${item.color}`}
        >
            <div className="flex-grow">
                <p className="font-bold text-sm md:text-base leading-tight">{item.title}</p>
                <p className="font-mono text-xs text-white/80">{startTime} - {endTime}</p>
            </div>
            <div className="mt-2 text-xs">
                <span className="inline-block px-2 py-0.5 font-medium rounded-full bg-black/20">
                    {item.category}
                </span>
                {item.notes && <p className="text-white/70 italic truncate mt-1">{item.notes}</p>}
            </div>
        </div>
    );
};

export default DragPreviewBlock;