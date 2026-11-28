import {
  AnalyticsPayload,
  AnalyticsRange,
  AppSettings,
  classifyBreakDuration,
  DailyReportDocument,
  DEFAULT_SETTINGS,
  HeatmapCell,
  IdleTag,
  LanguageCode,
  LiveTrackingState,
  MainTabId,
  MAX_QUICK_IDLE_PRESETS,
  PomodoroPreset,
  PomodoroWidgetPrefs,
  QuickIdlePreset,
  QuickPresetIcon,
  ResolvedTheme,
  SessionRecord,
  StickyWidgetPrefs,
  TaskRecord,
  UpdateCheckResult,
  WorkPacerAPI
} from '@shared/types'
import {
  epochToDayMinutes,
  getDayStartMs,
  minutesToReportTime,
  sortReportRowsChronologically,
  synthesizeDailyReportRows
} from '@shared/reportFormatter'
import { translateMain } from '@shared/i18nResources'
import { getTodayDateString } from './formatters'

type Listener<T> = (payload: T) => void

export function createMockBridge(): WorkPacerAPI & {
  simulateReturnPopup: (minutesAway?: number) => void
} {
  let settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    stickyWidget: { ...DEFAULT_SETTINGS.stickyWidget, visible: false },
    pomodoroWidget: { ...DEFAULT_SETTINGS.pomodoroWidget, visible: false }
  }

  let presets: QuickIdlePreset[] = [
    {
      id: 'preset-lunch',
      label: 'Đi ăn trưa',
      icon: 'utensils',
      tag: 'eating',
      usageCount: 5,
      lastUsedAt: Date.now() - 3600_000,
      createdAt: 1
    },
    {
      id: 'preset-meeting',
      label: 'Họp',
      icon: 'users',
      tag: 'meeting',
      usageCount: 3,
      lastUsedAt: Date.now() - 7200_000,
      createdAt: 2
    },
    {
      id: 'preset-short-break',
      label: 'Nghỉ ngắn',
      icon: 'coffee',
      tag: 'rest',
      usageCount: 2,
      lastUsedAt: Date.now() - 9000_000,
      createdAt: 3
    }
  ]

  const sortPresets = (list: QuickIdlePreset[]): QuickIdlePreset[] =>
    [...list].sort(
      (a, b) =>
        b.usageCount - a.usageCount ||
        b.lastUsedAt - a.lastUsedAt ||
        a.createdAt - b.createdAt
    )

  const todayStr = getTodayDateString()
  const dayStart = getDayStartMs(todayStr)
  const at = (h: number, m: number): number => dayStart + (h * 60 + m) * 60 * 1000

  let nextSessionId = 10
  let nextTaskId = 10
  let isPaused = false
  let pausedAt = 0
  let currentPresetLabel: string | null = null

  const sessions: SessionRecord[] = [
    {
      id: 1,
      type: 'active',
      startTime: at(8, 30),
      endTime: at(9, 36),
      durationSec: 66 * 60,
      breakCategory: 'none',
      tag: null,
      note: '',
      smartException: 'none',
      isManual: false
    },
    {
      id: 2,
      type: 'auto_idle',
      startTime: at(9, 36),
      endTime: at(9, 39),
      durationSec: 180,
      breakCategory: 'micro',
      tag: 'rest',
      note: 'Uống nước',
      smartException: 'none',
      isManual: false
    },
    {
      id: 3,
      type: 'active',
      startTime: at(9, 39),
      endTime: at(12, 0),
      durationSec: 141 * 60,
      breakCategory: 'none',
      tag: null,
      note: '',
      smartException: 'none',
      isManual: false
    },
    {
      id: 4,
      type: 'manual_idle',
      startTime: at(12, 0),
      endTime: at(13, 0),
      durationSec: 3600,
      breakCategory: 'long',
      tag: 'eating',
      note: 'Nghỉ trưa',
      smartException: 'none',
      isManual: true
    },
    {
      id: 5,
      type: 'active',
      startTime: Date.now() - 34 * 60 * 1000,
      endTime: null,
      durationSec: 34 * 60,
      breakCategory: 'none',
      tag: null,
      note: '',
      smartException: 'none',
      isManual: false
    }
  ]

  let tasks: TaskRecord[] = [
    {
      id: 1,
      title: 'Review PR #128 & đồng bộ sprint backlog',
      startTime: at(8, 30),
      endTime: at(9, 36),
      durationSec: 66 * 60,
      category: 'review'
    },
    {
      id: 2,
      title: 'Thiết kế giao diện Liquid Glass cho WorkPacer',
      startTime: at(9, 39),
      endTime: at(12, 0),
      durationSec: 141 * 60,
      category: 'design'
    },
    {
      id: 3,
      title: 'Hoàn thiện Báo cáo cuối ngày',
      startTime: Date.now() - 34 * 60 * 1000,
      endTime: null,
      durationSec: 34 * 60,
      category: 'feature'
    }
  ]

  const savedReports = new Map<string, DailyReportDocument>()
  const stateListeners = new Set<Listener<LiveTrackingState>>()
  const settingsListeners = new Set<Listener<AppSettings>>()
  const presetListeners = new Set<Listener<QuickIdlePreset[]>>()
  const timelineListeners = new Set<() => void>()
  const updateListeners = new Set<Listener<UpdateCheckResult>>()
  const navListeners = new Set<Listener<MainTabId>>()

  let eyeCareRemainingSec = 14 * 60 + 25
  let continuousActiveSec = 34 * 60
  let pendingReturnPopup: LiveTrackingState['pendingReturnPopup'] = null
  let activeBreakOverlay: LiveTrackingState['activeBreakOverlay'] = null

  let pomodoro: LiveTrackingState['pomodoro'] = {
    running: false,
    phase: 'idle',
    preset: '25_5',
    focusMinutes: 25,
    breakMinutes: 5,
    remainingSec: 25 * 60,
    completedFocusCount: 3
  }

  function resolveBrowserTheme(): ResolvedTheme {
    if (settings.theme === 'dark') return 'dark'
    if (settings.theme === 'light') return 'light'
    return typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }

  function getCurrentOpenSession(): SessionRecord {
    return sessions[sessions.length - 1]
  }

  function computeState(): LiveTrackingState {
    const now = Date.now()
    const cur = getCurrentOpenSession()
    const activeTask = tasks.find((t) => t.endTime === null) ?? null

    let todayActiveSec = 0
    let todayIdleSec = 0
    for (const s of sessions) {
      const dur = s.endTime
        ? Math.round((s.endTime - s.startTime) / 1000)
        : Math.round((now - s.startTime) / 1000)
      if (s.type === 'active') todayActiveSec += Math.max(0, dur)
      else todayIdleSec += Math.max(0, dur)
    }

    const startRef = isPaused ? pausedAt : cur.startTime

    return {
      status: isPaused
        ? 'paused'
        : cur.type === 'manual_idle'
          ? 'manual_idle'
          : cur.type === 'auto_idle'
            ? 'auto_idle'
            : 'active',
      resolvedTheme: resolveBrowserTheme(),
      osIdleSec: cur.type === 'active' ? 0 : Math.round((now - cur.startTime) / 1000),
      currentSessionStart: startRef,
      currentSessionElapsedSec: Math.max(0, Math.round((now - startRef) / 1000)),
      currentManualTag: isPaused ? null : cur.tag,
      currentPresetLabel: isPaused ? null : currentPresetLabel,
      currentSmartException: 'none',
      activeTask: activeTask
        ? {
            ...activeTask,
            durationSec: Math.max(0, Math.round((now - activeTask.startTime) / 1000))
          }
        : null,
      todayActiveSec,
      todayIdleSec,
      pomodoro: { ...pomodoro },
      health: {
        eyeCareRemainingSec,
        eyeBreakCountdownSec:
          activeBreakOverlay?.kind === 'eye_20_20_20' ? activeBreakOverlay.countdownSec : null,
        continuousActiveSec,
        sittingAlertActive: activeBreakOverlay?.kind === 'long_sitting'
      },
      pendingReturnPopup,
      activeBreakOverlay
    }
  }

  function notifyState(): void {
    const st = computeState()
    stateListeners.forEach((cb) => cb(st))
  }

  function notifySettings(): void {
    settingsListeners.forEach((cb) => cb(settings))
  }

  function notifyPresets(): void {
    presetListeners.forEach((cb) => cb(sortPresets(presets)))
  }

  function notifyTimelineChanged(): void {
    timelineListeners.forEach((cb) => cb())
  }

  setInterval(() => {
    if (!isPaused) {
      const cur = getCurrentOpenSession()
      if (activeBreakOverlay) {
        if (activeBreakOverlay.countdownSec > 1) {
          activeBreakOverlay = {
            ...activeBreakOverlay,
            countdownSec: activeBreakOverlay.countdownSec - 1
          }
        } else {
          activeBreakOverlay = null
          eyeCareRemainingSec = settings.eyeCareIntervalMinutes * 60
        }
      } else if (cur.type === 'active') {
        continuousActiveSec += 1
        if (settings.eyeCareEnabled && eyeCareRemainingSec > 0) {
          eyeCareRemainingSec -= 1
          if (eyeCareRemainingSec === 0) {
            activeBreakOverlay = { kind: 'eye_20_20_20', countdownSec: 20 }
          }
        }
      }

      if (pomodoro.running && pomodoro.remainingSec > 0) {
        pomodoro = { ...pomodoro, remainingSec: pomodoro.remainingSec - 1 }
      }
    }
    notifyState()
  }, 1000)

  return {
    getInitialData: async () => ({
      state: computeState(),
      settings,
      tasksToday: [...tasks],
      quickIdlePresets: sortPresets(presets)
    }),
    onStateUpdate: (cb) => {
      stateListeners.add(cb)
      return () => stateListeners.delete(cb)
    },
    onSettingsUpdate: (cb) => {
      settingsListeners.add(cb)
      return () => settingsListeners.delete(cb)
    },
    onPresetsUpdate: (cb) => {
      presetListeners.add(cb)
      return () => presetListeners.delete(cb)
    },
    onTimelineChanged: (cb) => {
      timelineListeners.add(cb)
      return () => timelineListeners.delete(cb)
    },
    onUpdateStatus: (cb) => {
      updateListeners.add(cb)
      return () => updateListeners.delete(cb)
    },
    onNavigateTab: (cb) => {
      navListeners.add(cb)
      return () => navListeners.delete(cb)
    },

    updateSettings: async (partial) => {
      settings = {
        ...settings,
        ...partial,
        stickyWidget: {
          ...settings.stickyWidget,
          ...(partial.stickyWidget || {})
        },
        pomodoroWidget: {
          ...settings.pomodoroWidget,
          ...(partial.pomodoroWidget || {})
        }
      }
      notifySettings()
      notifyState()
      return settings
    },

    setLanguage: async (lang: LanguageCode) => {
      settings = { ...settings, language: lang }
      notifySettings()
      return settings
    },

    startManualIdle: async (tag: IdleTag, note = '') => {
      isPaused = false
      const now = Date.now()
      const cur = getCurrentOpenSession()
      cur.endTime = now
      cur.durationSec = Math.max(0, Math.round((now - cur.startTime) / 1000))
      if (cur.type !== 'active') cur.breakCategory = classifyBreakDuration(cur.durationSec)

      currentPresetLabel = note || null
      sessions.push({
        id: nextSessionId++,
        type: 'manual_idle',
        startTime: now,
        endTime: null,
        durationSec: 0,
        breakCategory: 'none',
        tag,
        note,
        smartException: 'none',
        isManual: true
      })
      notifyState()
      notifyTimelineChanged()
    },

    resumeFromIdle: async () => {
      const now = Date.now()
      isPaused = false
      currentPresetLabel = null
      const cur = getCurrentOpenSession()
      if (cur.type === 'active') {
        notifyState()
        return
      }
      cur.endTime = now
      cur.durationSec = Math.max(0, Math.round((now - cur.startTime) / 1000))
      cur.breakCategory = classifyBreakDuration(cur.durationSec)

      sessions.push({
        id: nextSessionId++,
        type: 'active',
        startTime: now,
        endTime: null,
        durationSec: 0,
        breakCategory: 'none',
        tag: null,
        note: '',
        smartException: 'none',
        isManual: false
      })
      notifyState()
      notifyTimelineChanged()
    },

    togglePauseTracking: async () => {
      isPaused = !isPaused
      pausedAt = Date.now()
      notifyState()
    },

    getQuickIdlePresets: async () => sortPresets(presets),

    createQuickIdlePreset: async (input) => {
      if (presets.length >= MAX_QUICK_IDLE_PRESETS) {
        throw new Error(`MAX_QUICK_IDLE_PRESETS_EXCEEDED (${MAX_QUICK_IDLE_PRESETS})`)
      }
      presets = [
        ...presets,
        {
          id: `preset-${Date.now()}`,
          label: input.label.trim(),
          icon: input.icon,
          tag: input.tag,
          usageCount: 0,
          lastUsedAt: 0,
          createdAt: Date.now()
        }
      ]
      notifyPresets()
      return sortPresets(presets)
    },

    updateQuickIdlePreset: async (id, updates) => {
      presets = presets.map((p) => (p.id === id ? { ...p, ...updates } : p))
      notifyPresets()
      return sortPresets(presets)
    },

    deleteQuickIdlePreset: async (id) => {
      presets = presets.filter((p) => p.id !== id)
      notifyPresets()
      return sortPresets(presets)
    },

    triggerQuickIdlePreset: async (id) => {
      const now = Date.now()
      presets = presets.map((p) =>
        p.id === id ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: now } : p
      )
      const target = presets.find((p) => p.id === id)
      if (target) {
        isPaused = false
        currentPresetLabel = target.label
        const cur = getCurrentOpenSession()
        cur.endTime = now
        cur.durationSec = Math.max(0, Math.round((now - cur.startTime) / 1000))
        sessions.push({
          id: nextSessionId++,
          type: 'manual_idle',
          startTime: now,
          endTime: null,
          durationSec: 0,
          breakCategory: 'none',
          tag: target.tag,
          note: target.label,
          smartException: 'none',
          isManual: true
        })
      }
      notifyPresets()
      notifyState()
      notifyTimelineChanged()
      return sortPresets(presets)
    },

    simulateReturnPopup: (minutesAway = 12) => {
      const now = Date.now()
      const durSec = minutesAway * 60
      const mockSess: SessionRecord = {
        id: nextSessionId++,
        type: 'auto_idle',
        startTime: now - durSec * 1000,
        endTime: now,
        durationSec: durSec,
        breakCategory: classifyBreakDuration(durSec),
        tag: null,
        note: '',
        smartException: 'none',
        isManual: false
      }
      sessions.splice(sessions.length - 1, 0, mockSess)
      pendingReturnPopup = {
        sessionId: mockSess.id,
        durationSec: durSec,
        startTime: mockSess.startTime,
        endTime: now
      }
      notifyState()
    },

    submitReturnTag: async (sessionId, tag, note = '') => {
      const cleanNote = note.trim()
      const effectiveTag = tag ?? (cleanNote ? 'other' : null)
      const found = sessions.find((s) => s.id === sessionId)
      if (found && (effectiveTag || cleanNote)) {
        found.tag = effectiveTag
        found.note = cleanNote
        const existingReport = savedReports.get(todayStr)
        if (existingReport) {
          const sMin = epochToDayMinutes(found.startTime, dayStart)
          const eMin = Math.max(sMin + 1, epochToDayMinutes(found.endTime ?? Date.now(), dayStart))
          const label = cleanNote || (effectiveTag ? translateMain(settings.language, `tags.${effectiveTag}`) : 'Other')
          existingReport.rows = sortReportRowsChronologically([
            ...existingReport.rows.filter((r) => r.id !== `idle-session-${found.id}`),
            {
              id: `idle-session-${found.id}`,
              startTime: minutesToReportTime(sMin),
              endTime: minutesToReportTime(eMin),
              content: label
            }
          ])
        }
      }
      pendingReturnPopup = null
      notifyState()
      notifyTimelineChanged()
    },

    dismissReturnPopup: async () => {
      pendingReturnPopup = null
      notifyState()
    },

    startTask: async (title, category = 'general') => {
      const now = Date.now()
      for (const t of tasks) {
        if (t.endTime === null) {
          t.endTime = now
          t.durationSec = Math.max(0, Math.round((now - t.startTime) / 1000))
        }
      }
      const created: TaskRecord = {
        id: nextTaskId++,
        title: title.trim(),
        startTime: now,
        endTime: null,
        durationSec: 0,
        category
      }
      tasks = [...tasks, created]
      notifyState()
      notifyTimelineChanged()
      return created
    },

    stopActiveTask: async () => {
      const now = Date.now()
      tasks = tasks.map((t) =>
        t.endTime === null
          ? {
              ...t,
              endTime: now,
              durationSec: Math.max(0, Math.round((now - t.startTime) / 1000))
            }
          : t
      )
      notifyState()
      notifyTimelineChanged()
    },

    getTasksByDate: async () => [...tasks],

    updateTask: async (id, updates) => {
      tasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
      notifyState()
      notifyTimelineChanged()
    },

    deleteTask: async (id) => {
      tasks = tasks.filter((t) => t.id !== id)
      notifyState()
      notifyTimelineChanged()
    },

    startPomodoro: async (preset?: PomodoroPreset, customFocus?: number, customBreak?: number) => {
      const nextPreset = preset ?? pomodoro.preset
      const focusMinutes =
        nextPreset === '25_5'
          ? 25
          : nextPreset === '50_10'
            ? 50
            : (customFocus ?? pomodoro.focusMinutes)
      const breakMinutes =
        nextPreset === '25_5'
          ? 5
          : nextPreset === '50_10'
            ? 10
            : (customBreak ?? pomodoro.breakMinutes)
      const resuming = !preset && pomodoro.phase !== 'idle' && !pomodoro.running
      pomodoro = {
        ...pomodoro,
        running: true,
        preset: nextPreset,
        focusMinutes,
        breakMinutes,
        phase: resuming ? pomodoro.phase : 'focus',
        remainingSec: resuming ? pomodoro.remainingSec : focusMinutes * 60
      }
      notifyState()
    },

    pausePomodoro: async () => {
      pomodoro = { ...pomodoro, running: false }
      notifyState()
    },

    resetPomodoro: async () => {
      pomodoro = {
        ...pomodoro,
        running: false,
        phase: 'idle',
        remainingSec: pomodoro.focusMinutes * 60
      }
      notifyState()
    },

    skipPomodoroPhase: async () => {
      if (pomodoro.phase === 'focus') {
        pomodoro = {
          ...pomodoro,
          phase: 'break',
          remainingSec: pomodoro.breakMinutes * 60,
          completedFocusCount: pomodoro.completedFocusCount + 1
        }
      } else {
        pomodoro = {
          ...pomodoro,
          phase: 'focus',
          remainingSec: pomodoro.focusMinutes * 60
        }
      }
      notifyState()
    },

    togglePomodoroWidget: async (visible?: boolean) => {
      const next = visible !== undefined ? visible : !settings.pomodoroWidget.visible
      settings = {
        ...settings,
        pomodoroWidget: { ...settings.pomodoroWidget, visible: next }
      }
      notifySettings()
      return settings
    },

    updatePomodoroWidgetPrefs: async (prefs: Partial<PomodoroWidgetPrefs>) => {
      settings = {
        ...settings,
        pomodoroWidget: { ...settings.pomodoroWidget, ...prefs }
      }
      notifySettings()
      return settings
    },

    triggerEyeBreakNow: async () => {
      activeBreakOverlay = { kind: 'eye_20_20_20', countdownSec: 20 }
      notifyState()
    },

    dismissBreakOverlay: async (snoozeMinutes?: number) => {
      activeBreakOverlay = null
      eyeCareRemainingSec = (snoozeMinutes ?? settings.eyeCareIntervalMinutes) * 60
      notifyState()
    },

    toggleStickyWidget: async (visible?: boolean) => {
      const next = visible !== undefined ? visible : !settings.stickyWidget.visible
      settings = {
        ...settings,
        stickyWidget: { ...settings.stickyWidget, visible: next }
      }
      notifySettings()
      return settings
    },

    updateStickyWidgetPrefs: async (prefs: Partial<StickyWidgetPrefs>) => {
      settings = {
        ...settings,
        stickyWidget: { ...settings.stickyWidget, ...prefs }
      }
      notifySettings()
      return settings
    },

    openMainWindow: async (tab?: MainTabId) => {
      if (tab) navListeners.forEach((cb) => cb(tab))
    },

    getAnalytics: async (range: AnalyticsRange): Promise<AnalyticsPayload> => {
      const st = computeState()
      const total = st.todayActiveSec + st.todayIdleSec
      const ratio = total > 0 ? Math.round((st.todayActiveSec / total) * 100) : 0

      const chartPoints =
        range === 'hour'
          ? Array.from({ length: 12 }, (_, idx) => {
              const hr = 8 + idx
              const activeMin =
                hr === 12
                  ? 0
                  : hr >= 8 && hr <= 16
                    ? ([54, 48, 52, 46, 0, 50, 38, 52, 44][hr - 8] ?? 20)
                    : 0
              const idleMin =
                hr === 12 ? 60 : hr === 14 ? 22 : hr >= 8 && hr <= 16 ? 60 - activeMin : 0
              return {
                label: `${String(hr).padStart(2, '0')}:00`,
                activeMin,
                idleMin,
                microMin: Math.min(idleMin, 4),
                shortMin: idleMin > 4 && idleMin <= 30 ? idleMin - 4 : 0,
                longMin: idleMin > 30 ? idleMin : 0
              }
            })
          : [
              {
                label: '11/25',
                activeMin: 398,
                idleMin: 91,
                microMin: 16,
                shortMin: 30,
                longMin: 45
              },
              {
                label: '11/26',
                activeMin: Math.round(st.todayActiveSec / 60),
                idleMin: Math.round(st.todayIdleSec / 60),
                microMin: 3,
                shortMin: 26,
                longMin: 60
              }
            ]

      const heatmap: HeatmapCell[] = []
      for (let dow = 0; dow < 7; dow++) {
        for (let hr = 0; hr < 24; hr++) {
          heatmap.push({
            dayOfWeek: dow,
            hour: hr,
            idleMinutes: dow >= 1 && dow <= 5 && hr === 12 ? 52 : hr === 14 ? 19 : 0
          })
        }
      }

      return {
        range,
        chartPoints,
        todayActiveSec: st.todayActiveSec,
        todayIdleSec: st.todayIdleSec,
        activeRatioPercent: ratio,
        breakBreakdown: { microSec: 180, shortSec: 26 * 60, longSec: 3600 },
        intradaySessions: [...sessions],
        heatmap,
        topIdleHours: [
          { hour: 12, label: '12:00–13:00', totalIdleMin: 540, avgIdleMin: 54, percentage: 100 },
          { hour: 14, label: '14:00–15:00', totalIdleMin: 215, avgIdleMin: 22, percentage: 40 }
        ]
      }
    },

    exportData: async (format, startDate, endDate) => {
      const data = JSON.stringify({ app: 'WorkPacer', startDate, endDate, sessions, tasks }, null, 2)
      return {
        success: true,
        filePath: `WorkPacer_${startDate}_to_${endDate}.${format}`,
        content: data,
        rowCount: sessions.length + tasks.length
      }
    },

    sendSummaryNotificationNow: async () => {},

    getDailyReport: async (dateStr, forceRegenerate) => {
      const existing = savedReports.get(dateStr)
      if (existing && !forceRegenerate) return existing

      const shiftStart = existing?.shiftStart ?? settings.shiftStart
      const shiftEnd = existing?.shiftEnd ?? settings.shiftEnd
      const rows = synthesizeDailyReportRows({
        dateStr,
        shiftStart,
        shiftEnd,
        lunchStart: settings.lunchStart,
        lunchEnd: settings.lunchEnd,
        hideLunch: settings.hideLunchInReport,
        mergeMicroBreaksMinutes: settings.mergeMicroBreaksMinutes,
        sessions,
        tasks,
        defaultWorkLabel: translateMain(settings.language, 'report.defaultWork'),
        meetingLabel: translateMain(settings.language, 'tags.meeting')
      })

      const doc: DailyReportDocument = {
        date: dateStr,
        shiftStart,
        shiftEnd,
        rows,
        updatedAt: Date.now()
      }
      savedReports.set(dateStr, doc)
      return doc
    },

    saveDailyReport: async (doc) => {
      const updated = { ...doc, updatedAt: Date.now() }
      savedReports.set(doc.date, updated)
      notifyTimelineChanged()
      return updated
    },

    getAppVersion: async () => '1.2.0',

    checkForUpdates: async () => {
      const res: UpdateCheckResult = {
        checkedAt: Date.now(),
        currentVersion: '1.2.0',
        latestVersion: 'v1.2.0',
        hasUpdate: false,
        releaseUrl: 'https://github.com/Notfound-102/WorkPacer/releases'
      }
      updateListeners.forEach((cb) => cb(res))
      return res
    },

    openExternalUrl: async (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
}
