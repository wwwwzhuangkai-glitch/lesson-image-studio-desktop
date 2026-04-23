import { useState } from 'react'

import type { PromptPreset } from '../types/api'

interface PresetCardProps {
  preset: PromptPreset
  onApply: () => void
  applyDisabled?: boolean
  applyDisabledHint?: string
  onClone?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onSaveCurrent?: () => void
}

export function PresetCard({
  preset,
  onApply,
  applyDisabled,
  applyDisabledHint,
  onClone,
  onEdit,
  onDelete,
  onSaveCurrent,
}: PresetCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className="preset-card">
      <div className="preset-card-top">
        <div>
          <strong>{preset.name}</strong>
          <p>{preset.summary}</p>
        </div>
        <button className="ghost-button small" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded ? <pre className="preset-prompt">{preset.prompt_text}</pre> : null}

      <div className="button-row">
        <button
          className="ghost-button small"
          onClick={onApply}
          disabled={applyDisabled}
          title={applyDisabled ? applyDisabledHint : undefined}
        >
          载入
        </button>
        {onClone ? (
          <button className="ghost-button small" onClick={onClone}>
            复制到个人模板
          </button>
        ) : null}
        {onSaveCurrent ? (
          <button className="ghost-button small" onClick={onSaveCurrent}>
            保存当前提示词
          </button>
        ) : null}
        {onEdit ? (
          <button className="ghost-button small" onClick={onEdit}>
            编辑
          </button>
        ) : null}
        {onDelete ? (
          <button className="ghost-button small danger" onClick={onDelete}>
            删除
          </button>
        ) : null}
      </div>
    </article>
  )
}
