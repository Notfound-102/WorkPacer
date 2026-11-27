import React from 'react'
import { useTranslation } from 'react-i18next'
import { BellRing, Eye, PersonStanding, Play, Target } from 'lucide-react'
import { AppSettings, LiveTrackingState } from '@shared/types'
import { bridge } from '../lib/bridge'
import { formatClockTimer, formatDurationHuman } from '../lib/formatters'

interface HealthViewProps {
  state: LiveTrackingState
  settings: AppSettings
}

export const HealthView: React.FC<HealthViewProps> = ({ state, settings }) => {
  const { t } = useTranslation()

  const goalSec = Math.max(60, settings.dailyGoalMinutes * 60)
  const goalPct = Math.min(100, Math.round((state.todayActiveSec / goalSec) * 100))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('health.title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('health.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. 20-20-20 Eye Care */}
        <div className="card-surface p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--sky-soft)] text-[var(--sky)] flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{t('health.eyeCareTitle')}</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {t('health.eyeCareDesc', { min: settings.eyeCareIntervalMinutes })}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={settings.eyeCareEnabled}
              onChange={(e) =>
                void bridge.updateSettings({ eyeCareEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-[var(--accent)] mt-1"
            />
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              {t('health.nextEyeBreak')}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-[var(--sky)]">
              {formatClockTimer(state.health.eyeCareRemainingSec)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="range"
              min={10}
              max={45}
              step={5}
              value={settings.eyeCareIntervalMinutes}
              onChange={(e) =>
                void bridge.updateSettings({ eyeCareIntervalMinutes: Number(e.target.value) })
              }
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="font-mono text-xs tabular-nums w-12 text-right">
              {settings.eyeCareIntervalMinutes}m
            </span>
          </div>

          <button
            id="health-test-eye-break-btn"
            type="button"
            onClick={() => void bridge.triggerEyeBreakNow()}
            className="w-full btn-subtle py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 text-[var(--sky)]" />
            {t('health.testEyeBreak')}
          </button>
        </div>

        {/* 2. Long Sitting Alert */}
        <div className="card-surface p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--amber-soft)] text-[var(--amber)] flex items-center justify-center shrink-0">
                <PersonStanding className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{t('health.sittingTitle')}</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {t('health.sittingDesc', { min: settings.longSittingMinutes })}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={settings.longSittingEnabled}
              onChange={(e) =>
                void bridge.updateSettings({ longSittingEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-[var(--accent)] mt-1"
            />
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              {t('health.continuousActive')}
            </span>
            <span className="font-mono text-lg font-bold tabular-nums text-[var(--amber)]">
              {formatDurationHuman(state.health.continuousActiveSec)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <input
              type="range"
              min={30}
              max={180}
              step={15}
              value={settings.longSittingMinutes}
              onChange={(e) =>
                void bridge.updateSettings({ longSittingMinutes: Number(e.target.value) })
              }
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="font-mono text-xs tabular-nums w-12 text-right">
              {settings.longSittingMinutes}m
            </span>
          </div>
        </div>

        {/* 3. Gentle Return-to-Work Nudge */}
        <div className="card-surface p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{t('health.returnWorkTitle')}</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {t('health.returnWorkDesc', { min: settings.returnToWorkMaxIdleMinutes })}
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={settings.returnToWorkReminderEnabled}
              onChange={(e) =>
                void bridge.updateSettings({ returnToWorkReminderEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-[var(--accent)] mt-1"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={settings.returnToWorkMaxIdleMinutes}
              onChange={(e) =>
                void bridge.updateSettings({
                  returnToWorkMaxIdleMinutes: Number(e.target.value)
                })
              }
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="font-mono text-xs tabular-nums w-12 text-right">
              {settings.returnToWorkMaxIdleMinutes}m
            </span>
          </div>
        </div>

        {/* 4. Daily Active Goal */}
        <div className="card-surface p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{t('health.dailyGoalTitle')}</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t('health.dailyGoalDesc')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium tabular-nums">
              <span>
                {formatDurationHuman(state.todayActiveSec)} /{' '}
                {formatDurationHuman(settings.dailyGoalMinutes * 60)}
              </span>
              <span className="text-[var(--accent)] font-bold">{goalPct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="range"
              min={60}
              max={720}
              step={30}
              value={settings.dailyGoalMinutes}
              onChange={(e) =>
                void bridge.updateSettings({ dailyGoalMinutes: Number(e.target.value) })
              }
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="font-mono text-xs tabular-nums w-14 text-right">
              {(settings.dailyGoalMinutes / 60).toFixed(1)}h
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
