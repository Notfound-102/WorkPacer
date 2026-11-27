import {
  AnalyticsPayload,
  AnalyticsRange,
  AppSettings,
  classifyBreakDuration,
  DailyReportDocument,
  DEFAULT_SETTINGS,
  HeatmapCell,
  IdlePulseAPI,
  IdleTag,
  LanguageCode,
  LiveTrackingState,
  MainTabId,
  PomodoroPreset,
  SessionRecord,
  StickyWidgetPrefs,
  TaskRecord
} from '@shared/types'
import { getDayStartMs, synthesizeDailyReportRows } from '@shared/reportFormatter'
import { translateMain } from '@shared/i18nResources'
import { getTodayDateString } from './formatters'

type Listener<T> = (payload: T) => void

export function createMockBridge(): IdlePulseAPI & {
  simulateReturnPopup: (minutesAway?: number) => void
} {
  let settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    stickyWidget: { ...DEFAULT_SETTINGS.stickyWidget, visible: true }
  }

  const todayStr = getTodayDateString()
  const dayStart = getDayStartMs(todayStr)
  const at = (h: number, m: number): number => dayStart + (h * 60 + m) * 60 * 1000

  let nextSessionId = 10
  let nextTaskId = 10

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
      endTime: at(10, 6),
      durationSec: 27 * 60,
      breakCategory: 'none',
      tag: null,
      note: '',
      smartException: 'none',
      isManual: false
    },
    {
      id: 4,
      type: 'auto_idle',
      startTime: at(10, 6),
      endTime: at(10, 14),
      durationSec: 480,
      breakCategory: 'short',
      tag: 'rest',
      note: 'Giải lao cà phê',
      smartException: 'none',
      isManual: false
    },
    {
      id: 5,
      type: 'active',
      startTime: at(10, 14),
      endTime: at(12, 0),
      durationSec: 106 * 60,
      breakCategory: 'none',
      tag: null,
      note: '',
      smartException: 'none',
      isManual: false
    },
    {
      id: 6,
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
      id: 7,
      type: 'active',
      startTime: at(13, 0),
      endTime: at(14, 20),
      durationSec: 80 * 60,
      breakCategory: 'none',
      tag: null,
      note: '',
      smartException: 'none',
      isManual: false
    },
    {
      id: 8,
      type: 'auto_idle',
      startTime: at(14, 20),
      endTime: at(14, 38),
      durationSec: 18 * 60,
      breakCategory: 'short',
      tag: 'rest',
      note: '',
      smartException: 'none',
      isManual: false
    },
    {
      id: 9,
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
      title: 'Thiết kế schema SQLite & Core Idle Tracking Engine',
      startTime: at(9, 39),
      endTime: at(12, 0),
      durationSec: 130 * 60,
      category: 'engineering'
    },
    {
      id: 3,
      title: 'Xây dựng Dashboard biểu đồ Recharts & Heatmap',
      startTime: at(13, 0),
      endTime: at(14, 20),
      durationSec: 80 * 60,
      category: 'frontend'
    },
    {
      id: 4,
      title: 'Hoàn thiện trang tạo Báo cáo cuối ngày (日報)',
      startTime: Date.now() - 34 * 60 * 1000,
      endTime: null,
      durationSec: 34 * 60,
      category: 'feature'
    }
  ]

  const savedReports = new Map<string, DailyReportDocument>()

  const stateListeners = new Set<Listener<LiveTrackingState>>()
  const settingsListeners = new Set<Listener<AppSettings>>()
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
      const dur = s.endTime ? Math.round((s.endTime - s.startTime) / 1000) : Math.round((now - s.startTime) / 1000)
      if (s.type === 'active') todayActiveSec += Math.max(0, dur)
      else todayIdleSec += Math.max(0, dur)
    }

    return {
      status:
        cur.type === 'manual_idle'
          ? 'manual_idle'
          : cur.type === 'auto_idle'
            ? 'auto_idle'
            : 'active',
      osIdleSec: cur.type === 'active' ? 0 : Math.round((now - cur.startTime) / 1000),
      currentSessionStart: cur.startTime,
      currentSessionElapsedSec: Math.max(0, Math.round((now - cur.startTime) / 1000)),
      currentManualTag: cur.tag,
      currentSmartException: 'none',
      activeTask: activeTask
        ? { ...activeTask, durationSec: Math.max(0, Math.round((now - activeTask.startTime) / 1000)) }
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

  setInterval(() => {
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
      if (pomodoro.remainingSec === 0) {
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
      }
    }
    notifyState()
  }, 1000)

  return {
    getInitialData: async () => ({
      state: computeState(),
      settings,
      tasksToday: [...tasks]
    }),
    onStateUpdate: (cb) => {
      stateListeners.add(cb)
      return () => stateListeners.delete(cb)
    },
    onSettingsUpdate: (cb) => {
      settingsListeners.add(cb)
      return () => settingsListeners.delete(cb)
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
        }
      }
      notifySettings()
      return settings
    },

    setLanguage: async (lang: LanguageCode) => {
      settings = { ...settings, language: lang }
      notifySettings()
      return settings
    },

    startManualIdle: async (tag: IdleTag, note = '') => {
      const now = Date.now()
      const cur = getCurrentOpenSession()
      cur.endTime = now
      cur.durationSec = Math.max(0, Math.round((now - cur.startTime) / 1000))
      if (cur.type !== 'active') cur.breakCategory = classifyBreakDuration(cur.durationSec)

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
    },

    resumeFromIdle: async () => {
      const now = Date.now()
      const cur = getCurrentOpenSession()
      if (cur.type === 'active') return
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
      const found = sessions.find((s) => s.id === sessionId)
      if (found && tag) {
        found.tag = tag
        found.note = note
      }
      pendingReturnPopup = null
      notifyState()
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
      return created
    },

    stopActiveTask: async () => {
      const now = Date.now()
      tasks = tasks.map((t) =>
        t.endTime === null
          ? { ...t, endTime: now, durationSec: Math.max(0, Math.round((now - t.startTime) / 1000)) }
          : t
      )
      notifyState()
    },

    getTasksByDate: async () => [...tasks],

    updateTask: async (id, updates) => {
      tasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
      notifyState()
    },

    deleteTask: async (id) => {
      tasks = tasks.filter((t) => t.id !== id)
      notifyState()
    },

    startPomodoro: async (preset?: PomodoroPreset, customFocus?: number, customBreak?: number) => {
      const nextPreset = preset ?? pomodoro.preset
      const focusMinutes =
        nextPreset === '25_5' ? 25 : nextPreset === '50_10' ? 50 : customFocus ?? pomodoro.focusMinutes
      const breakMinutes =
        nextPreset === '25_5' ? 5 : nextPreset === '50_10' ? 10 : customBreak ?? pomodoro.breakMinutes
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
                hr === 12 ? 0 : hr >= 8 && hr <= 16 ? [54, 48, 52, 46, 0, 50, 38, 52, 44][hr - 8] ?? 20 : 0
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
          : range === 'day'
            ? [
                { label: '11/20', activeMin: 385, idleMin: 82, microMin: 12, shortMin: 25, longMin: 45 },
                { label: '11/21', activeMin: 410, idleMin: 74, microMin: 14, shortMin: 20, longMin: 40 },
                { label: '11/22', activeMin: 140, idleMin: 45, microMin: 10, shortMin: 35, longMin: 0 },
                { label: '11/23', activeMin: 95, idleMin: 30, microMin: 10, shortMin: 20, longMin: 0 },
                { label: '11/24', activeMin: 425, idleMin: 78, microMin: 13, shortMin: 20, longMin: 45 },
                { label: '11/25', activeMin: 398, idleMin: 91, microMin: 16, shortMin: 30, longMin: 45 },
                {
                  label: '11/26',
                  activeMin: Math.round(st.todayActiveSec / 60),
                  idleMin: Math.round(st.todayIdleSec / 60),
                  microMin: 3,
                  shortMin: 26,
                  longMin: 60
                }
              ]
            : [
                { label: '10/19~', activeMin: 1980, idleMin: 420, microMin: 65, shortMin: 135, longMin: 220 },
                { label: '10/26~', activeMin: 2120, idleMin: 390, microMin: 60, shortMin: 120, longMin: 210 },
                { label: '11/02~', activeMin: 2050, idleMin: 445, microMin: 70, shortMin: 145, longMin: 230 },
                { label: '11/09~', activeMin: 2190, idleMin: 380, microMin: 55, shortMin: 115, longMin: 210 },
                { label: '11/16~', activeMin: 2085, idleMin: 410, microMin: 62, shortMin: 128, longMin: 220 },
                { label: '11/23~', activeMin: 1640, idleMin: 330, microMin: 48, shortMin: 102, longMin: 180 }
              ]

      const heatmap: HeatmapCell[] = []
      for (let dow = 0; dow < 7; dow++) {
        for (let hr = 0; hr < 24; hr++) {
          let mins = 0
          if (dow >= 1 && dow <= 5) {
            if (hr === 12) mins = 54
            else if (hr === 14) mins = 21
            else if (hr === 10 || hr === 16) mins = 11
            else if (hr >= 9 && hr <= 17) mins = 5
          } else if (hr >= 11 && hr <= 15) {
            mins = 14
          }
          heatmap.push({ dayOfWeek: dow, hour: hr, idleMinutes: mins })
        }
      }

      return {
        range,
        chartPoints,
        todayActiveSec: st.todayActiveSec,
        todayIdleSec: st.todayIdleSec,
        activeRatioPercent: ratio,
        breakBreakdown: {
          microSec: 180,
          shortSec: 26 * 60,
          longSec: 60 * 60
        },
        intradaySessions: [...sessions],
        heatmap,
        topIdleHours: [
          { hour: 12, label: '12:00–13:00', totalIdleMin: 540, avgIdleMin: 54, percentage: 100 },
          { hour: 14, label: '14:00–15:00', totalIdleMin: 215, avgIdleMin: 22, percentage: 40 },
          { hour: 16, label: '16:00–17:00', totalIdleMin: 132, avgIdleMin: 13, percentage: 24 },
          { hour: 10, label: '10:00–11:00', totalIdleMin: 110, avgIdleMin: 11, percentage: 20 }
        ]
      }
    },

    exportData: async (format, startDate, endDate) => {
      const data =
        format === 'json'
          ? JSON.stringify({ startDate, endDate, sessions, tasks }, null, 2)
          : '\uFEFFRecordType,ID,Type,Start,End,DurationSec,Note\n' +
            sessions
              .map(
                (s) =>
                  `session,${s.id},${s.type},${new Date(s.startTime).toISOString()},${s.endTime ? new Date(s.endTime).toISOString() : ''},${s.durationSec},"${s.note}"`
              )
              .join('\n')

      const blob = new Blob([data], {
        type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `IdlePulse_${startDate}_to_${endDate}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      return {
        success: true,
        filePath: `IdlePulse_${startDate}_to_${endDate}.${format}`,
        rowCount: sessions.length + tasks.length
      }
    },

    sendSummaryNotificationNow: async () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(translateMain(settings.language, 'notifications.dailySummaryTitle'), {
          body: 'Active: 5h 07m | Idle: 1h 29m (78%)'
        })
      }
    },

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
      return updated
    }
  }
}
