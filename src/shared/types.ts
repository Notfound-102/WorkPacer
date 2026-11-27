export type LanguageCode = 'en' | 'vi' | 'ja'
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export type SessionType = 'active' | 'auto_idle' | 'manual_idle' | 'system_offline'
export type BreakCategory = 'none' | 'micro' | 'short' | 'long'
export type IdleTag = 'eating' | 'rest' | 'meeting' | 'out' | 'sleep' | 'other'

export type SmartExceptionMode = 'ignore' | 'flag' | 'off'
export type SmartExceptionReason = 'none' | 'fullscreen_media' | 'call_active'

export type QuickPresetIcon =
  | 'utensils'
  | 'users'
  | 'coffee'
  | 'footprints'
  | 'moon'
  | 'phone'
  | 'book'
  | 'dumbbell'
  | 'sparkles'

export const MAX_QUICK_IDLE_PRESETS = 6

export interface QuickIdlePreset {
  id: string
  label: string
  icon: QuickPresetIcon
  tag: IdleTag
  usageCount: number
  lastUsedAt: number
  createdAt: number
}

export interface SessionRecord {
  id: number
  type: SessionType
  startTime: number // epoch ms
  endTime: number | null // null if ongoing
  durationSec: number
  breakCategory: BreakCategory
  tag: IdleTag | null
  note: string
  smartException: SmartExceptionReason
  isManual: boolean
}

export interface TaskRecord {
  id: number
  title: string
  startTime: number // epoch ms
  endTime: number | null // null if currently active
  durationSec: number
  category: string
}

export type PomodoroPreset = '25_5' | '50_10' | 'custom'
export type PomodoroPhase = 'idle' | 'focus' | 'break'

export interface PomodoroState {
  running: boolean
  phase: PomodoroPhase
  preset: PomodoroPreset
  focusMinutes: number
  breakMinutes: number
  remainingSec: number
  completedFocusCount: number
}

export interface HealthState {
  eyeCareRemainingSec: number
  eyeBreakCountdownSec: number | null
  continuousActiveSec: number
  sittingAlertActive: boolean
}

