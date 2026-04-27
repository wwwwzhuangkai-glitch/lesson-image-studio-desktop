import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import { UtilityDrawer } from './UtilityDrawer'
import { useUiStore } from '../store/uiStore'

vi.mock('../lib/api', () => ({
  listJobs: vi.fn(async () => [
    {
      id: 'job_1',
      owner_id: 'own_1',
      image_item_id: 'item_1',
      base_version_id: 'ver_1',
      output_version_id: null,
      job_type: 'edit',
      status: 'running',
      prompt_text: '把线条画清楚',
      normalized_prompt: '把线条画清楚',
      mask_id: null,
      request_params: {},
      provider: 'openai',
      model: 'gpt-image-2',
      quality: 'medium',
      size: '1024x1024',
      error_code: null,
      error_message: null,
      started_at: null,
      finished_at: null,
      created_at: '2026-04-23T00:00:00Z',
      output_version: null,
    },
    {
      id: 'job_2',
      owner_id: 'own_1',
      image_item_id: 'item_1',
      base_version_id: null,
      output_version_id: null,
      job_type: 'generate',
      status: 'failed',
      prompt_text: '画一个力学装置',
      normalized_prompt: '画一个力学装置',
      mask_id: null,
      request_params: {},
      provider: 'openai_official',
      model: 'gpt-image-2',
      quality: 'high',
      size: 'auto',
      error_code: 'job_failed',
      error_message: 'APIConnectionError: disconnect',
      started_at: null,
      finished_at: '2026-04-23T00:00:10Z',
      created_at: '2026-04-23T00:00:00Z',
      output_version: null,
    },
  ]),
  listEvents: vi.fn(async () => ({
    events: [
      {
        id: 'evt_1',
        owner_id: 'own_1',
        image_item_id: 'item_1',
        version_id: null,
        event_type: 'image_item_created',
        payload: {},
        created_at: '2026-04-23T00:00:00Z',
      },
    ],
  })),
  getRecycleBin: vi.fn(async () => ({
    deleted_items: [
      {
        id: 'item_deleted',
        owner_id: 'own_1',
        sort_order: 2,
        title: '已删除图片项',
        status: 'deleted',
        current_final_version_id: null,
        latest_version: null,
        current_final_version: null,
        running_job: null,
        created_at: '2026-04-23T00:00:00Z',
        updated_at: '2026-04-23T00:00:00Z',
      },
    ],
    deleted_versions: [],
  })),
  restoreImageItem: vi.fn(async () => ({ success: true, message: 'ok' })),
  restoreVersion: vi.fn(async () => ({ success: true, message: 'ok' })),
}))

beforeEach(() => {
  useUiStore.setState({
    utilityDrawerOpen: true,
    utilityTab: 'tasks',
    taskScope: 'owner',
    currentOwnerId: 'own_1',
    notices: [],
    jobIndicatorCount: 0,
  })
})

it('switches between tasks, events and recycle tabs in the shared utility drawer', async () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UtilityDrawer />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('把线条画清楚')).toBeInTheDocument()
  expect(await screen.findByText('job_failed：APIConnectionError: disconnect')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '事件' }))
  expect(await screen.findByText('创建了图片项')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '回收站' }))
  await waitFor(() => expect(screen.getByText('已删除图片项')).toBeInTheDocument())
})
