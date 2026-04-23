import clsx from 'clsx'

import type { VersionTreeNode } from '../types/api'

interface VersionTreeProps {
  nodes: VersionTreeNode[]
  selectedVersionId: string | null
  onSelect: (versionId: string) => void
}

function VersionTreeNodeView({
  node,
  selectedVersionId,
  onSelect,
}: {
  node: VersionTreeNode
  selectedVersionId: string | null
  onSelect: (versionId: string) => void
}) {
  return (
    <li>
      <button
        className={clsx('tree-node', { selected: selectedVersionId === node.id })}
        onClick={() => onSelect(node.id)}
      >
        <span className="tree-thumb">
          <img src={node.file_url} alt={node.prompt_summary ?? node.file_name} />
        </span>
        <span className="tree-copy">
          <span className="tree-title">{node.prompt_summary ?? node.file_name}</span>
          <small>
            {node.is_current_final ? '定稿' : node.origin_type}
            {' · '}
            {new Date(node.created_at).toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </small>
        </span>
      </button>
      {node.children.length > 0 ? (
        <ul className="tree-children">
          {node.children.map((child) => (
            <VersionTreeNodeView
              key={child.id}
              node={child}
              selectedVersionId={selectedVersionId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function VersionTree({ nodes, selectedVersionId, onSelect }: VersionTreeProps) {
  if (!nodes.length) {
    return <div className="empty-mini-card">还没有版本历史。</div>
  }

  return (
    <ul className="version-tree">
      {nodes.map((node) => (
        <VersionTreeNodeView
          key={node.id}
          node={node}
          selectedVersionId={selectedVersionId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  )
}