export interface StickyWidgetPrefs {
  visible: boolean
  alwaysOnTop: boolean
  collapsed: boolean
  opacity: number
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface WindowBoundsPrefs {
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface AppSettings {
  language: LanguageCode
  theme: ThemeMode
  reduceTransparency: boolean
  userName: string
  shiftStart: string // "08:30"
  shiftEnd: string // "17:30"
  lunchStart: string // "12:00"
  lunchEnd: string // "13:00"
  hideLunchInReport: boolean
  mergeMicroBreaksMinutes: number
  idleThresholdMinutes: number // 1-15, default 2
  smartExceptionMode: SmartExceptionMode
  returnPopupMinMinutes: number // default 5
  autoResumeManualIdle: boolean
  dailyGoalMinutes: number // default 240 (4h)
  eyeCareEnabled: boolean
  eyeCareIntervalMinutes: number // 20
  longSittingEnabled: boolean
  longSittingMinutes: number // default 90
  returnToWorkReminderEnabled: boolean
  returnToWorkMaxIdleMinutes: number // default 20
  dailySummaryNotification: boolean
  weeklySummaryNotification: boolean
  endOfShiftNotification: boolean
  stickyWidget: StickyWidgetPrefs
  returnPopupBounds?: WindowBoundsPrefs
}

export interface PendingReturnPopup {
  sessionId: number
  durationSec: number
  startTime: number
  endTime: number
}

export interface ActiveBreakOverlay {
  kind: 'eye_20_20_20' | 'long_sitting'
  countdownSec: number
}

export interface LiveTrackingState {
  status: 'active' | 'auto_idle' | 'manual_idle' | 'paused'
  resolvedTheme: ResolvedTheme
  osIdleSec: number
  currentSessionStart: number
  currentSessionElapsedSec: number
  currentManualTag: IdleTag | null
  currentPresetLabel: string | null
  currentSmartException: SmartExceptionReason
  activeTask: TaskRecord | null
  todayActiveSec: number
  todayIdleSec: number
  pomodoro: PomodoroState
  health: HealthState
  pendingReturnPopup: PendingReturnPopup | null
  activeBreakOverlay: ActiveBreakOverlay | null
}

export type AnalyticsRange = 'hour' | 'day' | 'week'

export interface ChartDataPoint {
  label: string
  activeMin: number
  idleMin: number
  microMin: number
  shortMin: number
  longMin: number
}

export interface HeatmapCell {
  dayOfWeek: number // 0 (Sun) - 6 (Sat)
  hour: number // 0 - 23
  idleMinutes: number
}

export interface TopIdleHourItem {
  hour: number
  label: string // e.g., "14:00–15:00"
  totalIdleMin: number
  avgIdleMin: number
  percentage: number
}

export interface AnalyticsPayload {
  range: AnalyticsRange
  chartPoints: ChartDataPoint[]
  todayActiveSec: number
  todayIdleSec: number
  activeRatioPercent: number
  breakBreakdown: {
    microSec: number
    shortSec: number
    longSec: number
  }
  intradaySessions: SessionRecord[]
  heatmap: HeatmapCell[]
  topIdleHours: TopIdleHourItem[]
}

export interface DailyReportRow {
  id: string
  startTime: string // "8:30"
  endTime: string // "9:30"
  content: string
}

export interface DailyReportDocument {
  date: string // "YYYY-MM-DD"
  shiftStart: string
  shiftEnd: string
  rows: DailyReportRow[]
  updatedAt: number
}

export type MainTabId = 'dashboard' | 'tasks' | 'report' | 'health' | 'settings'

export interface ExportResult {
  success: boolean
  filePath?: string
  content?: string
  rowCount: number
}

export interface WorkPacerAPI {
  getInitialData: () => Promise<{
    state: LiveTrackingState
    settings: AppSettings
    tasksToday: TaskRecord[]
    quickIdlePresets: QuickIdlePreset[]
  }>
  onStateUpdate: (cb: (state: LiveTrackingState) => void) => () => void
  onSettingsUpdate: (cb: (settings: AppSettings) => void) => () => void
  onPresetsUpdate: (cb: (presets: QuickIdlePreset[]) => void) => () => void
  onNavigateTab: (cb: (tab: MainTabId) => void) => () => void

  // Settings & Language
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  setLanguage: (lang: LanguageCode) => Promise<AppSettings>

  // Manual Idle, Pause & Quick Idle Presets (Max 6, sorted by usage frequency)
  startManualIdle: (tag: IdleTag, note?: string) => Promise<void>
  resumeFromIdle: () => Promise<void>
  togglePauseTracking: () => Promise<void>
  getQuickIdlePresets: () => Promise<QuickIdlePreset[]>
  createQuickIdlePreset: (input: {
    label: string
    icon: QuickPresetIcon
    tag: IdleTag
  }) => Promise<QuickIdlePreset[]>
  updateQuickIdlePreset: (
    id: string,
    updates: Partial<{ label: string; icon: QuickPresetIcon; tag: IdleTag }>
  ) => Promise<QuickIdlePreset[]>
  deleteQuickIdlePreset: (id: string) => Promise<QuickIdlePreset[]>
  triggerQuickIdlePreset: (id: string) => Promise<QuickIdlePreset[]>

  // Return Popup
  submitReturnTag: (sessionId: number, tag: IdleTag | null, note?: string) => Promise<void>
  dismissReturnPopup: () => Promise<void>

  // Tasks
  startTask: (title: string, category?: string) => Promise<TaskRecord>
  stopActiveTask: () => Promise<void>
  getTasksByDate: (dateStr: string) => Promise<TaskRecord[]>
  updateTask: (
    id: number,
    updates: Partial<Pick<TaskRecord, 'title' | 'startTime' | 'endTime'>>
  ) => Promise<void>
  deleteTask: (id: number) => Promise<void>

  // Pomodoro
  startPomodoro: (
    preset?: PomodoroPreset,
    customFocus?: number,
    customBreak?: number
  ) => Promise<void>
  pausePomodoro: () => Promise<void>
  resetPomodoro: () => Promise<void>
  skipPomodoroPhase: () => Promise<void>

  // Health & Break Overlay
  triggerEyeBreakNow: () => Promise<void>
  dismissBreakOverlay: (snoozeMinutes?: number) => Promise<void>

  // Sticky Widget & Window Controls
  toggleStickyWidget: (visible?: boolean) => Promise<AppSettings>
  updateStickyWidgetPrefs: (prefs: Partial<StickyWidgetPrefs>) => Promise<AppSettings>
  openMainWindow: (tab?: MainTabId) => Promise<void>

  // Analytics & Export
  getAnalytics: (range: AnalyticsRange, anchorDate?: string) => Promise<AnalyticsPayload>
  exportData: (format: 'csv' | 'json', startDate: string, endDate: string) => Promise<ExportResult>
  sendSummaryNotificationNow: (period: 'daily' | 'weekly') => Promise<void>

  // Daily Report (日報)
  getDailyReport: (dateStr: string, forceRegenerate?: boolean) => Promise<DailyReportDocument>
  saveDailyReport: (doc: DailyReportDocument) => Promise<DailyReportDocument>
}

export type IdlePulseAPI = WorkPacerAPI

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'vi',
  theme: 'light',
  reduceTransparency: false,
  userName: 'Nguyen Van A',
  shiftStart: '08:30',
  shiftEnd: '17:30',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  hideLunchInReport: true,
  mergeMicroBreaksMinutes: 5,
  idleThresholdMinutes: 2,
  smartExceptionMode: 'ignore',
  returnPopupMinMinutes: 5,
  autoResumeManualIdle: false,
  dailyGoalMinutes: 240,
  eyeCareEnabled: true,
  eyeCareIntervalMinutes: 20,
  longSittingEnabled: true,
  longSittingMinutes: 90,
  returnToWorkReminderEnabled: true,
  returnToWorkMaxIdleMinutes: 20,
  dailySummaryNotification: true,
  weeklySummaryNotification: true,
  endOfShiftNotification: true,
  stickyWidget: {
    visible: false,
    alwaysOnTop: true,
    collapsed: false,
    opacity: 0.88,
    width: 332,
    height: 304
  }
}

export function classifyBreakDuration(durationSec: number): BreakCategory {
  if (durationSec < 300) return 'micro' // < 5 min
  if (durationSec <= 1800) return 'short' // 5 - 30 min
  return 'long' // > 30 min
}
