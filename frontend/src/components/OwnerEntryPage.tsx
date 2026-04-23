import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { listRecentOwners, openOwner } from '../lib/api'
import { useUiStore } from '../store/uiStore'

const OWNER_OPTIONS = [
  { value: 'question', label: '题目' },
  { value: 'asset', label: '知识素材' },
  { value: 'other', label: '其它模式' },
]

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
      return '系统会自动生成一个本地 owner_id，你只需要起一个标题。'
    }
    return '输入已有的题目 ID 或知识素材 ID 进入工作台。'
  }, [ownerType])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({
      owner_type: ownerType,
      owner_id: ownerType === 'other' ? undefined : ownerId.trim(),
      local_title: localTitle.trim() || undefined,
    })
  }

  return (
    <div className="landing-shell">
      <section className="landing-copy panel">
        <div className="eyebrow">Lesson Image Studio</div>
        <h1>教研画图工作台</h1>
        <p>
          围绕题目 ID、知识素材 ID 或临时其它模式，管理多图、版本树、异步改图任务和定稿结果。
        </p>
        <div className="landing-features">
          <div>多图总览</div>
          <div>版本树改图</div>
          <div>异步任务中心</div>
          <div>模板沉淀</div>
        </div>
      </section>

      <section className="panel landing-entry">
        <h2>进入工作台</h2>
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            <span>工作对象类型</span>
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
              <span>业务 ID</span>
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
              placeholder={ownerType === 'other' ? '例如：牛顿第二定律插图草稿' : '可留空'}
            />
          </label>

          <p className="muted">{helperText}</p>
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '正在打开…' : '进入工作台'}
          </button>
        </form>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>最近打开</h2>
            <p>老师可以随时回到之前的工作对象继续改图。</p>
          </div>
        </div>
        <div className="recent-owner-list">
          {(recentQuery.data ?? []).map((owner) => (
            <button key={owner.id} className="recent-owner-card" onClick={() => navigate(`/owners/${owner.id}`)}>
              <strong>{owner.local_title || owner.owner_id}</strong>
              <span>
                {owner.owner_type} · {owner.owner_id}
              </span>
            </button>
          ))}
          {!recentQuery.data?.length && !recentQuery.isLoading ? (
            <div className="empty-mini-card">还没有最近打开的 Owner。</div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
