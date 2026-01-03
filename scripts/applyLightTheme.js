import fs from 'fs';

const files = [
    'f:/ijw-calander/components/Gantt/GanttBuilder.tsx',
    'f:/ijw-calander/components/Gantt/GanttChart.tsx',
    'f:/ijw-calander/components/Gantt/GanttTemplateSelector.tsx',
    'f:/ijw-calander/components/Gantt/GanttTaskList.tsx',
    'f:/ijw-calander/components/Gantt/GanttProgressBar.tsx'
];

const replacements = [
    [/bg-\[#15171e\]/g, 'bg-white'],
    [/bg-\[#1c202b\]/g, 'bg-gray-50'],
    [/bg-\[#252a38\]/g, 'bg-white'],
    [/bg-\[#0f1115\]/g, 'bg-gray-50'],
    [/bg-\[#0d0f14\]/g, 'bg-white'],
    [/text-slate-300/g, 'text-gray-700'],
    [/text-slate-400/g, 'text-gray-500'],
    [/text-slate-500/g, 'text-gray-400'],
    [/border-white\/5/g, 'border-gray-200'],
    [/border-white\/10/g, 'border-gray-200'],
    [/hover:bg-white\/5/g, 'hover:bg-gray-100'],
    [/placeholder-slate-500/g, 'placeholder-gray-400'],
    [/text-white(?=['"\s>])/g, 'text-gray-800'],
];

files.forEach(filePath => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalLines = content.split('\n').length;

        replacements.forEach(([pattern, replacement]) => {
            content = content.replace(pattern, replacement);
        });

        fs.writeFileSync(filePath, content, 'utf8');
        const newLines = content.split('\n').length;
        console.log(`Updated ${filePath.split('/').pop()}: ${originalLines} -> ${newLines} lines`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
    }
});

console.log('Light theme conversion complete!');
