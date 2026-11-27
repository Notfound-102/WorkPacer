import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Edit3, Plus, Trash2, X } from 'lucide-react'
import {
  IdleTag,
  MAX_QUICK_IDLE_PRESETS,
  QuickIdlePreset,
  QuickPresetIcon
} from '@shared/types'
import { bridge } from '../lib/bridge'
import { PresetIconView, QUICK_PRESET_ICONS } from './WorkPacerLogo'

interface QuickPresetsManagerProps {
  presets: QuickIdlePreset[]
  compactModal?: boolean
  onClose?: () => void
}

const TAG_CHOICES: IdleTag[] = ['eating', 'meeting', 'rest', 'out', 'sleep', 'other']

export const QuickPresetsManager: React.FC<QuickPresetsManagerProps> = ({
  presets,
  compactModal = false,
  onClose
}) => {
  const { t } = useTranslation()
  const [newLabel, setNewLabel] = useState('')
  const [newIcon, setNewIcon] = useState<QuickPresetIcon>('coffee')
  const [newTag, setNewTag] = useState<IdleTag>('rest')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editIcon, setEditIcon] = useState<QuickPresetIcon>('coffee')
  const [editTag, setEditTag] = useState<IdleTag>('rest')

  const limitReached = presets.length >= MAX_QUICK_IDLE_PRESETS

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (limitReached || !newLabel.trim()) return
    await bridge.createQuickIdlePreset({
      label: newLabel.trim(),
      icon: newIcon,
      tag: newTag
    })
    setNewLabel('')
  }

  const beginEdit = (p: QuickIdlePreset): void => {
    setEditingId(p.id)
    setEditLabel(p.label)
    setEditIcon(p.icon)
    setEditTag(p.tag)
  }

  const saveEdit = async (): Promise<void> => {
    if (!editingId || !editLabel.trim()) return
    await bridge.updateQuickIdlePreset(editingId, {
      label: editLabel.trim(),
      icon: editIcon,
      tag: editTag
    })
    setEditingId(null)
  }

  return (
    <div className={compactModal ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">{t('presets.title')}</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {t('presets.subtitle', { max: MAX_QUICK_IDLE_PRESETS })}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn-subtle p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Existing Presets List (Auto-ordered by usage_count DESC, last_used_at DESC) */}
      <div className="space-y-2">
        {presets.map((p, idx) => {
          const isEditing = editingId === p.id
          return (
            <div
              key={p.id}
              className="p-2.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2"
            >
              {isEditing ? (
                <div className="w-full space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="input-control flex-1 !py-1 !px-2.5 !text-xs"
                    />
                    <select
                      value={editTag}
                      onChange={(e) => setEditTag(e.target.value as IdleTag)}
                      className="input-control !py-1 !px-2 !text-xs"
                    >
                      {TAG_CHOICES.map((tg) => (
                        <option key={tg} value={tg}>
                          {t(`tags.${tg}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      {QUICK_PRESET_ICONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setEditIcon(ic)}
                          className={`p-1.5 rounded-full border transition-colors ${
                            editIcon === ic
                              ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <PresetIconView icon={ic} className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        className="btn-primary px-3 py-1 text-xs flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        {t('presets.saveBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn-subtle px-2.5 py-1 text-xs"
                      >
                        {t('presets.cancelBtn')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-mono font-bold text-[var(--text-muted)] w-4">
                      #{idx + 1}
                    </span>
                    <span className="w-7 h-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
                      <PresetIconView icon={p.icon} className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{p.label}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t(`tags.${p.tag}`)} •{' '}
                        {t('presets.usageBadge', { count: p.usageCount })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => beginEdit(p)}
                      title={t('presets.editBtn')}
                      className="btn-subtle p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent)]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void bridge.deleteQuickIdlePreset(p.id)}
                      title={t('presets.deleteBtn')}
                      className="btn-subtle p-1.5 text-[var(--text-secondary)] hover:text-[var(--coral)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Add New Preset Form (Disabled with message when 6 presets reached) */}
      {limitReached ? (
        <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--amber-soft)] text-[var(--amber)] text-xs font-medium">
          {t('presets.limitReached', { max: MAX_QUICK_IDLE_PRESETS })}
        </div>
      ) : (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="p-3 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2.5"
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t('presets.namePlaceholder')}
              className="input-control flex-1 min-w-[160px] !py-1.5 !text-xs"
            />
            <select
              value={newTag}
              onChange={(e) => setNewTag(e.target.value as IdleTag)}
              className="input-control !py-1.5 !px-2.5 !text-xs"
            >
              {TAG_CHOICES.map((tg) => (
                <option key={tg} value={tg}>
                  {t(`tags.${tg}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {QUICK_PRESET_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setNewIcon(ic)}
                  className={`p-1.5 rounded-full border transition-colors ${
                    newIcon === ic
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <PresetIconView icon={ic} className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={limitReached || !newLabel.trim()}
              className="btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('presets.addBtn')} ({presets.length}/{MAX_QUICK_IDLE_PRESETS})
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
