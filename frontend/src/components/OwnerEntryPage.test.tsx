import { expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { OwnerEntryPage } from './OwnerEntryPage'

vi.mock('../lib/api', () => ({
  listRecentOwners: vi.fn(async () => []),
  openOwner: vi.fn(),
}))

it('shows local title guidance for other mode', async () => {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OwnerEntryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  expect(screen.getByRole('heading', { name: '进入工作台' })).toBeInTheDocument()
  expect(screen.getByText('工作对象类型')).toBeInTheDocument()
})
