import { useMemo, useState } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage } from 'react-konva'

import { useImageElement } from '../hooks/useImageElement'
import { useTheme } from '../hooks/useTheme'

interface RectGeometry {
  x: number
  y: number
  width: number
  height: number
}

interface CanvasWorkbenchProps {
  imageUrl: string | null
  compareImageUrl?: string | null
  selection: RectGeometry | null
  onSelectionChange: (next: RectGeometry | null) => void
  enableSelection: boolean
  onSelectionModeChange: (next: boolean) => void
}

export function CanvasWorkbench({
  imageUrl,
  compareImageUrl,
  selection,
  onSelectionChange,
  enableSelection,
  onSelectionModeChange,
}: CanvasWorkbenchProps) {
  const image = useImageElement(imageUrl)
  const compareImage = useImageElement(compareImageUrl ?? null)
  const [draft, setDraft] = useState<RectGeometry | null>(null)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [split, setSplit] = useState(0.5)
  const [compareEnabled, setCompareEnabled] = useState(true)
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
    const maxWidth = 760
    const scale = Math.min(1, maxWidth / image.width)
    return {
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
      scale,
    }
  }, [image])

  const activeRect = draft ?? selection

  if (!image || !dimensions) {
    return (
      <div className="canvas-empty">
        <p>这张图片还没有可预览的内容。</p>
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
    <div className="canvas-shell">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-group">
          {compareImage ? (
            <button
              className={`ghost-button small ${compareEnabled ? 'is-active' : ''}`}
              onClick={() => setCompareEnabled((value) => !value)}
            >
              {compareEnabled ? '关闭对比' : '前后对比'}
            </button>
          ) : null}
          <button
            className={`ghost-button small ${enableSelection ? 'is-active' : ''}`}
            onClick={() => onSelectionModeChange(!enableSelection)}
          >
            {enableSelection ? '结束框选' : '局部框选'}
          </button>
          <button
            className="ghost-button small"
            disabled={!selection}
            onClick={() => onSelectionChange(null)}
          >
            清除框选
          </button>
        </div>

        <div className="canvas-toolbar-copy">
          <span>
            {image.width} × {image.height}
          </span>
          {selection ? (
            <span>
              选区 {selection.width} × {selection.height}
            </span>
          ) : null}
        </div>
      </div>

      {compareImage && compareEnabled ? (
        <label className="compare-slider">
          <span>前后对比滑杆</span>
          <input
            type="range"
            min="0"
            max="100"
            value={split * 100}
            onChange={(event) => setSplit(Number(event.target.value) / 100)}
          />
        </label>
      ) : null}

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="canvas-stage"
      >
        {compareImage && compareEnabled ? (
          <Layer>
            <KonvaImage image={compareImage} width={dimensions.width} height={dimensions.height} />
          </Layer>
        ) : null}

        <Layer>
          {compareImage && compareEnabled ? (
            <Group
              clipX={0}
              clipY={0}
              clipWidth={dimensions.width * split}
              clipHeight={dimensions.height}
            >
              <KonvaImage image={image} width={dimensions.width} height={dimensions.height} />
            </Group>
          ) : (
            <KonvaImage image={image} width={dimensions.width} height={dimensions.height} />
          )}
        </Layer>

        {compareImage && compareEnabled ? (
          <Layer>
            <Line
              points={[dimensions.width * split, 0, dimensions.width * split, dimensions.height]}
              stroke={accent}
              strokeWidth={2}
            />
          </Layer>
        ) : null}

        <Layer>
          {activeRect ? (
            <Rect
              x={activeRect.x * dimensions.scale}
              y={activeRect.y * dimensions.scale}
              width={activeRect.width * dimensions.scale}
              height={activeRect.height * dimensions.scale}
              stroke={accent}
              strokeWidth={2}
              dash={[8, 6]}
              fill={accentFill}
            />
          ) : null}
        </Layer>
      </Stage>
    </div>
  )
}
