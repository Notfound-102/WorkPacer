import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  Cpu,
  Globe,
  Monitor,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck
} from 'lucide-react'
import {
  AppSettings,
  LanguageCode,
  QuickIdlePreset,
  SmartExceptionMode,
  ThemeMode
} from '@shared/types'
import { bridge } from '../lib/bridge'
import { WorkPacerLogo } from './WorkPacerLogo'
import { QuickPresetsManager } from './QuickPresetsManager'

interface SettingsViewProps {
  settings: AppSettings
  presets: QuickIdlePreset[]
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, presets }) => {
  const { t } = useTranslation()

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

      {/* 2. Quick Manual Idle Presets Manager (Max 6, Auto-Sorted by Usage) */}
      <div className="card-surface p-5">
        <QuickPresetsManager presets={presets} />
      </div>

      {/* 3. Profile & Work Shift (日報) */}
      <div className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold">{t('settings.profileShiftSection')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="space-y-1 sm:col-span-1">
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

      {/* 4. Core Idle Tracking & Smart Exceptions */}
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

      {/* 5. Automated Notifications & Local SQLite Privacy */}
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

        <div className="pt-3 mt-2 border-t border-[var(--border-subtle)] flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>{t('app.localPrivacy')}</span>
        </div>
      </div>
    </div>
  )
}
