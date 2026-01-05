import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

interface WeekdayOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentOrder: string[];
    allWeekdays: string[];
    onSave: (newOrder: string[]) => void;
}

interface SortableItemProps {
    id: string;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
}

const WEEKDAY_LABELS: Record<string, string> = {
    '월': '월요일',
    '화': '화요일',
    '수': '수요일',
    '목': '목요일',
    '금': '금요일',
    '토': '토요일',
    '일': '일요일',
};

const SortableItem = ({ id, onMoveUp, onMoveDown, isFirst, isLast }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between p-2 bg-white border rounded mb-1.5 shadow-sm group hover:border-green-300 transition-colors">
            <div className="flex items-center gap-2 flex-1">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1">
                    <GripVertical size={16} />
                </div>
                <span className="font-medium text-gray-700 select-none">{WEEKDAY_LABELS[id] || id}</span>
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={onMoveUp}
                    disabled={isFirst}
                    className={`p-1 rounded hover:bg-gray-100 ${isFirst ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:text-green-600'}`}
                >
                    <ChevronUp size={16} />
                </button>
                <button
                    onClick={onMoveDown}
                    disabled={isLast}
                    className={`p-1 rounded hover:bg-gray-100 ${isLast ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:text-green-600'}`}
                >
                    <ChevronDown size={16} />
                </button>
            </div>
        </div>
    );
};

const WeekdayOrderModal: React.FC<WeekdayOrderModalProps> = ({ isOpen, onClose, currentOrder, allWeekdays, onSave }) => {
    const [items, setItems] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Merge currentOrder with any new weekdays not in the list
            const combined = [...currentOrder];
            allWeekdays.forEach(d => {
                if (!combined.includes(d)) {
                    combined.push(d);
                }
            });
            // Remove any weekdays that no longer exist
            const filtered = combined.filter(d => allWeekdays.includes(d));
            setItems(filtered);
        }
    }, [isOpen, currentOrder, allWeekdays]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleMoveUp = (index: number) => {
        if (index > 0) {
            setItems(prev => arrayMove(prev, index, index - 1));
        }
    };

    const handleMoveDown = (index: number) => {
        if (index < items.length - 1) {
            setItems(prev => arrayMove(prev, index, index + 1));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(items);
        setIsSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-[400px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b bg-green-700 text-white rounded-t-lg">
                    <h2 className="text-base font-bold">요일 순서 설정</h2>
                    <button onClick={onClose} className="text-green-200 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={items}
                            strategy={verticalListSortingStrategy}
                        >
                            {items.map((id, index) => (
                                <SortableItem
                                    key={id}
                                    id={id}
                                    onMoveUp={() => handleMoveUp(index)}
                                    onMoveDown={() => handleMoveDown(index)}
                                    isFirst={index === 0}
                                    isLast={index === items.length - 1}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="p-4 border-t bg-white rounded-b-lg flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold text-sm transition-colors disabled:opacity-50"
                    >
                        {isSaving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WeekdayOrderModal;
