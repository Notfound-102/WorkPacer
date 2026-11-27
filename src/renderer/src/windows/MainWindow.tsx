import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  CheckSquare,
  FileText,
  HeartPulse,
  Layers,
  Monitor,
  Moon,
  Pause,
  Play,
  Settings,
  Sun
} from 'lucide-react'
import {
  AppSettings,
  LanguageCode,
  LiveTrackingState,
  MainTabId,
  QuickIdlePreset,
  ThemeMode
} from '@shared/types'
import { bridge, isElectronEnv } from '../lib/bridge'
import { formatClockTimer } from '../lib/formatters'
import { WorkPacerLogo } from '../components/WorkPacerLogo'
import { DashboardView } from '../components/DashboardView'
import { TasksPomodoroView } from '../components/TasksPomodoroView'
import { DailyReportView } from '../components/DailyReportView'
import { HealthView } from '../components/HealthView'
import { SettingsView } from '../components/SettingsView'
import { StickyWidget } from './StickyWidget'
import { ReturnPopup } from './ReturnPopup'
import { BreakOverlay } from './BreakOverlay'

interface MainWindowProps {
  state: LiveTrackingState
  settings: AppSettings
  presets: QuickIdlePreset[]
  activeTab: MainTabId
  onSelectTab: (tab: MainTabId) => void
}

