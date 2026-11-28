import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Coffee,
  Footprints,
  Moon,
  MoreHorizontal,
  Users,
  Utensils,
  X
} from 'lucide-react'
import { IdleTag, PendingReturnPopup } from '@shared/types'
import { bridge } from '../lib/bridge'
import { WorkPacerLogo } from '../components/WorkPacerLogo'

interface ReturnPopupProps {
  popup: PendingReturnPopup
  embedded?: boolean
}

const TAG_OPTIONS: { tag: IdleTag; icon: React.FC<{ className?: string }> }[] = [
  { tag: 'eating', icon: Utensils },
  { tag: 'rest', icon: Coffee },
  { tag: 'meeting', icon: Users },
  { tag: 'out', icon: Footprints },
  { tag: 'sleep', icon: Moon },
  { tag: 'other', icon: MoreHorizontal }
]

export const ReturnPopup: React.FC<ReturnPopupProps> = ({ popup, embedded = false }) => {
  const { t } = useTranslation()
  const [selectedTag, setSelectedTag] = useState<IdleTag | null>('rest')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const awayMinutes = Math.max(1, Math.round(popup.durationSec / 60))

  const handleSubmit = async (e?: React.FormEvent, forcedTag?: IdleTag): Promise<void> => {
    e?.preventDefault()
    if (submitting) return
    const finalTag = forcedTag ?? selectedTag ?? (note.trim() ? 'other' : 'rest')
    setSubmitting(true)
    try {
      await bridge.submitReturnTag(popup.sessionId, finalTag, note.trim())
    } finally {
      setSubmitting(false)
    }
  }

  const modalCard = (
    <div className="floating-surface w-full h-full p-5 space-y-3.5 flex flex-col justify-between animate-fluid-in overflow-y-auto">
      <div className="drag-region flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <WorkPacerLogo size={28} />
          <div>
            <h2 className="text-xs font-bold text-[var(--accent)]">
              {t('returnPopup.title')}
            </h2>
            <p className="text-sm font-semibold leading-snug mt-0.5">
              {t('returnPopup.prompt', { minutes: awayMinutes })}
            </p>
          </div>
        </div>
        <button
          id="return-popup-dismiss"
          type="button"
          onClick={() => void bridge.dismissReturnPopup()}
          className="no-drag p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="no-drag grid grid-cols-3 gap-2">
        {TAG_OPTIONS.map(({ tag, icon: Icon }) => {
          const isSelected = selectedTag === tag
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              onDoubleClick={() => void handleSubmit(undefined, tag)}
              className={`glass-pill-btn px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 ${
                isSelected
                  ? '!bg-[var(--accent-soft)] !border-[var(--accent)] !text-[var(--accent)]'
                  : ''
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
              <span className="truncate">{t(`tags.${tag}`)}</span>
            </button>
          )
        })}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="no-drag space-y-2.5">
        <input
          autoFocus
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('returnPopup.notePlaceholder')}
          className="input-control w-full !rounded-full !py-2 !px-3.5 !text-xs"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void bridge.dismissReturnPopup()}
            className="btn-subtle px-4 py-1.5 text-xs font-semibold"
          >
            {t('returnPopup.skip')}
          </button>
          <button
            id="return-popup-save"
            type="submit"
            disabled={submitting}
            className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            {t('returnPopup.save')}
          </button>
        </div>
      </form>
    </div>
  )

  if (embedded) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/25 dark:bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-[428px]">{modalCard}</div>
      </div>
    )
  }

  return <div className="floating-widget-shell">{modalCard}</div>
}
