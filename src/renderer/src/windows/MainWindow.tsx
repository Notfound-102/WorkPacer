import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  BarChart3,
  CheckSquare,
  FileText,
  HeartPulse,
  Layers,
  Play,
  Settings,
  Sparkles
} from 'lucide-react'
import { AppSettings, LanguageCode, LiveTrackingState, MainTabId } from '@shared/types'
import { bridge, isElectronEnv, simulateBrowserReturnPopup } from '../lib/bridge'
import { formatClockTimer } from '../lib/formatters'
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
  activeTab: MainTabId
  onSelectTab: (tab: MainTabId) => void
}

export const MainWindow: React.FC<MainWindowProps> = ({
  state,
  settings,
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

  const isIdle = state.status !== 'active'

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Sidebar */}
      <aside className="w-full md:w-64 shrink-0 bg-[var(--bg-sidebar)] border-b md:border-b-0 md:border-r border-[var(--border-subtle)] p-4 flex flex-col justify-between gap-4">
        <div className="space-y-4">
          {/* App Brand */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight leading-none">
                  {t('app.name')}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-1">
                  Shift {settings.shiftStart}–{settings.shiftEnd}
                </div>
              </div>
            </div>
          </div>

          {/* Live Status Card */}
          <div className="card-surface p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isIdle ? 'bg-[var(--amber)]' : 'bg-[var(--accent)]'
                  }`}
                />
                <span className="text-xs font-semibold truncate">
                  {t(`status.${state.status}`)}
                </span>
              </div>
              <span className="font-mono text-xs font-bold tabular-nums text-[var(--accent)]">
                {formatClockTimer(state.currentSessionElapsedSec)}
              </span>
            </div>

            {state.currentSmartException !== 'none' && (
              <div className="text-[11px] text-[var(--sky)] bg-[var(--sky-soft)] px-2 py-1 rounded">
                {state.currentSmartException === 'fullscreen_media'
                  ? t('status.smartExceptionMedia')
                  : t('status.smartExceptionCall')}
              </div>
            )}

            {isIdle && (
              <button
                type="button"
                onClick={() => void bridge.resumeFromIdle()}
                className="w-full btn-primary py-1.5 text-xs flex items-center justify-center gap-1"
              >
                <Play className="w-3 h-3" />
                {t('status.resumeWork')}
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  id={`nav-tab-${id}`}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
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

        {/* Bottom Controls: Sticky Widget Toggle + Realtime Language Bar */}
        <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
          <button
            id="sidebar-toggle-sticky-widget"
            type="button"
            onClick={() => void bridge.toggleStickyWidget()}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-between transition-colors ${
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

          {!isElectronEnv && (
            <button
              id="preview-simulate-return-btn"
              type="button"
              onClick={() => simulateBrowserReturnPopup(12)}
              className="w-full btn-subtle py-1.5 px-2.5 text-[11px] font-medium flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--amber)]" />
              <span>Demo Quick Tag Popup (12m)</span>
            </button>
          )}

          {/* Realtime Language Switcher */}
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
            {(['vi', 'en', 'ja'] as LanguageCode[]).map((code) => (
              <button
                key={code}
                id={`lang-switch-${code}`}
                type="button"
                onClick={() => void bridge.setLanguage(code)}
                className={`py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${
                  settings.language === code
                    ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-5 md:p-7 overflow-y-auto">
        {activeTab === 'dashboard' && <DashboardView state={state} settings={settings} />}
        {activeTab === 'tasks' && <TasksPomodoroView state={state} />}
        {activeTab === 'report' && <DailyReportView settings={settings} />}
        {activeTab === 'health' && <HealthView state={state} settings={settings} />}
        {activeTab === 'settings' && <SettingsView settings={settings} />}
      </main>

      {/* In-Browser Preview Overlays (In Electron these open as real OS Always-on-Top frameless windows!) */}
      {!isElectronEnv && settings.stickyWidget.visible && (
        <StickyWidget state={state} settings={settings} embeddedPreview />
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
