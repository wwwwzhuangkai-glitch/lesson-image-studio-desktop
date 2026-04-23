import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { VersionTree } from './VersionTree'

const nodes = [
  {
    id: 'ver_1',
    image_item_id: 'item_1',
    parent_version_id: null,
    origin_type: 'imported',
    file_name: 'root.png',
    file_url: '/files/root.png',
    mime_type: 'image/png',
    width: 100,
    height: 100,
    file_size: 1024,
    prompt_text: null,
    prompt_summary: '导入底图',
    provider: 'local',
    model: null,
    quality: null,
    size: null,
    is_deleted: false,
    is_current_final: false,
    child_count: 1,
    created_at: '2026-04-22T00:00:00Z',
    children: [
      {
        id: 'ver_2',
        image_item_id: 'item_1',
        parent_version_id: 'ver_1',
        origin_type: 'edited',
        file_name: 'child.png',
        file_url: '/files/child.png',
        mime_type: 'image/png',
        width: 100,
        height: 100,
        file_size: 1024,
        prompt_text: '清晰化',
        prompt_summary: '清晰化',
        provider: 'openai',
        model: 'gpt-image-2',
        quality: 'medium',
        size: '1024x1024',
        is_deleted: false,
        is_current_final: true,
        child_count: 0,
        created_at: '2026-04-22T00:10:00Z',
        children: [],
      },
    ],
  },
]

it('renders nested versions and triggers selection', () => {
  const handleSelect = vi.fn()
  render(<VersionTree nodes={nodes} selectedVersionId="ver_1" onSelect={handleSelect} />)

  expect(screen.getByText('导入底图')).toBeInTheDocument()
  expect(screen.getByText('清晰化')).toBeInTheDocument()
  expect(screen.getByAltText('导入底图')).toBeInTheDocument()

  fireEvent.click(screen.getByText('清晰化'))
  expect(handleSelect).toHaveBeenCalledWith('ver_2')
})
