import { afterEach, expect, it, vi } from 'vitest'

import { deleteImageItem } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('prefers backend detail text for business errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ detail: '请先取消当前定稿后再删除图片项。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )

  await expect(deleteImageItem('item_1')).rejects.toThrow('请先取消当前定稿后再删除图片项。')
})
