import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { ImageEditorPage } from './ImageEditorPage'
import { useUiStore } from '../store/uiStore'

vi.mock('../lib/api', () => ({
  getImageItem: vi.fn(async () => ({
    image_item: {
      id: 'item_1',
      owner_id: 'own_1',
      sort_order: 1,
      title: '受力分析图',
      status: 'active',
      current_final_version_id: 'ver_2',
      latest_version: null,
      current_final_version: null,
      running_job: null,
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    },
    current_final_version: {
      id: 'ver_2',
      image_item_id: 'item_1',
      parent_version_id: 'ver_1',
      origin_type: 'edited',
      file_name: 'edited.png',
      file_url: '/files/edited.png',
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
      created_at: '2026-04-23T00:00:00Z',
    },
    versions: [
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
        created_at: '2026-04-23T00:00:00Z',
      },
      {
        id: 'ver_2',
        image_item_id: 'item_1',
        parent_version_id: 'ver_1',
        origin_type: 'edited',
        file_name: 'edited.png',
        file_url: '/files/edited.png',
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
        created_at: '2026-04-23T00:00:00Z',
      },
    ],
    recent_jobs: [],
    recent_events: [],
  })),
  getVersionTree: vi.fn(async () => [
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
      created_at: '2026-04-23T00:00:00Z',
      children: [
        {
          id: 'ver_2',
          image_item_id: 'item_1',
          parent_version_id: 'ver_1',
          origin_type: 'edited',
          file_name: 'edited.png',
          file_url: '/files/edited.png',
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
          created_at: '2026-04-23T00:00:00Z',
          children: [],
        },
      ],
    },
  ]),
  listPromptPresets: vi.fn(async () => [
    {
      id: 'pst_1',
      scope: 'system',
      name: '高中物理模板',
      summary: '适合课件讲解',
      prompt_text: '请生成高中物理课件风格插图',
      discipline: 'physics',
      is_builtin: true,
      source_preset_id: null,
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    },
  ]),
  createEditJob: vi.fn(),
  createGenerateJob: vi.fn(),
  createMask: vi.fn(),
  createPromptPreset: vi.fn(),
  deletePromptPreset: vi.fn(),
  deleteVersion: vi.fn(),
  duplicateVersionToImageItem: vi.fn(),
  exportVersion: vi.fn(),
  finalizeVersion: vi.fn(),
  importImage: vi.fn(),
  publishPlaceholder: vi.fn(),
  unfinalizeVersion: vi.fn(),
  updatePromptPreset: vi.fn(),
}))

vi.mock('./CanvasWorkbench', () => ({
  CanvasWorkbench: () => <div>CanvasWorkbench Stub</div>,
}))

it('renders the three-column editor shell without embedding the template library', async () => {
  const queryClient = new QueryClient()
  useUiStore.setState({
    utilityDrawerOpen: false,
    utilityTab: 'tasks',
    taskScope: 'owner',
    currentOwnerId: null,
    currentImageItemId: null,
    notices: [],
    jobIndicatorCount: 0,
    editorPromptText: '',
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/items/item_1']}>
        <Routes>
          <Route path="/items/:itemId" element={<ImageEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('受力分析图')).toBeInTheDocument()
  expect(screen.getByText('版本轨')).toBeInTheDocument()
  expect(screen.getByText('CanvasWorkbench Stub')).toBeInTheDocument()
  // Templates live in UtilityDrawer now; they must not be embedded in the editor.
  expect(screen.queryByText('高中物理模板')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /模板库/ })).not.toBeInTheDocument()
  // An explicit "open templates drawer" entry replaces the old embedded list.
  expect(screen.getByRole('button', { name: '打开模板抽屉' })).toBeInTheDocument()
})