export const MainWindow: React.FC<MainWindowProps> = ({
  state,
  settings,
  presets,
  activeTab,
  onSelectTab
}) => {
  const { t } = useTranslation()

  const navItems: { id: MainTabId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: BarChart3 },
    { id: 'tasks', label: t('nav.tasks'), icon: CheckSquare },
    { id: 'report', label: t('nav.report'), icon: FileText },
    { id: 'health', label: t('nav.health'), icon: HeartPulse },
    { id: 'settings', label: t('nav.settings'), icon: Settings }
  ]

  const statusColor =
    state.status === 'paused'
      ? 'bg-[var(--slate-paused)]'
      : state.pomodoro.running
        ? 'bg-[var(--coral)]'
        : state.status === 'active'
          ? 'bg-[var(--accent)]'
          : 'bg-[var(--amber)]'

  const statusText =
    state.status === 'manual_idle' && state.currentPresetLabel
      ? state.currentPresetLabel
      : t(`status.${state.status}`)

  const themeOptions: { mode: ThemeMode; icon: React.FC<{ className?: string }>; title: string }[] =
    [
      { mode: 'light', icon: Sun, title: t('settings.themeLight') },
      { mode: 'dark', icon: Moon, title: t('settings.themeDark') },
      { mode: 'system', icon: Monitor, title: t('settings.themeSystem') }
    ]

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col ambient-mesh-bg text-[var(--text-primary)]">
      {/* Native Titlebar Drag Region (Matches Windows/macOS caption overlay height = 36px) */}
      <header className="drag-region h-9 shrink-0 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] pl-14 md:pl-1">
          <span>WorkPacer</span>
          <span>•</span>
          <span className="tabular-nums">
            {settings.shiftStart}–{settings.shiftEnd}
          </span>
        </div>
        <div className="w-32" />
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 px-3.5 pb-3.5">
        {/* Floating Liquid Glass Sidebar — Zero Vertical Scrollbar Guaranteed */}
        <aside className="w-full md:w-60 shrink-0 glass-sidebar p-3.5 flex flex-col justify-between overflow-hidden">
          {/* Top Section: Brand + Live Status Pill + Active Glass Pill Navigation */}
          <div className="space-y-3">
            {/* Brand Header */}
            <div className="flex items-center gap-2.5 px-1">
              <WorkPacerLogo size={32} />
              <div className="min-w-0">
                <div className="font-bold text-sm tracking-tight leading-none truncate">
                  {t('app.name')}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-1 truncate">
                  {settings.userName}
                </div>
              </div>
            </div>

            {/* Compact Live Status Pill Card */}
            <div className="px-3 py-2 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                  <span className="text-[11px] font-semibold truncate">{statusText}</span>
                </div>
                <div className="font-mono text-sm font-bold tabular-nums text-[var(--accent)] mt-0.5">
                  {formatClockTimer(state.currentSessionElapsedSec)}
                </div>
              </div>

              {state.status !== 'active' ? (
                <button
                  type="button"
                  title={t('status.resumeWork')}
                  onClick={() => void bridge.resumeFromIdle()}
                  className="btn-primary p-2 shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  title={t('status.pauseTracking')}
                  onClick={() => void bridge.togglePauseTracking()}
                  className="btn-subtle p-2 shrink-0"
                >
                  <Pause className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                </button>
              )}
            </div>

            {/* Navigation Items (Active Glass Pill) */}
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
              {navItems.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    id={`nav-tab-${id}`}
                    type="button"
                    onClick={() => onSelectTab(id)}
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-2.5 whitespace-nowrap transition-all duration-200 ${
                      active
                        ? 'nav-glass-pill-active'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Bottom Dock: Sticky Widget Toggle + Theme & Language Pills */}
          <div className="space-y-2 pt-2.5 border-t border-[var(--border-subtle)]">
            <button
              id="sidebar-toggle-sticky-widget"
              type="button"
              onClick={() => void bridge.toggleStickyWidget()}
              className={`w-full py-1.5 px-3.5 rounded-full text-xs font-semibold border flex items-center justify-between transition-all ${
                settings.stickyWidget.visible
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                  : 'btn-subtle'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('nav.stickyWidget')}</span>
              </span>
              <span className="text-[10px] uppercase font-bold">
                {settings.stickyWidget.visible ? 'ON' : 'OFF'}
              </span>
            </button>

            <div className="flex items-center justify-between gap-1.5">
              {/* Theme Quick Switch (Light / Dark / System) */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                {themeOptions.map(({ mode, icon: Icon, title }) => (
                  <button
                    key={mode}
                    type="button"
                    title={title}
                    onClick={() => void bridge.updateSettings({ theme: mode })}
                    className={`p-1.5 rounded-full transition-colors ${
                      settings.theme === mode
                        ? 'bg-[var(--bg-glass-pill)] text-[var(--accent)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {/* Realtime Language Switcher (VI / EN / JA) */}
              <div className="flex-1 grid grid-cols-3 gap-0.5 p-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                {(['vi', 'en', 'ja'] as LanguageCode[]).map((code) => (
                  <button
                    key={code}
                    id={`lang-switch-${code}`}
                    type="button"
                    onClick={() => void bridge.setLanguage(code)}
                    className={`py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                      settings.language === code
                        ? 'bg-[var(--bg-glass-pill)] text-[var(--accent)] shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Scrollable Content Pane with Fluid Tab Transition */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto pr-1">
          <div key={activeTab} className="animate-fluid-in pb-4">
            {activeTab === 'dashboard' && (
              <DashboardView state={state} settings={settings} presets={presets} />
            )}
            {activeTab === 'tasks' && (
              <TasksPomodoroView state={state} presets={presets} />
            )}
            {activeTab === 'report' && <DailyReportView settings={settings} />}
            {activeTab === 'health' && <HealthView state={state} settings={settings} />}
            {activeTab === 'settings' && (
              <SettingsView settings={settings} presets={presets} />
            )}
          </div>
        </main>
      </div>

      {/* Browser Preview Overlays */}
      {!isElectronEnv && settings.stickyWidget.visible && (
        <StickyWidget state={state} settings={settings} presets={presets} embeddedPreview />
      )}
      {!isElectronEnv && state.pendingReturnPopup && (
        <ReturnPopup popup={state.pendingReturnPopup} embedded />
      )}
      {!isElectronEnv && state.activeBreakOverlay && (
        <BreakOverlay overlay={state.activeBreakOverlay} settings={settings} embedded />
      )}
    </div>
  )
}
