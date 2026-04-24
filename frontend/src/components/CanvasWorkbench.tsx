import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const { image, error: baseImageError } = useImageElement(baseImageUrl)
  const { image: resultImage, error: resultImageError } = useImageElement(resultImageUrl ?? null)
  const [resultErrorUrl, setResultErrorUrl] = useState<string | null>(null)
  const resultError = resultImageError || (resultImageUrl !== null && resultImageUrl === resultErrorUrl)
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

  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 620, height: 430 })
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const update = () => {
      const { width, height } = node.getBoundingClientRect()
      const pad = 32
      setContainerSize({ width: Math.max(100, width - pad), height: Math.max(100, height - pad) })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // re-measure on window resize as a fallback
    const handler = () => {
      const node = document.querySelector('.base-image-body') as HTMLDivElement | null
      if (!node) return
      const { width, height } = node.getBoundingClientRect()
      const pad = 32
      setContainerSize({ width: Math.max(100, width - pad), height: Math.max(100, height - pad) })
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const dimensions = useMemo(() => {
    if (!image) {
      return null
    }
    const maxWidth = containerSize.width
    const maxHeight = containerSize.height
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height)
    return {
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
      scale,
    }
  }, [image, containerSize])

  const resultDimensions = useMemo(() => {
    if (!resultImage) return null
    const maxWidth = containerSize.width
    const maxHeight = containerSize.height
    const scale = Math.min(1, maxWidth / resultImage.width, maxHeight / resultImage.height)
    return {
      width: Math.round(resultImage.width * scale),
      height: Math.round(resultImage.height * scale),
    }
  }, [resultImage, containerSize])

  const activeRect = showSelection ? draft ?? selection : null
  const toggleBackground = () => setBackgroundMode((value) => (value === 'checker' ? 'solid' : 'checker'))

  if (!image || !dimensions) {
    return (
      <div className="dual-image-workbench">
        <ImagePane title="基准图" backgroundMode={backgroundMode} onToggleBackground={toggleBackground}>
          <div className={`image-pane-body ${backgroundMode}`}>
            <div className="canvas-empty compact">
              <p>{baseImageError ? '基准图加载失败，请检查图片文件。' : '左栏选中版本后会显示基准图。'}</p>
            </div>
          </div>
        </ImagePane>
        <ImagePane title="结果图" backgroundMode={backgroundMode} onToggleBackground={toggleBackground}>
          <div className={`image-pane-body ${backgroundMode}`}>
            <div className="canvas-empty compact">
              <p>{resultEmptyLabel}</p>
            </div>
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

  const selectionActions = (
    <>
      <button
        className={`ghost-button small ${enableSelection ? 'is-active' : ''}`}
        onClick={() => onSelectionModeChange(!enableSelection)}
      >
        {enableSelection ? '结束' : '框选'}
      </button>
      <button className="ghost-button small" disabled={!selection} onClick={() => onSelectionChange(null)}>
        清除
      </button>
      <button className="ghost-button small" disabled={!selection} onClick={() => setShowSelection((value) => !value)}>
        {showSelection ? '隐藏' : '显示'}
      </button>
    </>
  )
  const baseMeta = selection
    ? `${image.width} × ${image.height} / 选区 ${selection.width} × ${selection.height}`
    : `${image.width} × ${image.height}`

  return (
    <div className="dual-image-workbench">
      <ImagePane
        title="基准图"
        meta={baseMeta}
        backgroundMode={backgroundMode}
        onToggleBackground={toggleBackground}
        actions={selectionActions}
      >
        <div ref={containerRef} className={`image-pane-body base-image-body ${backgroundMode} ${enableSelection ? 'is-selecting' : ''}`}>
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

      <ImagePane title="结果图" backgroundMode={backgroundMode} onToggleBackground={toggleBackground}>
        <div className={`image-pane-body ${backgroundMode}`}>
          {resultImageUrl && !resultError && resultDimensions ? (
            <img
              className="result-image"
              src={resultImageUrl}
              alt="结果图"
              width={resultDimensions.width}
              height={resultDimensions.height}
              onError={() => setResultErrorUrl(resultImageUrl)}
            />
          ) : resultImageUrl && !resultError ? (
            <div className="canvas-empty compact"><p>正在加载结果图…</p></div>
          ) : (
            <div className="canvas-empty compact">
              <p>{resultError ? '结果图加载失败，请检查图片文件。' : resultEmptyLabel}</p>
            </div>
          )}
        </div>
      </ImagePane>
    </div>
  )
}

function ImagePane({
  title,
  meta,
  backgroundMode,
  onToggleBackground,
  actions,
  children,
}: {
  title: string
  meta?: string
  backgroundMode: BackgroundMode
  onToggleBackground?: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="image-compare-pane">
      <div className="image-pane-header">
        <div className="image-pane-title">
          <span className="field-label">{title}</span>
          {meta ? <strong>{meta}</strong> : null}
        </div>
        <div className="image-pane-actions">
          {actions}
          {onToggleBackground ? (
            <button className="ghost-button small" onClick={onToggleBackground}>
              {backgroundMode === 'checker' ? '纯色底' : '棋盘格'}
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}
