import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';
import type { ConversationFlowNode } from '../../types';

interface ConversationFlowTreeProps {
  flow: ConversationFlowNode[];
}

function TreeNode({ node, depth = 0 }: { node: ConversationFlowNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  // 깊이별 색상
  const colors = [
    'border-accent-400 bg-accent-50',
    'border-blue-300 bg-blue-50',
    'border-emerald-300 bg-emerald-50',
    'border-amber-300 bg-amber-50',
    'border-purple-300 bg-purple-50',
  ];
  const colorClass = colors[depth % colors.length];

  return (
    <div className={depth > 0 ? 'ml-5 relative' : ''}>
      {/* 수직 연결선 */}
      {depth > 0 && (
        <div className="absolute left-[-12px] top-0 bottom-0 w-px bg-gray-200" />
      )}
      {/* 수평 연결선 */}
      {depth > 0 && (
        <div className="absolute left-[-12px] top-[18px] w-3 h-px bg-gray-200" />
      )}

      <div className={`border-l-3 rounded-sm px-3 py-2 my-1.5 ${colorClass}`}>
        <div className="flex items-start gap-2">
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 flex-shrink-0 p-0.5 hover:bg-white/50 rounded"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <MessageCircle size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
          )}
          <div className="min-w-0">
            <span className="text-sm font-semibold text-gray-800">{node.topic}</span>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{node.summary}</p>
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ConversationFlowTree({ flow }: ConversationFlowTreeProps) {
  if (!flow || flow.length === 0) return null;

  return (
    <div className="space-y-1">
      {flow.map((node, i) => (
        <TreeNode key={i} node={node} depth={0} />
      ))}
    </div>
  );
}
