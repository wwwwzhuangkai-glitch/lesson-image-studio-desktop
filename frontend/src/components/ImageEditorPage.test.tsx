import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { ImageEditorPage } from './ImageEditorPage'
import { createEditJob, createGenerateJob, createMask, getImageItem, getVersionTree } from '../lib/api'
import { useUiStore } from '../store/uiStore'

vi.mock('../lib/api', () => ({
  getAppSettings: vi.fn(async () => ({
    has_openai_api_key: false,
    openai_api_key_source: 'none',
    has_tal_service_api_key: false,
    openai_base_url: '',
    openai_model: 'gpt-image-2',
    default_provider: 'tal_gpt_image_2',
    default_export_format: 'png',
    theme_mode: 'light',
    theme_variant: 'graphite',
    max_concurrent_jobs: 2,
    updated_at: '2026-04-24T00:00:00Z',
  })),
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
      width: 935,
      height: 1683,
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
        width: 935,
        height: 1683,
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
        width: 935,
        height: 1683,
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
      width: 935,
      height: 1683,
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
          width: 935,
          height: 1683,
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
  createEditJob: vi.fn(async () => ({ job_id: 'job_1', status: 'queued' })),
  createGenerateJob: vi.fn(async () => ({ job_id: 'job_2', status: 'queued' })),
  createMask: vi.fn(async () => ({ id: 'mask_1', file_url: '/masks/mask_1.png' })),
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
  CanvasWorkbench: ({
    onSelectionChange,
    onSelectionModeChange,
  }: {
    onSelectionChange: (next: { x: number; y: number; width: number; height: number }) => void
    onSelectionModeChange: (next: boolean) => void
  }) => (
    <div>
      <div>基准图</div>
      <div>结果图</div>
      <button onClick={() => onSelectionModeChange(true)}>局部框选</button>
      <button onClick={() => onSelectionChange({ x: 10, y: 20, width: 30, height: 40 })}>模拟框选</button>
    </div>
  ),
}))

beforeEach(() => {
  vi.mocked(createEditJob).mockClear()
  vi.mocked(createGenerateJob).mockClear()
  vi.mocked(createMask).mockClear()
})

function renderEditor() {
  const queryClient = new QueryClient()
  useUiStore.setState({
    utilityDrawerOpen: false,
    utilityTab: 'tasks',
    taskScope: 'owner',
    currentOwnerId: null,
    currentImageItemId: null,
    notices: [],
    jobIndicatorCount: 0,
    editorPromptText: '把图整理成教材风格',
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/items/item_1']}>
        <Routes>
          <Route path="/items/:itemId" element={<ImageEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it('renders the dual-image editor shell without embedding the template library', async () => {
  renderEditor()

  expect(await screen.findByText('受力分析图')).toBeInTheDocument()
  expect(screen.getByText('版本轨')).toBeInTheDocument()
  expect(screen.getByText('基准图')).toBeInTheDocument()
  expect(screen.getByText('结果图')).toBeInTheDocument()
  // Templates live in UtilityDrawer now; they must not be embedded in the editor.
  expect(screen.queryByText('高中物理模板')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /模板库/ })).not.toBeInTheDocument()
  // An explicit "open templates drawer" entry replaces the old embedded list.
  expect(screen.getByRole('button', { name: '打开模板抽屉' })).toBeInTheDocument()
  expect(screen.getByText('935x1683')).toBeInTheDocument()
  expect(screen.getByText('图改图最终规格由后端按 provider 规则归一化，提交对象永远是左栏当前选中版本。')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '发起 AI 改图' }))
  await waitFor(() => {
    expect(createEditJob).toHaveBeenCalledWith({
      image_item_id: 'item_1',
      base_version_id: 'ver_2',
      prompt_text: '把图整理成教材风格',
      mask_id: undefined,
      quality: 'high',
      size_mode: 'auto',
    })
  })
})

it('creates a mask from the base image panel before submitting an edit', async () => {
  renderEditor()

  expect(await screen.findByText('受力分析图')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '局部框选' }))
  fireEvent.click(screen.getByRole('button', { name: '模拟框选' }))
  fireEvent.click(screen.getByRole('button', { name: '发起 AI 改图' }))

  await waitFor(() => {
    expect(createMask).toHaveBeenCalledWith({
      image_item_id: 'item_1',
      base_version_id: 'ver_2',
      geometry: { x: 10, y: 20, width: 30, height: 40 },
    })
    expect(createEditJob).toHaveBeenCalledWith({
      image_item_id: 'item_1',
      base_version_id: 'ver_2',
      prompt_text: '把图整理成教材风格',
      mask_id: 'mask_1',
      quality: 'high',
      size_mode: 'auto',
    })
  })
})

it('sends a preset size only for first-image generation', async () => {
  vi.mocked(getImageItem).mockResolvedValueOnce({
    image_item: {
      id: 'item_1',
      owner_id: 'own_1',
      sort_order: 1,
      title: '空图片项',
      status: 'active',
      current_final_version_id: null,
      latest_version: null,
      current_final_version: null,
      running_job: null,
      created_at: '2026-04-23T00:00:00Z',
      updated_at: '2026-04-23T00:00:00Z',
    },
    current_final_version: null,
    versions: [],
    recent_jobs: [],
    recent_events: [],
  })
  vi.mocked(getVersionTree).mockResolvedValueOnce([])
  renderEditor()

  expect(await screen.findByText('空图片项')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('生图尺寸'), { target: { value: '1536x1024' } })
  fireEvent.click(screen.getByRole('button', { name: '发起 AI 生图' }))

  await waitFor(() => {
    expect(createGenerateJob).toHaveBeenCalledWith('item_1', {
      prompt_text: '把图整理成教材风格',
      quality: 'high',
      size_mode: 'preset',
      size: '1536x1024',
    })
  })
})
