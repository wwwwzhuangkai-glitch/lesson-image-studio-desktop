import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva'

import { useImageElement } from '../hooks/useImageElement'
import { useTheme } from '../hooks/useTheme'

interface RectGeometry {
  x: number
  y: number
  width: number
  height: number
}

interface CanvasWorkbenchProps {
  baseImageUrl: string | null
  resultImageUrl?: string | null
  resultEmptyLabel?: string
  selection: RectGeometry | null
  onSelectionChange: (next: RectGeometry | null) => void
  enableSelection: boolean
  onSelectionModeChange: (next: boolean) => void
}

type BackgroundMode = 'checker' | 'solid'

export function CanvasWorkbench({
  baseImageUrl,
  resultImageUrl,
  resultEmptyLabel = '还没有基于当前版本的结果图。',
  selection,
  onSelectionChange,
  enableSelection,
  onSelectionModeChange,
}: CanvasWorkbenchProps) {
  const image = useImageElement(baseImageUrl)
  const [draft, setDraft] = useState<RectGeometry | null>(null)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [showSelection, setShowSelection] = useState(true)
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('checker')
  const { themeMode, themeVariant } = useTheme()
  const accent = useMemo(() => {
    if (typeof window === 'undefined') return '#2b6cb0'
    const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    return value || '#2b6cb0'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode, themeVariant])
  const accentFill = useMemo(() => {
    if (typeof window === 'undefined') return 'rgba(43,108,176,0.12)'
    const soft = getComputedStyle(document.documentElement).getPropertyValue('--accent-soft').trim()
    return soft || 'rgba(43,108,176,0.12)'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode, themeVariant])

  const dimensions = useMemo(() => {
    if (!image) {
      return null
    }
    const maxWidth = 620
    const maxHeight = 430
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
    return {
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
      scale,
    }
  }, [image])

  const activeRect = showSelection ? draft ?? selection : null
  const toggleBackground = () => setBackgroundMode((value) => (value === 'checker' ? 'solid' : 'checker'))

  if (!image || !dimensions) {
    return (
      <div className="dual-image-workbench">
        <ImagePane title="基准图" backgroundMode={backgroundMode} onToggleBackground={toggleBackground}>
          <div className="canvas-empty compact">
            <p>左栏选中版本后会显示基准图。</p>
          </div>
        </ImagePane>
        <ImagePane title="结果图" backgroundMode={backgroundMode}>
          <div className="canvas-empty compact">
            <p>{resultEmptyLabel}</p>
          </div>
        </ImagePane>
      </div>
    )
  }

  const toImageCoords = (x: number, y: number) => ({
    x: Math.max(0, Math.round(x / dimensions.scale)),
    y: Math.max(0, Math.round(y / dimensions.scale)),
  })

  const handleMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    if (!enableSelection) {
      return
    }
    const stage = event.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer) {
      return
    }
    const point = toImageCoords(pointer.x, pointer.y)
    setStartPoint(point)
    setDraft({ ...point, width: 1, height: 1 })
  }

  const handleMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    if (!enableSelection || !startPoint) {
      return
    }
    const stage = event.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer) {
      return
    }
    const next = toImageCoords(pointer.x, pointer.y)
    const x = Math.min(startPoint.x, next.x)
    const y = Math.min(startPoint.y, next.y)
    setDraft({
      x,
      y,
      width: Math.max(1, Math.abs(next.x - startPoint.x)),
      height: Math.max(1, Math.abs(next.y - startPoint.y)),
    })
  }

  const handleMouseUp = () => {
    if (draft) {
      onSelectionChange(draft)
    }
    setDraft(null)
    setStartPoint(null)
  }

  return (
    <div className="dual-image-workbench">
      <ImagePane
        title="基准图"
        meta={`${image.width} × ${image.height}`}
        backgroundMode={backgroundMode}
        onToggleBackground={toggleBackground}
      >
        <div className="canvas-toolbar compact">
          <button
            className={`ghost-button small ${enableSelection ? 'is-active' : ''}`}
            onClick={() => onSelectionModeChange(!enableSelection)}
          >
            {enableSelection ? '结束框选' : '局部框选'}
          </button>
          <button className="ghost-button small" disabled={!selection} onClick={() => onSelectionChange(null)}>
            清除框选
          </button>
          <button className="ghost-button small" disabled={!selection} onClick={() => setShowSelection((value) => !value)}>
            {showSelection ? '隐藏选区' : '显示选区'}
          </button>
          {selection ? <span className="canvas-toolbar-copy">选区 {selection.width} × {selection.height}</span> : null}
        </div>

        <div className={`image-stage-wrap ${backgroundMode}`}>
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="canvas-stage"
          >
            <Layer>
              <KonvaImage image={image} width={dimensions.width} height={dimensions.height} />
            </Layer>

            <Layer>
              {activeRect ? (
                <Rect
                  x={activeRect.x * dimensions.scale}
                  y={activeRect.y * dimensions.scale}
                  width={activeRect.width * dimensions.scale}
                  height={activeRect.height * dimensions.scale}
                  stroke={accent}
                  strokeWidth={2}
                  dash={[6, 4]}
                  fill={accentFill}
                />
              ) : null}
            </Layer>
          </Stage>
        </div>
      </ImagePane>

      <ImagePane title="结果图" backgroundMode={backgroundMode}>
        {resultImageUrl ? (
          <div className={`result-image-wrap ${backgroundMode}`}>
            <img src={resultImageUrl} alt="结果图" />
          </div>
        ) : (
          <div className="canvas-empty compact">
            <p>{resultEmptyLabel}</p>
          </div>
        )}
      </ImagePane>
    </div>
  )
}

function ImagePane({
  title,
  meta,
  backgroundMode,
  onToggleBackground,
  children,
}: {
  title: string
  meta?: string
  backgroundMode: BackgroundMode
  onToggleBackground?: () => void
  children: ReactNode
}) {
  return (
    <section className="image-compare-pane">
      <div className="image-pane-header">
        <div>
          <span className="field-label">{title}</span>
          {meta ? <strong>{meta}</strong> : null}
        </div>
        {onToggleBackground ? (
          <button className="ghost-button small" onClick={onToggleBackground}>
            {backgroundMode === 'checker' ? '纯色底' : '棋盘格'}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  )
}
