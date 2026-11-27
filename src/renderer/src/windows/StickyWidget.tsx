import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pause,
  Pin,
  PinOff,
  Play,
  Settings2,
  Sliders,
  X
} from 'lucide-react'
import { AppSettings, LiveTrackingState, QuickIdlePreset } from '@shared/types'
import { bridge } from '../lib/bridge'
import { formatClockTimer } from '../lib/formatters'
import { PresetIconView, WorkPacerLogo } from '../components/WorkPacerLogo'
import { QuickPresetsManager } from '../components/QuickPresetsManager'

interface StickyWidgetProps {
  state: LiveTrackingState
  settings: AppSettings
  presets: QuickIdlePreset[]
  embeddedPreview?: boolean
}

export const StickyWidget: React.FC<StickyWidgetProps> = ({
  state,
  settings,
  presets,
  embeddedPreview = false
}) => {
  const { t } = useTranslation()
  const [quickTask, setQuickTask] = useState('')
  const [showOpacity, setShowOpacity] = useState(false)
  const [showPresetEditor, setShowPresetEditor] = useState(false)
  const [dragPos, setDragPos] = useState({ x: 24, y: 76 })
  const [dragging, setDragging] = useState<{ startX: number; startY: number } | null>(null)

  const prefs = settings.stickyWidget
  const isPinned = prefs.alwaysOnTop
  const isCollapsed = prefs.collapsed

  const statusTone =
    state.status === 'paused'
      ? { dot: 'bg-[var(--slate-paused)]', label: t('status.paused') }
      : state.pomodoro.running && state.pomodoro.phase === 'focus'
        ? { dot: 'bg-[var(--coral)]', label: t('status.pomodoro_focus') }
        : state.status === 'active'
          ? { dot: 'bg-[var(--accent)]', label: t('status.active') }
          : state.status === 'manual_idle'
            ? {
                dot: 'bg-[var(--amber)]',
                label: state.currentPresetLabel || t('status.manual_idle')
              }
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
        x: Math.max(8, Math.min(window.innerWidth - 330, e.clientX - dragging.startX)),
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

  const glassAlpha = Math.max(0.32, Math.min(0.98, prefs.opacity))

  const wrapperStyle: React.CSSProperties = embeddedPreview
    ? ({
        position: 'fixed',
        left: `${dragPos.x}px`,
        top: `${dragPos.y}px`,
        width: `${prefs.width ?? 332}px`,
        zIndex: isPinned ? 60 : 30,
        '--widget-glass-alpha': glassAlpha
      } as React.CSSProperties)
    : ({
        width: '100%',
        height: '100%',
        '--widget-glass-alpha': glassAlpha
      } as React.CSSProperties)

  return (
    <div
      style={wrapperStyle}
      className="floating-surface overflow-hidden select-none text-[var(--text-primary)] flex flex-col justify-between animate-fluid-in"
    >
      {/* Frameless Liquid Glass Drag Bar (Pin Always-on-Top stays fixed here) */}
      <div
        onMouseDown={handleMouseDownEmbedded}
        className={`drag-region flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border-subtle)] shrink-0 ${
          embeddedPreview ? 'cursor-move' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <WorkPacerLogo size={18} />
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusTone.dot}`} />
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
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          {!isCollapsed && (
            <>
              <button
                id="widget-manage-presets-btn"
                type="button"
                title={t('widget.managePresetsTooltip')}
                onClick={() => setShowPresetEditor((v) => !v)}
                className={`p-1.5 rounded-full transition-colors ${
                  showPresetEditor
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>

              <button
                id="widget-opacity-btn"
                type="button"
                title={t('widget.opacity')}
                onClick={() => setShowOpacity((v) => !v)}
                className={`p-1.5 rounded-full transition-colors ${
                  showOpacity
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            id="widget-collapse-btn"
            type="button"
            title={t('widget.collapseTooltip')}
            onClick={() => void bridge.updateStickyWidgetPrefs({ collapsed: !isCollapsed })}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
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
              className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            id="widget-close-btn"
            type="button"
            title={t('widget.closeTooltip')}
            onClick={() => void bridge.toggleStickyWidget(false)}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--coral)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Glass Layer Translucency Slider (keeps text & buttons crisp!) */}
      {showOpacity && !isCollapsed && (
        <div className="no-drag px-3.5 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center gap-2.5 text-xs shrink-0">
          <span className="text-[var(--text-secondary)] font-medium">{t('widget.opacity')}</span>
          <input
            type="range"
            min={0.32}
            max={0.98}
            step={0.04}
            value={glassAlpha}
            onChange={(e) =>
              void bridge.updateStickyWidgetPrefs({ opacity: Number(e.target.value) })
            }
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="font-mono tabular-nums w-9 text-right font-semibold">
            {Math.round(glassAlpha * 100)}%
          </span>
        </div>
      )}

      {/* Expanded Responsive Body */}
      {!isCollapsed && (
        <div className="no-drag p-3.5 flex-1 min-h-0 overflow-y-auto flex flex-col justify-between gap-2.5">
          {showPresetEditor ? (
            <QuickPresetsManager
              presets={presets}
              compactModal
              onClose={() => setShowPresetEditor(false)}
            />
          ) : (
            <>
              <div className="space-y-2.5">
                {/* Live Counter & Pause/Active Summary */}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
                    {formatClockTimer(primarySeconds)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--text-secondary)] font-medium tabular-nums">
                      {Math.floor(state.todayActiveSec / 3600)}h{' '}
                      {Math.floor((state.todayActiveSec % 3600) / 60)}m
                    </span>
                    <button
                      type="button"
                      title={
                        state.status === 'paused'
                          ? t('status.resumeTracking')
                          : t('status.pauseTracking')
                      }
                      onClick={() => void bridge.togglePauseTracking()}
                      className="btn-subtle p-1.5 text-xs"
                    >
                      {state.status === 'paused' ? (
                        <Play className="w-3 h-3 text-[var(--accent)]" />
                      ) : (
                        <Pause className="w-3 h-3 text-[var(--text-secondary)]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Active Task Pill */}
                {state.activeTask && (
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-soft)] border border-[var(--border-subtle)] text-xs">
                    <span className="font-semibold truncate text-[var(--text-primary)]">
                      {state.activeTask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => void bridge.stopActiveTask()}
                      title={t('tasks.stopBtn')}
                      className="p-1 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] shrink-0 hover:opacity-90"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Quick Task Input */}
                <form onSubmit={(e) => void handleQuickTaskSubmit(e)} className="flex gap-1.5">
                  <input
                    id="widget-quick-task-input"
                    type="text"
                    value={quickTask}
                    onChange={(e) => setQuickTask(e.target.value)}
                    placeholder={t('widget.quickTaskPlaceholder')}
                    className="input-control flex-1 !rounded-full !py-1.5 !px-3 !text-xs"
                  />
                  <button
                    id="widget-quick-task-submit"
                    type="submit"
                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                </form>
              </div>

              {/* Quick Manual Idle Buttons (Sorted by usage_count DESC, last_used_at DESC, up to 6) */}
              {state.status !== 'active' ? (
                <button
                  id="widget-resume-work-btn"
                  type="button"
                  onClick={() => void bridge.resumeFromIdle()}
                  className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t('status.resumeWork')}
                </button>
              ) : (
                <div
                  className={`grid gap-1.5 pt-0.5 ${
                    presets.length <= 2
                      ? 'grid-cols-2'
                      : 'grid-cols-2 sm:grid-cols-3'
                  }`}
                >
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => void bridge.triggerQuickIdlePreset(preset.id)}
                      title={`${preset.label} (${t('presets.usageBadge', { count: preset.usageCount })})`}
                      className="glass-pill-btn py-1.5 px-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 truncate"
                    >
                      <PresetIconView
                        icon={preset.icon}
                        className="w-3.5 h-3.5 text-[var(--accent)] shrink-0"
                      />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
