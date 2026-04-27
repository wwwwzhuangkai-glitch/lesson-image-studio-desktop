import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { listRecentOwners, openOwner } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import type { Owner } from '../types/api'
import { AppTopbar } from './AppTopbar'

const OWNER_OPTIONS = [
  { value: 'question', label: '题目ID' },
  { value: 'asset', label: '知识素材ID' },
  { value: 'other', label: '本地项目' },
]

function getProjectTitle(owner: Owner) {
  return owner.local_title?.trim() || '未命名'
}

function getProjectTypeLabel(ownerType: string) {
  if (ownerType === 'question') return '题目ID'
  if (ownerType === 'asset') return '知识素材ID'
  if (ownerType === 'other') return '本地项目'
  return '项目ID'
}

export function OwnerEntryPage() {
  const navigate = useNavigate()
  const pushNotice = useUiStore((state) => state.pushNotice)
  const setCurrentOwnerId = useUiStore((state) => state.setCurrentOwnerId)
  const [ownerType, setOwnerType] = useState<'question' | 'asset' | 'other'>('question')
  const [ownerId, setOwnerId] = useState('')
  const [localTitle, setLocalTitle] = useState('')

  const recentQuery = useQuery({
    queryKey: ['recent-owners'],
    queryFn: listRecentOwners,
  })

  const mutation = useMutation({
    mutationFn: openOwner,
    onSuccess: (data) => {
      setCurrentOwnerId(data.owner.id)
      navigate(`/owners/${data.owner.id}`)
    },
    onError: (error: Error) => {
      pushNotice({ title: '打开失败', body: error.message })
    },
  })

  const helperText = useMemo(() => {
    if (ownerType === 'other') {
      return '系统会自动生成一个本地项目 ID；标题留空时会显示为未命名。'
    }
    return '输入已有的题目 ID 或知识素材 ID 进入工作台。'
  }, [ownerType])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      owner_type: ownerType,
      owner_id: ownerType === 'other' ? undefined : ownerId.trim(),
      local_title: localTitle.trim() || '未命名',
    })
  }

  return (
    <div className="landing-shell">
      <header className="landing-topbar panel">
        <div className="landing-topbar-left">
          <span className="eyebrow">Lesson Image Studio</span>
          <span className="landing-topbar-title">教研画图工作台</span>
        </div>
        <AppTopbar />
      </header>

      <section className="panel recent-panel">
        <h2>最近打开</h2>
        <p className="muted">回到之前的项目继续改图</p>
        <div className="recent-owner-list">
          {(recentQuery.data ?? []).map((owner) => (
            <button key={owner.id} className="recent-owner-card" onClick={() => navigate(`/owners/${owner.id}`)}>
              <strong>{getProjectTitle(owner)}</strong>
              <span>
                {getProjectTypeLabel(owner.owner_type)} · {owner.owner_id}
              </span>
            </button>
          ))}
          {!recentQuery.data?.length && !recentQuery.isLoading ? (
            <div className="empty-mini-card">还没有最近打开的项目。</div>
          ) : null}
        </div>
      </section>

      <section className="panel landing-entry">
        <h2>进入工作台</h2>
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            <span>项目类型</span>
            <select value={ownerType} onChange={(event) => setOwnerType(event.target.value as typeof ownerType)}>
              {OWNER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {ownerType !== 'other' ? (
            <label>
              <span>{ownerType === 'question' ? '题目ID' : '知识素材ID'}</span>
              <input
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                placeholder={ownerType === 'question' ? '例如：Q20260422001' : '例如：ASSET-2048'}
              />
            </label>
          ) : null}

          <label>
            <span>{ownerType === 'other' ? '本地标题' : '本地标题（可选）'}</span>
            <input
              value={localTitle}
              onChange={(event) => setLocalTitle(event.target.value)}
              placeholder={ownerType === 'other' ? '例如：牛顿第二定律插图草稿' : '留空显示为未命名'}
            />
          </label>

          <p className="muted">{helperText}</p>
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '正在打开…' : '进入工作台'}
          </button>
        </form>
      </section>
    </div>
  )
}
