import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  Globe,
  Monitor,
  Moon,
  Pin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  UserCheck
} from 'lucide-react'
import {
  AppSettings,
  LanguageCode,
  PomodoroClockStyle,
  QuickIdlePreset,
  SmartExceptionMode,
  ThemeMode,
  UpdateCheckResult
} from '@shared/types'
import { bridge } from '../lib/bridge'
import { WorkPacerLogo } from './WorkPacerLogo'
import { QuickPresetsManager } from './QuickPresetsManager'

interface SettingsViewProps {
  settings: AppSettings
  presets: QuickIdlePreset[]
  updateStatus: UpdateCheckResult | null
  onUpdateStatusChange: (res: UpdateCheckResult) => void
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  presets,
  updateStatus,
  onUpdateStatusChange
}) => {
  const { t } = useTranslation()
  const [appVersion, setAppVersion] = useState('1.2.0')
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    void bridge.getAppVersion().then((v) => {
      if (v) setAppVersion(v)
    })
  }, [])

  const handleCheckUpdate = async (): Promise<void> => {
    setCheckingUpdate(true)
    try {
      const res = await bridge.checkForUpdates()
      onUpdateStatusChange(res)
    } finally {
      setCheckingUpdate(false)
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Brand & Title Header */}
      <div className="flex items-center gap-3.5">
        <WorkPacerLogo size={42} />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* 1. Realtime Language, Liquid Glass Appearance & Reduce Transparency */}
      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold">{t('settings.languageThemeSection')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('settings.language')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { code: 'vi', label: 'Tiếng Việt' },
                  { code: 'en', label: 'English' },
                  { code: 'ja', label: '日本語' }
                ] as { code: LanguageCode; label: string }[]
              ).map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => void bridge.setLanguage(lang.code)}
                  className={`py-2 px-2.5 rounded-full text-xs font-semibold border transition-colors ${
                    settings.language === lang.code
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('settings.theme')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { mode: 'light', label: t('settings.themeLight'), icon: Sun },
                  { mode: 'dark', label: t('settings.themeDark'), icon: Moon },
                  { mode: 'system', label: t('settings.themeSystem'), icon: Monitor }
                ] as { mode: ThemeMode; label: string; icon: React.FC<{ className?: string }> }[]
              ).map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => void bridge.updateSettings({ theme: mode })}
                  className={`py-2 px-2.5 rounded-full text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                    settings.theme === mode
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* GPU Performance Switch: Reduce Transparency */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{t('settings.reduceTransparency')}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {t('settings.reduceTransparencyHint')}
            </p>
          </div>
          <input
            id="settings-reduce-transparency-toggle"
            type="checkbox"
            checked={settings.reduceTransparency}
            onChange={(e) =>
              void bridge.updateSettings({ reduceTransparency: e.target.checked })
            }
            className="w-4 h-4 accent-[var(--accent)] mt-1 shrink-0 cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Profile, Work Shift & Customizable Daily Report Title */}
      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold">{t('settings.profileShiftSection')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('settings.userName')}
            </span>
            <input
              id="settings-username-input"
              type="text"
              value={settings.userName}
              onChange={(e) => void bridge.updateSettings({ userName: e.target.value })}
              className="input-control w-full"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('settings.reportTitle')}
            </span>
            <input
              id="settings-report-title-input"
              type="text"
              value={settings.reportTitle}
              placeholder={t('settings.reportTitlePlaceholder')}
              onChange={(e) => void bridge.updateSettings({ reportTitle: e.target.value })}
              className="input-control w-full"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('settings.shiftStart')}
            </span>
            <input
              type="time"
              value={settings.shiftStart}
              onChange={(e) => void bridge.updateSettings({ shiftStart: e.target.value })}
              className="input-control w-full font-mono"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('settings.shiftEnd')}
            </span>
            <input
              type="time"
              value={settings.shiftEnd}
              onChange={(e) => void bridge.updateSettings({ shiftEnd: e.target.value })}
              className="input-control w-full font-mono"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span className="font-semibold">{t('settings.lunchWindow')}:</span>
          <input
            type="time"
            value={settings.lunchStart}
            onChange={(e) => void bridge.updateSettings({ lunchStart: e.target.value })}
            className="input-control !py-1 !px-2.5 font-mono !text-xs"
          />
          <span>~</span>
          <input
            type="time"
            value={settings.lunchEnd}
            onChange={(e) => void bridge.updateSettings({ lunchEnd: e.target.value })}
            className="input-control !py-1 !px-2.5 font-mono !text-xs"
          />
        </div>
      </div>

      {/* 3. Floating Pomodoro Clock Style (Synchronized with Floating Pomodoro Widget) */}
      <div className="card-surface p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-[var(--coral)]" />
              <h2 className="text-sm font-bold">{t('settings.pomodoroSection')}</h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('settings.pomodoroStyleDesc')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void bridge.togglePomodoroWidget()}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              settings.pomodoroWidget.visible
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                : 'btn-subtle'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>
              {settings.pomodoroWidget.visible
                ? t('tasks.unpinPomodoroBtn')
                : t('tasks.pinPomodoroBtn')}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              { id: 'analog', label: t('tasks.styleAnalog') },
              { id: 'digital', label: t('tasks.styleDigital') },
              { id: 'ring', label: t('tasks.styleRing') }
            ] as { id: PomodoroClockStyle; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                void bridge.updatePomodoroWidgetPrefs({ clockStyle: item.id })
              }
              className={`py-2 px-3 rounded-full text-xs font-semibold border transition-colors ${
                settings.pomodoroWidget.clockStyle === item.id
                  ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Quick Manual Idle Presets Manager (Max 6, Auto-Sorted by Usage) */}
      <div className="card-surface p-5">
        <QuickPresetsManager presets={presets} />
      </div>

      {/* 5. Core Idle Tracking & Smart Exceptions */}
      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold">{t('settings.trackingSection')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[var(--text-secondary)]">
                {t('settings.idleThreshold')}
              </span>
              <span className="font-mono font-bold text-[var(--accent)]">
                {settings.idleThresholdMinutes} min
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={settings.idleThresholdMinutes}
              onChange={(e) =>
                void bridge.updateSettings({ idleThresholdMinutes: Number(e.target.value) })
              }
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[var(--text-secondary)]">
                {t('settings.returnPopupThreshold')}
              </span>
              <span className="font-mono font-bold text-[var(--accent)]">
                {settings.returnPopupMinMinutes} min
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={settings.returnPopupMinMinutes}
              onChange={(e) =>
                void bridge.updateSettings({ returnPopupMinMinutes: Number(e.target.value) })
              }
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)] block">
            {t('settings.smartExceptions')}
          </label>
          <select
            value={settings.smartExceptionMode}
            onChange={(e) =>
              void bridge.updateSettings({
                smartExceptionMode: e.target.value as SmartExceptionMode
              })
            }
            className="input-control w-full sm:w-auto"
          >
            <option value="ignore">{t('settings.smartIgnore')}</option>
            <option value="flag">{t('settings.smartFlag')}</option>
            <option value="off">{t('settings.smartOff')}</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoResumeManualIdle}
            onChange={(e) =>
              void bridge.updateSettings({ autoResumeManualIdle: e.target.checked })
            }
            className="accent-[var(--accent)]"
          />
          <span>{t('settings.autoResumeManual')}</span>
        </label>
      </div>

      {/* 6. Automated Notifications */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold">{t('settings.notificationsSection')}</h2>
        </div>

        <div className="space-y-2 text-xs font-medium">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.endOfShiftNotification}
              onChange={(e) =>
                void bridge.updateSettings({ endOfShiftNotification: e.target.checked })
              }
              className="accent-[var(--accent)]"
            />
            <span>{t('settings.endOfShiftNotif')}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.dailySummaryNotification}
              onChange={(e) =>
                void bridge.updateSettings({ dailySummaryNotification: e.target.checked })
              }
              className="accent-[var(--accent)]"
            />
            <span>{t('settings.dailySummaryNotif')}</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.weeklySummaryNotification}
              onChange={(e) =>
                void bridge.updateSettings({ weeklySummaryNotification: e.target.checked })
              }
              className="accent-[var(--accent)]"
            />
            <span>{t('settings.weeklySummaryNotif')}</span>
          </label>
        </div>
      </div>

      {/* 7. App Version & Check for Update (GitHub Releases API) */}
      <div className="card-surface p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold">{t('settings.updateSection')}</h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
              {t('settings.currentVersion', { version: appVersion })}
            </p>
          </div>

          <button
            id="settings-check-update-btn"
            type="button"
            disabled={checkingUpdate}
            onClick={() => void handleCheckUpdate()}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
            <span>
              {checkingUpdate
                ? t('settings.checkingUpdate')
                : t('settings.checkForUpdateBtn')}
            </span>
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoCheckUpdates}
            onChange={(e) =>
              void bridge.updateSettings({ autoCheckUpdates: e.target.checked })
            }
            className="accent-[var(--accent)]"
          />
          <span>{t('settings.autoCheckUpdates')}</span>
        </label>

        {updateStatus && (
          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs animate-fluid-in">
            {updateStatus.hasUpdate && updateStatus.latestVersion ? (
              <>
                <div className="space-y-1">
                  <div className="font-bold text-[var(--accent)]">
                    {t('settings.updateAvailable', {
                      latest: updateStatus.latestVersion,
                      current: updateStatus.currentVersion
                    })}
                  </div>
                  {updateStatus.releaseNotes && (
                    <p className="text-[var(--text-secondary)] line-clamp-2 max-w-xl">
                      {updateStatus.releaseNotes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void bridge.openExternalUrl(updateStatus.releaseUrl)}
                  className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('settings.downloadUpdateBtn')}</span>
                </button>
              </>
            ) : updateStatus.error ? (
              <div className="flex flex-wrap items-center justify-between gap-2 w-full">
                <span className="text-[var(--amber)] font-medium">
                  {t('settings.updateCheckError')} ({updateStatus.error})
                </span>
                <button
                  type="button"
                  onClick={() => void bridge.openExternalUrl(updateStatus.releaseUrl)}
                  className="btn-subtle px-3 py-1 text-xs font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>GitHub Releases</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[var(--accent)] font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {t('settings.upToDate', { version: updateStatus.currentVersion })}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>{t('app.localPrivacy')}</span>
        </div>
      </div>
    </div>
  )
}
