import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
  const [selectedTag, setSelectedTag] = useState<IdleTag | null>(null)
  const [note, setNote] = useState('')

  const awayMinutes = Math.max(1, Math.round(popup.durationSec / 60))

  const handleTagClick = async (tag: IdleTag): Promise<void> => {
    if (tag === 'other') {
      setSelectedTag('other')
      return
    }
    await bridge.submitReturnTag(popup.sessionId, tag, note.trim())
  }

  const handleSaveCustom = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await bridge.submitReturnTag(popup.sessionId, selectedTag ?? 'other', note.trim())
  }

  return (
    <div
      className={
        embedded
          ? 'fixed bottom-5 right-5 z-50 w-[372px] floating-surface p-4 space-y-3.5 animate-fluid-in'
          : 'w-full h-full floating-surface p-4 space-y-3 flex flex-col justify-between animate-fluid-in overflow-y-auto'
      }
    >
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
              onClick={() => void handleTagClick(tag)}
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

      <form onSubmit={(e) => void handleSaveCustom(e)} className="no-drag flex items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('returnPopup.notePlaceholder')}
          className="input-control flex-1 !rounded-full !py-1.5 !px-3.5 !text-xs"
        />
        {selectedTag === 'other' || note.trim() ? (
          <button type="submit" className="btn-primary px-3.5 py-1.5 text-xs shrink-0">
            {t('returnPopup.save')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void bridge.dismissReturnPopup()}
            className="btn-subtle px-3.5 py-1.5 text-xs font-semibold shrink-0"
          >
            {t('returnPopup.skip')}
          </button>
        )}
      </form>
    </div>
  )
}
