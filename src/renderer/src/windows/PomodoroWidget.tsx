import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock,
  ExternalLink,
  Pause,
  Pin,
  PinOff,
  Play,
  RotateCcw,
  SkipForward,
  Sliders,
  X
} from 'lucide-react'
import { AppSettings, LiveTrackingState, PomodoroClockStyle } from '@shared/types'
import { bridge } from '../lib/bridge'
import { PomodoroClockFace } from '../components/PomodoroClockFace'

interface PomodoroWidgetProps {
  state: LiveTrackingState
  settings: AppSettings
  embeddedPreview?: boolean
}

const STYLE_CYCLE: PomodoroClockStyle[] = ['ring', 'analog', 'digital']

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  state,
  settings,
  embeddedPreview = false
}) => {
  const { t } = useTranslation()
  const [showOpacity, setShowOpacity] = useState(false)
  const [dragPos, setDragPos] = useState({ x: 380, y: 84 })
  const [dragging, setDragging] = useState<{ startX: number; startY: number } | null>(null)

  const prefs = settings.pomodoroWidget
  const pomo = state.pomodoro
  const isPinned = prefs.alwaysOnTop
  const glassAlpha = Math.max(0.32, Math.min(0.98, prefs.opacity))

  const handleCycleStyle = (): void => {
    const idx = STYLE_CYCLE.indexOf(prefs.clockStyle)
    const next = STYLE_CYCLE[(idx + 1) % STYLE_CYCLE.length]
    void bridge.updatePomodoroWidgetPrefs({ clockStyle: next })
  }

  const handleMouseDownEmbedded = (e: React.MouseEvent): void => {
    if (!embeddedPreview) return
    setDragging({ startX: e.clientX - dragPos.x, startY: e.clientY - dragPos.y })
  }

  React.useEffect(() => {
    if (!dragging || !embeddedPreview) return
    const onMove = (e: MouseEvent): void => {
      setDragPos({
        x: Math.max(8, Math.min(window.innerWidth - 280, e.clientX - dragging.startX)),
        y: Math.max(8, Math.min(window.innerHeight - 100, e.clientY - dragging.startY))
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

  const cardContent = (
    <div
      style={{ '--widget-glass-alpha': glassAlpha } as React.CSSProperties}
      className="floating-surface w-full h-full overflow-hidden select-none text-[var(--text-primary)] flex flex-col justify-between animate-fluid-in"
    >
      {/* Frameless Drag Header (No app logo, clean status & controls) */}
      <div
        onMouseDown={handleMouseDownEmbedded}
        className={`drag-region flex items-center justify-between px-3.5 py-2 border-b border-[var(--border-subtle)] shrink-0 ${
          embeddedPreview ? 'cursor-move' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              pomo.phase === 'break' ? 'bg-[var(--accent)]' : 'bg-[var(--coral)]'
            }`}
          />
          <span className="text-xs font-semibold truncate">
            {pomo.phase === 'break'
              ? t('status.pomodoro_break')
              : t('status.pomodoro_focus')}
          </span>
        </div>

        <div className="no-drag flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            title={t('widget.switchClockStyleTooltip')}
            onClick={handleCycleStyle}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          <button
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

          <button
            type="button"
            title={isPinned ? t('widget.unpinTooltip') : t('widget.pinTooltip')}
            onClick={() => void bridge.updatePomodoroWidgetPrefs({ alwaysOnTop: !isPinned })}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          {!embeddedPreview && (
            <button
              type="button"
              title={t('widget.openMainTooltip')}
              onClick={() => void bridge.openMainWindow('tasks')}
              className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            title={t('widget.closeTooltip')}
            onClick={() => void bridge.togglePomodoroWidget(false)}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--coral)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Opacity Slider */}
      {showOpacity && (
        <div className="no-drag px-3.5 py-1.5 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex items-center gap-2 text-xs shrink-0">
          <span className="text-[var(--text-secondary)] font-medium">{t('widget.opacity')}</span>
          <input
            type="range"
            min={0.32}
            max={0.98}
            step={0.04}
            value={glassAlpha}
            onChange={(e) =>
              void bridge.updatePomodoroWidgetPrefs({ opacity: Number(e.target.value) })
            }
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="font-mono tabular-nums w-9 text-right font-semibold">
            {Math.round(glassAlpha * 100)}%
          </span>
        </div>
      )}

      {/* Clock Display (Analog / Digital / Ring) */}
      <div className="no-drag flex-1 min-h-0 flex flex-col items-center justify-center px-3">
        <PomodoroClockFace pomodoro={pomo} clockStyle={prefs.clockStyle} compact />
      </div>

      {/* Bottom Controls + Style Quick Switcher */}
      <div className="no-drag px-3.5 pb-3 pt-1 space-y-2 shrink-0">
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[10px] font-semibold">
          {(['analog', 'digital', 'ring'] as PomodoroClockStyle[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => void bridge.updatePomodoroWidgetPrefs({ clockStyle: st })}
              className={`py-1 rounded-full truncate px-1.5 transition-colors ${
                prefs.clockStyle === st
                  ? 'bg-[var(--bg-glass-pill)] text-[var(--accent)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {st === 'analog'
                ? t('tasks.styleAnalog')
                : st === 'digital'
                  ? t('tasks.styleDigital')
                  : t('tasks.styleRing')}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2">
          {pomo.running ? (
            <button
              type="button"
              onClick={() => void bridge.pausePomodoro()}
              className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" />
              {t('tasks.pausePomo')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                void bridge.startPomodoro(pomo.phase === 'idle' ? pomo.preset : undefined)
              }
              className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              {t('tasks.startPomo')}
            </button>
          )}

          <button
            type="button"
            onClick={() => void bridge.skipPomodoroPhase()}
            title={t('tasks.skipPhase')}
            className="btn-subtle p-1.5 text-xs"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => void bridge.resetPomodoro()}
            title={t('tasks.resetPomo')}
            className="btn-subtle p-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  if (embeddedPreview) {
    return (
      <div
        style={{
          position: 'fixed',
          left: `${dragPos.x}px`,
          top: `${dragPos.y}px`,
          width: `${prefs.width ?? 276}px`,
          height: `${prefs.height ?? 308}px`,
          zIndex: isPinned ? 60 : 35
        }}
      >
        {cardContent}
      </div>
    )
  }

  return <div className="floating-widget-shell">{cardContent}</div>
}
