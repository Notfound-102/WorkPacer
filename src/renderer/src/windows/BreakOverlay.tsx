import React from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Eye, PersonStanding, X } from 'lucide-react'
import { ActiveBreakOverlay, AppSettings } from '@shared/types'
import { bridge } from '../lib/bridge'

interface BreakOverlayProps {
  overlay: ActiveBreakOverlay
  settings: AppSettings
  embedded?: boolean
}

export const BreakOverlay: React.FC<BreakOverlayProps> = ({
  overlay,
  settings,
  embedded = false
}) => {
  const { t } = useTranslation()
  const isEye = overlay.kind === 'eye_20_20_20'
  const totalSec = isEye ? 20 : 30
  const pct = Math.max(0, Math.min(100, (overlay.countdownSec / totalSec) * 100))

  return (
    <div
      className={
        embedded
          ? 'fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[388px] floating-surface p-4 space-y-3'
          : 'w-full h-full floating-surface p-4 space-y-3 flex flex-col justify-between'
      }
    >
      <div className="drag-region flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="3.5"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke={isEye ? 'var(--sky)' : 'var(--amber)'}
                strokeWidth="3.5"
                strokeDasharray={113.1}
                strokeDashoffset={113.1 - (113.1 * pct) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute font-mono text-xs font-bold tabular-nums">
              {overlay.countdownSec}s
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              {isEye ? (
                <Eye className="w-4 h-4 text-[var(--sky)]" />
              ) : (
                <PersonStanding className="w-4 h-4 text-[var(--amber)]" />
              )}
              <h2 className="text-sm font-bold">
                {isEye ? t('health.overlayEyeTitle') : t('health.overlaySittingTitle')}
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {isEye
                ? t('health.overlayEyeInstruction')
                : t('health.overlaySittingInstruction', { min: settings.longSittingMinutes })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void bridge.dismissBreakOverlay()}
          className="no-drag p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="no-drag flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => void bridge.dismissBreakOverlay(5)}
          className="btn-subtle px-3 py-1.5 text-xs flex items-center gap-1.5"
        >
          <Clock className="w-3.5 h-3.5" />
          {t('health.snooze5m')}
        </button>
        <button
          type="button"
          onClick={() => void bridge.dismissBreakOverlay()}
          className="btn-primary px-3.5 py-1.5 text-xs"
        >
          {t('health.skipBreak')}
        </button>
      </div>
    </div>
  )
}
