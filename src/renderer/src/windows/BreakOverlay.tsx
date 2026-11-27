import React from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Eye, PersonStanding, X } from 'lucide-react'
import { ActiveBreakOverlay, AppSettings } from '@shared/types'
import { bridge } from '../lib/bridge'
import { WorkPacerLogo } from '../components/WorkPacerLogo'

interface BreakOverlayProps {
  overlay: ActiveBreakOverlay
  settings: AppSettings
  embedded?: boolean
}

export const BreakOverlay: React.FC<BreakOverlayProps> = ({
  overlay,
  settings
}) => {
  const { t } = useTranslation()
  const isEye = overlay.kind === 'eye_20_20_20'
  const totalSec = isEye ? 20 : 30
  const pct = Math.max(0, Math.min(100, (overlay.countdownSec / totalSec) * 100))

  const radius = 56
  const circumference = 2 * Math.PI * radius

  return (
    <div
      style={{
        backdropFilter: settings.reduceTransparency ? 'none' : 'blur(28px) saturate(165%)',
        WebkitBackdropFilter: settings.reduceTransparency ? 'none' : 'blur(28px) saturate(165%)'
      }}
      className="fixed inset-0 z-50 w-screen h-screen bg-slate-900/35 dark:bg-slate-950/65 flex items-center justify-center p-6 animate-fluid-in"
    >
      <div className="floating-surface max-w-md w-full p-7 rounded-3xl text-center space-y-5 relative">
        <button
          type="button"
          onClick={() => void bridge.dismissBreakOverlay()}
          className="no-drag absolute top-4 right-4 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand & Header */}
        <div className="flex flex-col items-center gap-2">
          <WorkPacerLogo size={38} />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--accent)]">
            {isEye ? (
              <Eye className="w-3.5 h-3.5 text-[var(--sky)]" />
            ) : (
              <PersonStanding className="w-3.5 h-3.5 text-[var(--amber)]" />
            )}
            <span>WorkPacer Wellness</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1">
            {isEye ? t('health.overlayEyeTitle') : t('health.overlaySittingTitle')}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm">
            {isEye
              ? t('health.overlayEyeInstruction')
              : t('health.overlaySittingInstruction', { min: settings.longSittingMinutes })}
          </p>
        </div>

        {/* Prominent Centered Countdown Ring */}
        <div className="flex justify-center py-1">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 132 132">
              <circle
                cx="66"
                cy="66"
                r={radius}
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="8"
              />
              <circle
                cx="66"
                cy="66"
                r={radius}
                fill="none"
                stroke={isEye ? 'var(--sky)' : 'var(--amber)'}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * pct) / 100}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-mono text-3xl font-bold tabular-nums">
                {overlay.countdownSec}s
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="no-drag flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => void bridge.dismissBreakOverlay(5)}
            className="btn-subtle px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            {t('health.snooze5m')}
          </button>
          <button
            type="button"
            onClick={() => void bridge.dismissBreakOverlay()}
            className="btn-primary px-5 py-2 text-xs"
          >
            {t('health.skipBreak')}
          </button>
        </div>
      </div>
    </div>
  )
}
