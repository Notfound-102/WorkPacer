import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coffee,
  ExternalLink,
  GripHorizontal,
  Pin,
  PinOff,
  Play,
  Sliders,
  Users,
  Utensils,
  X
} from 'lucide-react'
import { AppSettings, LiveTrackingState } from '@shared/types'
import { bridge } from '../lib/bridge'
import { formatClockTimer } from '../lib/formatters'

interface StickyWidgetProps {
  state: LiveTrackingState
  settings: AppSettings
  embeddedPreview?: boolean
}

export const StickyWidget: React.FC<StickyWidgetProps> = ({
  state,
  settings,
  embeddedPreview = false
}) => {
  const { t } = useTranslation()
  const [quickTask, setQuickTask] = useState('')
  const [showOpacity, setShowOpacity] = useState(false)
  const [dragPos, setDragPos] = useState({ x: 24, y: 76 })
  const [dragging, setDragging] = useState<{ startX: number; startY: number } | null>(null)

  const prefs = settings.stickyWidget
  const isPinned = prefs.alwaysOnTop
  const isCollapsed = prefs.collapsed

  const statusTone =
    state.pomodoro.running && state.pomodoro.phase === 'focus'
      ? { dot: 'bg-[var(--coral)]', label: t('status.pomodoro_focus') }
      : state.status === 'active'
        ? { dot: 'bg-[var(--accent)]', label: t('status.active') }
        : state.status === 'manual_idle'
          ? { dot: 'bg-[var(--amber)]', label: t('status.manual_idle') }
          : { dot: 'bg-[var(--amber)]', label: t('status.auto_idle') }

  const primarySeconds = state.pomodoro.running
    ? state.pomodoro.remainingSec
    : state.currentSessionElapsedSec

  const handleQuickTaskSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!quickTask.trim()) return
    await bridge.startTask(quickTask.trim())
    setQuickTask('')
  }

  const handleMouseDownEmbedded = (e: React.MouseEvent): void => {
    if (!embeddedPreview) return
    setDragging({ startX: e.clientX - dragPos.x, startY: e.clientY - dragPos.y })
  }

  React.useEffect(() => {
    if (!dragging || !embeddedPreview) return
    const onMove = (e: MouseEvent): void => {
      setDragPos({
        x: Math.max(8, Math.min(window.innerWidth - 320, e.clientX - dragging.startX)),
        y: Math.max(8, Math.min(window.innerHeight - 80, e.clientY - dragging.startY))
      })
    }
    const onUp = (): void => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, embeddedPreview])

  const wrapperStyle: React.CSSProperties = embeddedPreview
    ? {
        position: 'fixed',
        right: 'auto',
        left: `${dragPos.x}px`,
        top: `${dragPos.y}px`,
        width: '308px',
        opacity: prefs.opacity,
        zIndex: isPinned ? 60 : 30
      }
    : {
        width: '100%',
        height: '100%'
      }

  return (
    <div
      style={wrapperStyle}
      className="floating-surface overflow-hidden select-none text-[var(--text-primary)]"
    >
      {/* Frameless Drag Bar */}
      <div
        onMouseDown={handleMouseDownEmbedded}
        className={`drag-region flex items-center justify-between px-3 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] ${
          embeddedPreview ? 'cursor-move' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusTone.dot}`} />
          <span className="text-xs font-semibold truncate">{statusTone.label}</span>
          {isCollapsed && (
            <span className="font-mono text-xs font-bold tabular-nums text-[var(--accent)] ml-1">
              {formatClockTimer(primarySeconds)}
            </span>
          )}
        </div>

        <div className="no-drag flex items-center gap-1 shrink-0">
          <button
            id="widget-pin-btn"
            type="button"
            title={isPinned ? t('widget.unpinTooltip') : t('widget.pinTooltip')}
            onClick={() => void bridge.updateStickyWidgetPrefs({ alwaysOnTop: !isPinned })}
            className={`p-1 rounded-md transition-colors ${
              isPinned
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          <button
            id="widget-opacity-btn"
            type="button"
            title={t('widget.opacity')}
            onClick={() => setShowOpacity((v) => !v)}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            id="widget-collapse-btn"
            type="button"
            title={t('widget.collapseTooltip')}
            onClick={() => void bridge.updateStickyWidgetPrefs({ collapsed: !isCollapsed })}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>

          {!embeddedPreview && (
            <button
              id="widget-open-main-btn"
              type="button"
              title={t('widget.openMainTooltip')}
              onClick={() => void bridge.openMainWindow()}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            id="widget-close-btn"
            type="button"
            title={t('widget.closeTooltip')}
            onClick={() => void bridge.toggleStickyWidget(false)}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--coral)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Opacity Slider Bar */}
      {showOpacity && !isCollapsed && (
        <div className="no-drag px-3 py-1.5 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center gap-2 text-xs">
          <span className="text-[var(--text-secondary)]">{t('widget.opacity')}</span>
          <input
            type="range"
            min={0.35}
            max={1}
            step={0.05}
            value={prefs.opacity}
            onChange={(e) =>
              void bridge.updateStickyWidgetPrefs({ opacity: Number(e.target.value) })
            }
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="font-mono tabular-nums w-9 text-right">
            {Math.round(prefs.opacity * 100)}%
          </span>
        </div>
      )}

      {/* Expanded Body */}
      {!isCollapsed && (
        <div className="no-drag p-3 space-y-2.5">
          {/* Live Counter & Active Task */}
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-2xl font-bold tracking-tight tabular-nums">
              {formatClockTimer(primarySeconds)}
            </div>
            <div className="text-xs text-[var(--text-muted)] tabular-nums">
              Active {Math.floor(state.todayActiveSec / 3600)}h{' '}
              {Math.floor((state.todayActiveSec % 3600) / 60)}m
            </div>
          </div>

          {state.activeTask ? (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--accent-soft)] text-xs">
              <span className="font-medium truncate text-[var(--text-primary)]">
                {state.activeTask.title}
              </span>
              <button
                type="button"
                onClick={() => void bridge.stopActiveTask()}
                title={t('tasks.stopBtn')}
                className="p-1 rounded bg-[var(--accent)] text-[var(--accent-fg)] shrink-0 hover:opacity-90"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : null}

          {/* Quick Task Input for Daily Report */}
          <form onSubmit={(e) => void handleQuickTaskSubmit(e)} className="flex gap-1.5">
            <input
              id="widget-quick-task-input"
              type="text"
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              placeholder={t('widget.quickTaskPlaceholder')}
              className="input-control flex-1 !py-1.5 !px-2.5 !text-xs"
            />
            <button
              id="widget-quick-task-submit"
              type="submit"
              className="btn-primary px-2.5 py-1.5 text-xs flex items-center gap-1 shrink-0"
            >
              <Play className="w-3 h-3" />
            </button>
          </form>

          {/* Quick Manual Idle / Resume Actions */}
          {state.status !== 'active' ? (
            <button
              id="widget-resume-work-btn"
              type="button"
              onClick={() => void bridge.resumeFromIdle()}
              className="w-full btn-primary py-1.5 text-xs flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              {t('status.resumeWork')}
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => void bridge.startManualIdle('eating', t('tags.lunchQuick'))}
                className="btn-subtle py-1.5 px-1.5 text-[11px] font-medium flex items-center justify-center gap-1 truncate"
              >
                <Utensils className="w-3 h-3 text-[var(--amber)] shrink-0" />
                <span className="truncate">{t('tags.lunchQuick')}</span>
              </button>
              <button
                type="button"
                onClick={() => void bridge.startManualIdle('meeting', t('tags.meetingQuick'))}
                className="btn-subtle py-1.5 px-1.5 text-[11px] font-medium flex items-center justify-center gap-1 truncate"
              >
                <Users className="w-3 h-3 text-[var(--sky)] shrink-0" />
                <span className="truncate">{t('tags.meetingQuick')}</span>
              </button>
              <button
                type="button"
                onClick={() => void bridge.startManualIdle('rest', t('tags.shortBreakQuick'))}
                className="btn-subtle py-1.5 px-1.5 text-[11px] font-medium flex items-center justify-center gap-1 truncate"
              >
                <Coffee className="w-3 h-3 text-[var(--accent)] shrink-0" />
                <span className="truncate">{t('tags.shortBreakQuick')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
