import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  Activity,
  Bell,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
  Flame,
  Play,
  Settings2,
  Target,
  TrendingDown
} from 'lucide-react'
import {
  AnalyticsPayload,
  AnalyticsRange,
  AppSettings,
  LiveTrackingState,
  QuickIdlePreset,
  SessionRecord
} from '@shared/types'
import { bridge } from '../lib/bridge'
import {
  formatDurationHuman,
  formatTimeHM,
  getDaysAgoDateString,
  getTodayDateString
} from '../lib/formatters'
import { PresetIconView } from './WorkPacerLogo'
import { QuickPresetsManager } from './QuickPresetsManager'

interface DashboardViewProps {
  state: LiveTrackingState
  settings: AppSettings
  presets: QuickIdlePreset[]
}

export const DashboardView: React.FC<DashboardViewProps> = ({ state, settings, presets }) => {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<AnalyticsRange>('hour')
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [exportStart, setExportStart] = useState(getDaysAgoDateString(6))
  const [exportEnd, setExportEnd] = useState(getTodayDateString())
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [showPresetModal, setShowPresetModal] = useState(false)

  useEffect(() => {
    let active = true
    void bridge.getAnalytics(range).then((res) => {
      if (active) setAnalytics(res)
    })
    const timer = setInterval(() => {
      void bridge.getAnalytics(range).then((res) => {
        if (active) setAnalytics(res)
      })
    }, 10000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [range, state.status, state.todayActiveSec])

  const goalSec = Math.max(60, settings.dailyGoalMinutes * 60)
  const goalPct = Math.min(100, Math.round((state.todayActiveSec / goalSec) * 100))

  const totalDaySec = state.todayActiveSec + state.todayIdleSec
  const activeRatio =
    totalDaySec > 0 ? Math.round((state.todayActiveSec / totalDaySec) * 100) : 100
  const idleRatio = 100 - activeRatio

  const daysShort = (t('daysShort', { returnObjects: true }) as string[]) || [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat'
  ]

  const handleExport = async (fmt: 'csv' | 'json'): Promise<void> => {
    const res = await bridge.exportData(fmt, exportStart, exportEnd)
    if (res.success) {
      setExportStatus(`${fmt.toUpperCase()} (${res.rowCount} rows)`)
      setTimeout(() => setExportStatus(null), 4000)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('dashboard.subtitle')}</p>
        </div>

        <button
          id="dashboard-test-summary-btn"
          type="button"
          onClick={() => void bridge.sendSummaryNotificationNow('daily')}
          className="btn-subtle px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
        >
          <Bell className="w-3.5 h-3.5 text-[var(--accent)]" />
          {t('dashboard.sendDailySummary')}
        </button>
      </div>

      {/* Quick Manual Idle Strip (Frequency-Sorted + Manage Modal Trigger) */}
      <div className="card-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)] mr-1">
            {t('presets.title')}:
          </span>
          {state.status !== 'active' ? (
            <button
              type="button"
              onClick={() => void bridge.resumeFromIdle()}
              className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              {t('status.resumeWork')}
            </button>
          ) : (
            presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void bridge.triggerQuickIdlePreset(preset.id)}
                className="glass-pill-btn px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5"
              >
                <PresetIconView icon={preset.icon} className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>{preset.label}</span>
                {preset.usageCount > 0 && (
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {preset.usageCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPresetModal(true)}
          className="btn-subtle px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5 text-[var(--accent)]" />
          {t('presets.manageBtn')}
        </button>
      </div>

      {/* Liquid Glass Preset Management Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fluid-in">
          <div className="floating-surface max-w-lg w-full p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
            <QuickPresetsManager
              presets={presets}
              onClose={() => setShowPresetModal(false)}
            />
          </div>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="card-surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-semibold">{t('dashboard.activeToday')}</span>
            <Activity className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums">
            {formatDurationHuman(state.todayActiveSec)}
          </div>
          <div className="mt-1.5 text-xs text-[var(--text-muted)] truncate">
            {state.activeTask ? state.activeTask.title : t('tasks.noActiveTask')}
          </div>
        </div>

        <div className="card-surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-semibold">{t('dashboard.idleToday')}</span>
            <Clock className="w-4 h-4 text-[var(--amber)]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums">
            {formatDurationHuman(state.todayIdleSec)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)] tabular-nums">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--sky)]" />
              {formatDurationHuman(analytics?.breakBreakdown.microSec ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--amber)]" />
              {formatDurationHuman(analytics?.breakBreakdown.shortSec ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />
              {formatDurationHuman(analytics?.breakBreakdown.longSec ?? 0)}
            </span>
          </div>
        </div>

        <div className="card-surface p-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('dashboard.activeRatio')}
            </div>
            <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[var(--accent)]">
              {activeRatio}%
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
              Idle {idleRatio}%
            </div>
          </div>
          <div className="w-16 h-16 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: Math.max(1, activeRatio) },
                    { name: 'Idle', value: Math.max(0, idleRatio) }
                  ]}
                  dataKey="value"
                  innerRadius={20}
                  outerRadius={30}
                  stroke="none"
                >
                  <Cell fill="var(--accent)" />
                  <Cell fill="var(--amber)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-semibold">{t('dashboard.dailyGoal')}</span>
            <Target className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold tabular-nums">{goalPct}%</span>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {t('dashboard.goalProgress', {
                current: formatDurationHuman(state.todayActiveSec),
                target: formatDurationHuman(goalSec)
              })}
            </span>
          </div>
          <div className="mt-2 w-full h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${goalPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Screen-Time Bar Chart + Top Idle Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card-surface p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{t('dashboard.chartTitle')}</h2>
            <div className="inline-flex rounded-full bg-[var(--bg-subtle)] p-0.5 border border-[var(--border-subtle)]">
              {(['hour', 'day', 'week'] as AnalyticsRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    range === r
                      ? 'bg-[var(--bg-glass-pill)] text-[var(--accent)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {r === 'hour'
                    ? t('dashboard.rangeHour')
                    : r === 'day'
                      ? t('dashboard.rangeDay')
                      : t('dashboard.rangeWeek')}
                </button>
              ))}
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics?.chartPoints ?? []}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  unit="m"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-editor)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '14px',
                    fontSize: '12px'
                  }}
                />
                <Bar
                  dataKey="activeMin"
                  name={t('dashboard.activeLabel')}
                  stackId="a"
                  fill="var(--accent)"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="idleMin"
                  name={t('dashboard.idleLabel')}
                  stackId="a"
                  fill="var(--amber)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Idle Hours Leaderboard */}
        <div className="card-surface p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{t('dashboard.topIdleHours')}</h2>
              <TrendingDown className="w-4 h-4 text-[var(--amber)]" />
            </div>

            <div className="mt-3 space-y-3">
              {analytics && analytics.topIdleHours.length > 0 ? (
                analytics.topIdleHours.map((item, idx) => (
                  <div key={item.hour} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold tabular-nums">
                        #{idx + 1} {item.label}
                      </span>
                      <span className="text-[var(--text-secondary)] tabular-nums">
                        {t('dashboard.avgIdle', { min: item.avgIdleMin })}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--amber)]"
                        style={{ width: `${Math.max(8, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                  {t('dashboard.noIdleData')}
                </p>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-[var(--border-subtle)] grid grid-cols-3 gap-1.5 text-[11px]">
            <div className="p-2 rounded-xl bg-[var(--bg-subtle)]">
              <div className="font-semibold text-[var(--sky)]">{t('breakTypes.micro')}</div>
              <div className="text-[var(--text-muted)] truncate">{t('breakTypes.microDesc')}</div>
            </div>
            <div className="p-2 rounded-xl bg-[var(--bg-subtle)]">
              <div className="font-semibold text-[var(--amber)]">{t('breakTypes.short')}</div>
              <div className="text-[var(--text-muted)] truncate">{t('breakTypes.shortDesc')}</div>
            </div>
            <div className="p-2 rounded-xl bg-[var(--bg-subtle)]">
              <div className="font-semibold text-[var(--coral)]">{t('breakTypes.long')}</div>
              <div className="text-[var(--text-muted)] truncate">{t('breakTypes.longDesc')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Intraday Activity Timeline */}
      <div className="card-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{t('dashboard.intradayTimeline')}</h2>
          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
              {t('dashboard.activeLabel')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--sky)]" />
              {t('breakTypes.micro')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--amber)]" />
              {t('breakTypes.short')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--coral)]" />
              {t('breakTypes.long')}
            </span>
          </div>
        </div>

        <IntradayTimelineStrip sessions={analytics?.intradaySessions ?? []} key={i18n.language} />
      </div>

      {/* 7x24 Hourly Heatmap & History Export */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card-surface p-4 space-y-3 overflow-x-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[var(--amber)]" />
              {t('dashboard.heatmapTitle')}
            </h2>
            <span className="text-[11px] text-[var(--text-muted)]">00:00 – 23:00</span>
          </div>

          <div className="min-w-[520px] space-y-1">
            <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-[var(--text-muted)] font-mono">
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-center">
                  {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                </span>
              ))}
            </div>
            {Array.from({ length: 7 }, (_, dow) => (
              <div
                key={dow}
                className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-1 items-center"
              >
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                  {daysShort[dow]}
                </span>
                {Array.from({ length: 24 }, (_, hr) => {
                  const cell = analytics?.heatmap.find(
                    (c) => c.dayOfWeek === dow && c.hour === hr
                  )
                  const mins = cell?.idleMinutes ?? 0
                  const intensity =
                    mins === 0
                      ? 'bg-[var(--bg-subtle)]'
                      : mins < 10
                        ? 'bg-amber-400/35'
                        : mins < 25
                          ? 'bg-amber-500/65'
                          : 'bg-amber-500'
                  return (
                    <div
                      key={hr}
                      title={`${daysShort[dow]} ${String(hr).padStart(2, '0')}:00 — Idle ${mins}m`}
                      className={`h-4 rounded-sm transition-colors ${intensity}`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Export CSV / JSON Card */}
        <div className="card-surface p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold">{t('dashboard.exportTitle')}</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[var(--text-secondary)] space-y-1">
                <span>{t('dashboard.fromDate')}</span>
                <input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                  className="input-control w-full !py-1.5 !px-2 !text-xs"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)] space-y-1">
                <span>{t('dashboard.toDate')}</span>
                <input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                  className="input-control w-full !py-1.5 !px-2 !text-xs"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            {exportStatus && (
              <div className="text-xs font-medium text-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 rounded-full">
                Exported: {exportStatus}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="export-csv-btn"
                type="button"
                onClick={() => void handleExport('csv')}
                className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {t('dashboard.exportCsv')}
              </button>
              <button
                id="export-json-btn"
                type="button"
                onClick={() => void handleExport('json')}
                className="btn-subtle py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <FileJson className="w-3.5 h-3.5 text-[var(--accent)]" />
                {t('dashboard.exportJson')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const IntradayTimelineStrip: React.FC<{ sessions: SessionRecord[] }> = ({ sessions }) => {
  const { t } = useTranslation()
  if (sessions.length === 0) {
    return (
      <div className="h-9 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-xs text-[var(--text-muted)]">
        {t('dashboard.noIdleData')}
      </div>
    )
  }

  const now = Date.now()
  const firstStart = Math.min(...sessions.map((s) => s.startTime))
  const lastEnd = Math.max(...sessions.map((s) => s.endTime ?? now))
  const totalSpan = Math.max(60_000, lastEnd - firstStart)

  return (
    <div className="space-y-1.5">
      <div className="w-full h-7 rounded-full bg-[var(--bg-subtle)] overflow-hidden flex p-1 gap-[2px]">
        {sessions.map((s) => {
          const end = s.endTime ?? now
          const widthPct = Math.max(0.6, ((end - s.startTime) / totalSpan) * 100)
          const color =
            s.type === 'active'
              ? 'bg-[var(--accent)]'
              : s.breakCategory === 'micro'
                ? 'bg-[var(--sky)]'
                : s.breakCategory === 'short'
                  ? 'bg-[var(--amber)]'
                  : 'bg-[var(--coral)]'
          const label =
            s.type === 'active'
              ? t('dashboard.activeLabel')
              : s.note ||
                (s.tag
                  ? t(`tags.${s.tag}`)
                  : t(`breakTypes.${s.breakCategory === 'none' ? 'micro' : s.breakCategory}`))
          return (
            <div
              key={s.id}
              style={{ width: `${widthPct}%` }}
              title={`${formatTimeHM(s.startTime)}–${formatTimeHM(end)} • ${label} (${formatDurationHuman(s.durationSec)})`}
              className={`h-full first:rounded-l-full last:rounded-r-full ${color} transition-opacity hover:opacity-80`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)] tabular-nums px-1">
        <span>{formatTimeHM(firstStart)}</span>
        <span>{formatTimeHM(firstStart + totalSpan / 2)}</span>
        <span>{formatTimeHM(lastEnd)}</span>
      </div>
    </div>
  )
}
