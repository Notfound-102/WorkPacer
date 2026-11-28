import { contextBridge, ipcRenderer } from 'electron'
import {
  AnalyticsRange,
  AppSettings,
  DailyReportDocument,
  IdleTag,
  LanguageCode,
  LiveTrackingState,
  MainTabId,
  PomodoroPreset,
  PomodoroWidgetPrefs,
  QuickIdlePreset,
  QuickPresetIcon,
  StickyWidgetPrefs,
  UpdateCheckResult,
  WorkPacerAPI
} from '../shared/types'

const api: WorkPacerAPI = {
  getInitialData: () => ipcRenderer.invoke('app:getInitialData'),

  onStateUpdate: (cb: (state: LiveTrackingState) => void) => {
    const handler = (_e: unknown, state: LiveTrackingState): void => cb(state)
    ipcRenderer.on('tracking:state', handler)
    return () => ipcRenderer.removeListener('tracking:state', handler)
  },

  onSettingsUpdate: (cb: (settings: AppSettings) => void) => {
    const handler = (_e: unknown, settings: AppSettings): void => cb(settings)
    ipcRenderer.on('settings:updated', handler)
    return () => ipcRenderer.removeListener('settings:updated', handler)
  },

  onPresetsUpdate: (cb: (presets: QuickIdlePreset[]) => void) => {
    const handler = (_e: unknown, presets: QuickIdlePreset[]): void => cb(presets)
    ipcRenderer.on('presets:updated', handler)
    return () => ipcRenderer.removeListener('presets:updated', handler)
  },

  onTimelineChanged: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('timeline:changed', handler)
    return () => ipcRenderer.removeListener('timeline:changed', handler)
  },

  onUpdateStatus: (cb: (result: UpdateCheckResult) => void) => {
    const handler = (_e: unknown, result: UpdateCheckResult): void => cb(result)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },

  onNavigateTab: (cb: (tab: MainTabId) => void) => {
    const handler = (_e: unknown, tab: MainTabId): void => cb(tab)
    ipcRenderer.on('nav:tab', handler)
    return () => ipcRenderer.removeListener('nav:tab', handler)
  },

  updateSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:update', partial),
  setLanguage: (lang: LanguageCode) => ipcRenderer.invoke('settings:setLanguage', lang),

  startManualIdle: (tag: IdleTag, note?: string) =>
    ipcRenderer.invoke('tracking:startManualIdle', tag, note),
  resumeFromIdle: () => ipcRenderer.invoke('tracking:resumeFromIdle'),
  togglePauseTracking: () => ipcRenderer.invoke('tracking:togglePause'),

  getQuickIdlePresets: () => ipcRenderer.invoke('presets:get'),
  createQuickIdlePreset: (input: { label: string; icon: QuickPresetIcon; tag: IdleTag }) =>
    ipcRenderer.invoke('presets:create', input),
  updateQuickIdlePreset: (
    id: string,
    updates: Partial<{ label: string; icon: QuickPresetIcon; tag: IdleTag }>
  ) => ipcRenderer.invoke('presets:update', id, updates),
  deleteQuickIdlePreset: (id: string) => ipcRenderer.invoke('presets:delete', id),
  triggerQuickIdlePreset: (id: string) => ipcRenderer.invoke('presets:trigger', id),

  submitReturnTag: (sessionId: number, tag: IdleTag | null, note?: string) =>
    ipcRenderer.invoke('tracking:submitReturnTag', sessionId, tag, note),
  dismissReturnPopup: () => ipcRenderer.invoke('tracking:dismissReturnPopup'),

  startTask: (title: string, category?: string) =>
    ipcRenderer.invoke('tasks:start', title, category),
  stopActiveTask: () => ipcRenderer.invoke('tasks:stopActive'),
  getTasksByDate: (dateStr: string) => ipcRenderer.invoke('tasks:getByDate', dateStr),
  updateTask: (id: number, updates) => ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: number) => ipcRenderer.invoke('tasks:delete', id),

  startPomodoro: (preset?: PomodoroPreset, customFocus?: number, customBreak?: number) =>
    ipcRenderer.invoke('pomodoro:start', preset, customFocus, customBreak),
  pausePomodoro: () => ipcRenderer.invoke('pomodoro:pause'),
  resetPomodoro: () => ipcRenderer.invoke('pomodoro:reset'),
  skipPomodoroPhase: () => ipcRenderer.invoke('pomodoro:skip'),
  togglePomodoroWidget: (visible?: boolean) =>
    ipcRenderer.invoke('pomodoro:toggleWidget', visible),
  updatePomodoroWidgetPrefs: (prefs: Partial<PomodoroWidgetPrefs>) =>
    ipcRenderer.invoke('pomodoro:updateWidgetPrefs', prefs),

  triggerEyeBreakNow: () => ipcRenderer.invoke('health:triggerEyeBreakNow'),
  dismissBreakOverlay: (snoozeMinutes?: number) =>
    ipcRenderer.invoke('health:dismissBreakOverlay', snoozeMinutes),

  toggleStickyWidget: (visible?: boolean) => ipcRenderer.invoke('widget:toggle', visible),
  updateStickyWidgetPrefs: (prefs: Partial<StickyWidgetPrefs>) =>
    ipcRenderer.invoke('widget:updatePrefs', prefs),
  openMainWindow: (tab?: MainTabId) => ipcRenderer.invoke('window:openMain', tab),

  getAnalytics: (range: AnalyticsRange, anchorDate?: string) =>
    ipcRenderer.invoke('analytics:get', range, anchorDate),
  exportData: (format: 'csv' | 'json', startDate: string, endDate: string) =>
    ipcRenderer.invoke('analytics:export', format, startDate, endDate),
  sendSummaryNotificationNow: (period: 'daily' | 'weekly') =>
    ipcRenderer.invoke('analytics:sendSummaryNow', period),

  getDailyReport: (dateStr: string, forceRegenerate?: boolean) =>
    ipcRenderer.invoke('report:get', dateStr, forceRegenerate),
  saveDailyReport: (doc: DailyReportDocument) => ipcRenderer.invoke('report:save', doc),

  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('app:openExternalUrl', url)
}

contextBridge.exposeInMainWorld('workPacer', api)
contextBridge.exposeInMainWorld('idlePulse', api)
