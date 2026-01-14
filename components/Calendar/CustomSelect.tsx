import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CustomSelectProps {
    value: number | string;
    options: { label: string; value: number | string }[];
    onChange: (value: any) => void;
    className?: string;
    placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    options,
    onChange,
    className = '',
    placeholder = 'Select'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center justify-center gap-0.5 min-w-fit px-0.5 @xs:px-1 @sm:px-2 py-0.5 @xs:py-1 @sm:py-1.5
          rounded-md @sm:rounded-lg transition-all duration-200 group
          ${isOpen ? 'bg-gray-100 text-[#081429]' : 'hover:bg-gray-100 text-[#373d41]'}
          ${className}
        `}
            >
                <span className={`font-extrabold text-[10px] @xs:text-xs @sm:text-sm tracking-tight group-hover:text-[#fdb813] transition-colors`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown
                    size={12}
                    strokeWidth={3}
                    className={`text-gray-300 transition-transform duration-200 group-hover:text-[#fdb813] @xs:w-3 @xs:h-3 @sm:w-4 @sm:h-4 ${isOpen ? 'rotate-180 text-[#fdb813]' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 min-w-[120px] mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-80 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150 p-2 scrollbar-hide">
                    <div className="flex flex-col gap-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`
                  flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap
                  ${option.value === value
                                        ? 'bg-[#fdb813]/10 text-[#081429]'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-[#081429]'}
                `}
                            >
                                {option.label}
                                {option.value === value && <Check size={14} className="text-[#fdb813]" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
