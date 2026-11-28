import { writeFile } from 'fs/promises'
import { app, dialog, ipcMain, nativeTheme, Notification, powerMonitor, shell } from 'electron'
import { formatLocalDate, IdlePulseDatabase } from './database'
import { migrateLegacyDatabaseIfNeeded } from './dataMigration'
import { detectSmartException } from './smartExceptions'
import { IdleTrackingEngine } from './idleTracker'
import { WindowManager } from './windowManager'
import { TrayManager } from './trayManager'
import { checkForGitHubUpdates } from './updateChecker'
import { translateMain } from '../shared/i18nResources'
import {
  epochToDayMinutes,
  getDayStartMs,
  minutesToReportTime,
  parseTimeToMinutes,
  sortReportRowsChronologically,
  synthesizeDailyReportRows
} from '../shared/reportFormatter'
import {
  AnalyticsRange,
  AppSettings,
  DailyReportDocument,
  DailyReportRow,
  IdleTag,
  LanguageCode,
  MainTabId,
  PomodoroPreset,
  PomodoroWidgetPrefs,
  QuickPresetIcon,
  SessionRecord,
  StickyWidgetPrefs
} from '../shared/types'

let db: IdlePulseDatabase | null = null
let tracker: IdleTrackingEngine | null = null
let windows: WindowManager | null = null
let tray: TrayManager | null = null

function formatSecShort(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function showLocalizedNotification(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return
  const notif = new Notification({ title, body })
  if (onClick) {
    notif.on('click', onClick)
  }
  notif.show()
}

function openSafeExternalUrl(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      void shell.openExternal(parsed.toString())
    }
  } catch {
    // Ignore malformed URL
  }
}

function buildTagLabelsMap(lang: LanguageCode): Record<IdleTag, string> {
  return {
    eating: translateMain(lang, 'tags.eating'),
    rest: translateMain(lang, 'tags.rest'),
    meeting: translateMain(lang, 'tags.meeting'),
    out: translateMain(lang, 'tags.out'),
    sleep: translateMain(lang, 'tags.sleep'),
    other: translateMain(lang, 'tags.other')
  }
}

function dispatchTrackerNotification(event: any): void {
  if (!db || !windows) return
  const settings = db.getSettings()
  const lang = settings.language

  if (event.type === 'end_of_shift') {
    showLocalizedNotification(
      translateMain(lang, 'notifications.endOfShiftTitle', { time: event.time }),
      translateMain(lang, 'notifications.endOfShiftBody'),
      () => windows?.createOrShowMainWindow('report')
    )
  } else if (event.type === 'return_to_work') {
    showLocalizedNotification(
      translateMain(lang, 'notifications.returnWorkTitle'),
      translateMain(lang, 'notifications.returnWorkBody', { min: event.minutes }),
      () => windows?.createOrShowMainWindow('dashboard')
    )
  } else if (event.type === 'long_sitting') {
    showLocalizedNotification(
      translateMain(lang, 'notifications.sittingTitle', { min: event.minutes }),
      translateMain(lang, 'notifications.sittingBody')
    )
  } else if (event.type === 'daily_summary') {
    sendSummaryNotification('daily')
  } else if (event.type === 'weekly_summary') {
    sendSummaryNotification('weekly')
  } else if (event.type === 'pomodoro_break') {
    showLocalizedNotification(
      `WorkPacer • ${translateMain(lang, 'status.pomodoro_break')}`,
      translateMain(lang, 'tasks.completedCycles', { count: event.count })
    )
  } else if (event.type === 'pomodoro_focus') {
    showLocalizedNotification(
      `WorkPacer • ${translateMain(lang, 'status.pomodoro_focus')}`,
      translateMain(lang, 'status.active')
    )
  }
}

function sendSummaryNotification(period: 'daily' | 'weekly'): void {
  if (!db || !windows) return
  const settings = db.getSettings()
  const lang = settings.language

  if (period === 'daily') {
    const totals = db.getDayTotals(formatLocalDate(Date.now()))
    const sum = totals.activeSec + totals.idleSec
    const ratio = sum > 0 ? Math.round((totals.activeSec / sum) * 100) : 0
    showLocalizedNotification(
      translateMain(lang, 'notifications.dailySummaryTitle'),
      translateMain(lang, 'notifications.dailySummaryBody', {
        active: formatSecShort(totals.activeSec),
        idle: formatSecShort(totals.idleSec),
        ratio
      }),
      () => windows?.createOrShowMainWindow('dashboard')
    )
  } else {
    const analytics = db.getAnalytics('day')
    const activeMin = analytics.chartPoints.reduce((acc, p) => acc + p.activeMin, 0)
    const idleMin = analytics.chartPoints.reduce((acc, p) => acc + p.idleMin, 0)
    const ratio =
      activeMin + idleMin > 0 ? Math.round((activeMin / (activeMin + idleMin)) * 100) : 0
    showLocalizedNotification(
      translateMain(lang, 'notifications.weeklySummaryTitle'),
      translateMain(lang, 'notifications.weeklySummaryBody', {
        active: formatSecShort(activeMin * 60),
        ratio
      }),
      () => windows?.createOrShowMainWindow('dashboard')
    )
  }
}

function buildDailyReport(dateStr: string, forceRegenerate = false): DailyReportDocument {
  if (!db) throw new Error('Database not ready')
  const settings = db.getSettings()
  const existing = db.getSavedDailyReport(dateStr)

  if (existing && !forceRegenerate) {
    return existing
  }

  const shiftStart = existing?.shiftStart ?? settings.shiftStart
  const shiftEnd = existing?.shiftEnd ?? settings.shiftEnd
  const dayTotals = db.getDayTotals(dateStr)
  const tasks = db.getTasksByDate(dateStr)

  const rows = synthesizeDailyReportRows({
    dateStr,
    shiftStart,
    shiftEnd,
    lunchStart: settings.lunchStart,
    lunchEnd: settings.lunchEnd,
    hideLunch: settings.hideLunchInReport,
    mergeMicroBreaksMinutes: settings.mergeMicroBreaksMinutes,
    sessions: dayTotals.sessions,
    tasks,
    defaultWorkLabel: translateMain(settings.language, 'report.defaultWork'),
    meetingLabel: translateMain(settings.language, 'tags.meeting'),
    tagLabels: buildTagLabelsMap(settings.language)
  })

  return db.saveDailyReport({
    date: dateStr,
    shiftStart,
    shiftEnd,
    rows,
    updatedAt: Date.now()
  })
}

/**
 * Ensures that submitting a reason in the Return Idle Modal writes directly into
 * the `daily_reports` Timeline table in SQLite (merging/splitting cleanly if a
 * report document already exists for that day) and sorts chronologically.
 */
function syncSubmittedIdleSessionToTimeline(session: SessionRecord): string {
  if (!db) return formatLocalDate(session.startTime)
  const settings = db.getSettings()
  const lang = settings.language
  const tagLabels = buildTagLabelsMap(lang)
  const dateStr = formatLocalDate(session.startTime)

  const note = session.note?.trim() || ''
  const tagName = session.tag ? tagLabels[session.tag] : ''
  const content =
    note && tagName && session.tag !== 'other' && note !== tagName
      ? `${tagName}: ${note}`
      : note || tagName || translateMain(lang, 'tags.other')

  const existingDoc = db.getSavedDailyReport(dateStr)
  if (!existingDoc) {
    // Synthesizes & persists full timeline including the newly tagged session
    buildDailyReport(dateStr, true)
    return dateStr
  }

  const dayStartMs = getDayStartMs(dateStr)
  const sMin = Math.max(0, epochToDayMinutes(session.startTime, dayStartMs))
  const eMin = Math.max(
    sMin + 1,
    epochToDayMinutes(session.endTime ?? Date.now(), dayStartMs)
  )

  const rowId = `idle-session-${session.id}`
  const adjustedRows: DailyReportRow[] = []

  for (const r of existingDoc.rows) {
    if (r.id === rowId) continue
    const rStart = parseTimeToMinutes(r.startTime)
    const rEnd = parseTimeToMinutes(r.endTime)
    if (rEnd <= sMin || rStart >= eMin) {
      adjustedRows.push(r)
    } else {
      if (rStart < sMin) {
        adjustedRows.push({
          ...r,
          id: `${r.id}-pre`,
          endTime: minutesToReportTime(sMin)
        })
      }
      if (rEnd > eMin) {
        adjustedRows.push({
          ...r,
          id: `${r.id}-post`,
          startTime: minutesToReportTime(eMin)
        })
      }
    }
  }

  adjustedRows.push({
    id: rowId,
    startTime: minutesToReportTime(sMin),
    endTime: minutesToReportTime(eMin),
    content
  })

  db.saveDailyReport({
    ...existingDoc,
    rows: sortReportRowsChronologically(adjustedRows),
    updatedAt: Date.now()
  })

  return dateStr
}

function broadcastTimelineChanged(dateStr?: string): void {
  windows?.broadcast('timeline:changed', { date: dateStr ?? formatLocalDate(Date.now()) })
}

function syncPresetsEverywhere(): void {
  if (!db || !windows || !tracker) return
  const presets = db.getQuickIdlePresets()
  windows.broadcast('presets:updated', presets)
  tray?.refresh(db.getSettings(), tracker.getLiveState(), presets, true)
}

async function performUpdateCheck(notifyIfAvailable: boolean) {
  const result = await checkForGitHubUpdates(app.getVersion())
  windows?.broadcast('update:status', result)

  if (notifyIfAvailable && result.hasUpdate && result.latestVersion && db) {
    const lang = db.getSettings().language
    showLocalizedNotification(
      translateMain(lang, 'notifications.updateAvailableTitle', {
        version: result.latestVersion
      }),
      translateMain(lang, 'notifications.updateAvailableBody'),
      () => openSafeExternalUrl(result.releaseUrl)
    )
  }
  return result
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:getInitialData', () => {
    if (!db || !tracker) throw new Error('Engine not initialized')
    const todayStr = formatLocalDate(Date.now())
    return {
      state: tracker.getLiveState(),
      settings: db.getSettings(),
      tasksToday: db.getTasksByDate(todayStr),
      quickIdlePresets: db.getQuickIdlePresets()
    }
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('app:checkForUpdates', () => performUpdateCheck(false))

  ipcMain.handle('app:openExternalUrl', (_e, url: string) => {
    openSafeExternalUrl(url)
  })

  ipcMain.handle('settings:update', (_e, partial: Partial<AppSettings>) => {
    if (!db || !windows || !tracker) throw new Error('Engine not initialized')
    const updated = db.updateSettings(partial)
    windows.syncNativeTheme(updated.theme)
    windows.syncStickyWidgetWindow(updated.stickyWidget)
    windows.syncPomodoroWidgetWindow(updated.pomodoroWidget)
    windows.broadcast('settings:updated', updated)
    tracker.emitState()
    tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
    return updated
  })

  ipcMain.handle('settings:setLanguage', (_e, lang: LanguageCode) => {
    if (!db || !windows || !tracker) throw new Error('Engine not initialized')
    const updated = db.updateSettings({ language: lang })
    windows.broadcast('settings:updated', updated)
    tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
    return updated
  })

  // Manual Idle, Pause & Quick Idle Presets
  ipcMain.handle('tracking:startManualIdle', (_e, tag: IdleTag, note?: string) => {
    tracker?.startManualIdle(tag, note)
    broadcastTimelineChanged()
  })

  ipcMain.handle('tracking:resumeFromIdle', () => {
    tracker?.resumeFromIdle()
    broadcastTimelineChanged()
  })

  ipcMain.handle('tracking:togglePause', () => {
    tracker?.togglePauseTracking()
  })

  ipcMain.handle('presets:get', () => {
    return db?.getQuickIdlePresets() ?? []
  })

  ipcMain.handle(
    'presets:create',
    (_e, input: { label: string; icon: QuickPresetIcon; tag: IdleTag }) => {
      if (!db) throw new Error('Database not initialized')
      const presets = db.createQuickIdlePreset(input)
      syncPresetsEverywhere()
      return presets
    }
  )

  ipcMain.handle(
    'presets:update',
    (_e, id: string, updates: Partial<{ label: string; icon: QuickPresetIcon; tag: IdleTag }>) => {
      if (!db) throw new Error('Database not initialized')
      const presets = db.updateQuickIdlePreset(id, updates)
      syncPresetsEverywhere()
      return presets
    }
  )

  ipcMain.handle('presets:delete', (_e, id: string) => {
    if (!db) throw new Error('Database not initialized')
    const presets = db.deleteQuickIdlePreset(id)
    syncPresetsEverywhere()
    return presets
  })

  ipcMain.handle('presets:trigger', (_e, id: string) => {
    if (!tracker) throw new Error('Tracker not initialized')
    const presets = tracker.triggerQuickIdlePreset(id)
    syncPresetsEverywhere()
    broadcastTimelineChanged()
    return presets
  })

  // Return Idle Modal Submit -> Persist into SQLite Timeline + Broadcast timeline:changed
  ipcMain.handle(
    'tracking:submitReturnTag',
    (_e, sessionId: number, tag: IdleTag | null, note?: string) => {
      const updatedSession = tracker?.submitReturnTag(sessionId, tag, note) ?? null
      if (updatedSession) {
        const dateStr = syncSubmittedIdleSessionToTimeline(updatedSession)
        broadcastTimelineChanged(dateStr)
      } else {
        broadcastTimelineChanged()
      }
      windows?.closeReturnPopup()
    }
  )

  ipcMain.handle('tracking:dismissReturnPopup', () => {
    tracker?.dismissReturnPopup()
    windows?.closeReturnPopup()
  })

  // Tasks -> Also broadcast timeline:changed so Report & Dashboard timelines stay fresh
  ipcMain.handle('tasks:start', (_e, title: string, category?: string) => {
    if (!tracker) throw new Error('Tracker not initialized')
    const task = tracker.startTask(title, category)
    broadcastTimelineChanged()
    return task
  })

  ipcMain.handle('tasks:stopActive', () => {
    tracker?.stopActiveTask()
    broadcastTimelineChanged()
  })

  ipcMain.handle('tasks:getByDate', (_e, dateStr: string) => {
    return db?.getTasksByDate(dateStr) ?? []
  })

  ipcMain.handle('tasks:update', (_e, id: number, updates: any) => {
    db?.updateTask(id, updates)
    tracker?.emitState()
    broadcastTimelineChanged()
  })

  ipcMain.handle('tasks:delete', (_e, id: number) => {
    db?.deleteTask(id)
    tracker?.emitState()
    broadcastTimelineChanged()
  })

  // Pomodoro & Floating Pomodoro Widget
  ipcMain.handle(
    'pomodoro:start',
    (_e, preset?: PomodoroPreset, customFocus?: number, customBreak?: number) => {
      tracker?.startPomodoro(preset, customFocus, customBreak)
    }
  )

  ipcMain.handle('pomodoro:pause', () => tracker?.pausePomodoro())
  ipcMain.handle('pomodoro:reset', () => tracker?.resetPomodoro())
  ipcMain.handle('pomodoro:skip', () => tracker?.skipPomodoroPhase())

  ipcMain.handle('pomodoro:toggleWidget', (_e, visible?: boolean) => {
    if (!db || !windows || !tracker) throw new Error('Engine not initialized')
    const cur = db.getSettings()
    const nextVisible = visible !== undefined ? visible : !cur.pomodoroWidget.visible
    const updated = db.updateSettings({
      pomodoroWidget: { ...cur.pomodoroWidget, visible: nextVisible }
    })
    windows.syncPomodoroWidgetWindow(updated.pomodoroWidget)
    windows.broadcast('settings:updated', updated)
    tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
    return updated
  })

  ipcMain.handle('pomodoro:updateWidgetPrefs', (_e, prefs: Partial<PomodoroWidgetPrefs>) => {
    if (!db || !windows || !tracker) throw new Error('Engine not initialized')
    const cur = db.getSettings()
    const updated = db.updateSettings({
      pomodoroWidget: { ...cur.pomodoroWidget, ...prefs }
    })
    windows.syncPomodoroWidgetWindow(updated.pomodoroWidget)
    windows.broadcast('settings:updated', updated)
    tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
    return updated
  })

  // Health & Break Overlay
  ipcMain.handle('health:triggerEyeBreakNow', () => {
    tracker?.triggerEyeBreak()
  })

  ipcMain.handle('health:dismissBreakOverlay', (_e, snoozeMinutes?: number) => {
    tracker?.dismissBreakOverlay(snoozeMinutes)
    windows?.closeBreakOverlay()
  })

  // Sticky Widget & Navigation
  ipcMain.handle('widget:toggle', (_e, visible?: boolean) => {
    if (!db || !windows || !tracker) throw new Error('Engine not initialized')
    const cur = db.getSettings()
    const nextVisible = visible !== undefined ? visible : !cur.stickyWidget.visible
    const updated = db.updateSettings({
      stickyWidget: { ...cur.stickyWidget, visible: nextVisible }
    })
    windows.syncStickyWidgetWindow(updated.stickyWidget)
    windows.broadcast('settings:updated', updated)
    tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
    return updated
  })

  ipcMain.handle('widget:updatePrefs', (_e, prefs: Partial<StickyWidgetPrefs>) => {
    if (!db || !windows || !tracker) throw new Error('Engine not initialized')
    const cur = db.getSettings()
    const updated = db.updateSettings({
      stickyWidget: { ...cur.stickyWidget, ...prefs }
    })
    windows.syncStickyWidgetWindow(updated.stickyWidget)
    windows.broadcast('settings:updated', updated)
    tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
    return updated
  })

  ipcMain.handle('window:openMain', (_e, tab?: MainTabId) => {
    windows?.createOrShowMainWindow(tab)
  })

  // Analytics & Export
  ipcMain.handle('analytics:get', (_e, range: AnalyticsRange, anchorDate?: string) => {
    if (!db) throw new Error('Database not initialized')
    return db.getAnalytics(range, anchorDate)
  })

  ipcMain.handle(
    'analytics:export',
    async (_e, format: 'csv' | 'json', startDate: string, endDate: string) => {
      if (!db) throw new Error('Database not initialized')
      const { content, rowCount } = db.exportHistory(format, startDate, endDate)
      const defaultFile = `WorkPacer_${startDate}_to_${endDate}.${format}`
      const result = await dialog.showSaveDialog({
        title: 'Export WorkPacer History',
        defaultPath: defaultFile,
        filters: [
          format === 'csv'
            ? { name: 'CSV Spreadsheet', extensions: ['csv'] }
            : { name: 'JSON Data', extensions: ['json'] }
        ]
      })
      if (result.canceled || !result.filePath) {
        return { success: false, rowCount: 0 }
      }
      await writeFile(result.filePath, content, 'utf-8')
      return { success: true, filePath: result.filePath, rowCount }
    }
  )

  ipcMain.handle('analytics:sendSummaryNow', (_e, period: 'daily' | 'weekly') => {
    sendSummaryNotification(period)
  })

  // Daily Report
  ipcMain.handle('report:get', (_e, dateStr: string, forceRegenerate?: boolean) => {
    return buildDailyReport(dateStr, Boolean(forceRegenerate))
  })

  ipcMain.handle('report:save', (_e, doc: DailyReportDocument) => {
    if (!db) throw new Error('Database not initialized')
    const saved = db.saveDailyReport(doc)
    broadcastTimelineChanged(doc.date)
    return saved
  })
}

app.setName('WorkPacer')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.workpacer.app')
}

const gotSingleLock = app.requestSingleInstanceLock()
if (!gotSingleLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    windows?.createOrShowMainWindow()
  })

  app.whenReady().then(() => {
    const { dbPath } = migrateLegacyDatabaseIfNeeded({
      appDataDir: app.getPath('appData'),
      newUserDataDir: app.getPath('userData')
    })

    db = new IdlePulseDatabase(dbPath)
    windows = new WindowManager(db)

    const initialSettings = db.getSettings()
    windows.syncNativeTheme(initialSettings.theme)

    tracker = new IdleTrackingEngine({
      db,
      getSystemIdleTime: () => powerMonitor.getSystemIdleTime(),
      detectSmartException,
      getResolvedTheme: () => windows?.resolveTheme() ?? 'light'
    })

    nativeTheme.on('updated', () => {
      if (!db || !windows || !tracker) return
      const s = db.getSettings()
      const resolved = windows.resolveTheme(s.theme)
      windows.applyThemeToOpenWindows(resolved)
      tracker.emitState()
    })

    tray = new TrayManager({
      onOpenMain: () => windows?.createOrShowMainWindow(),
      onOpenDailyReport: () => windows?.createOrShowMainWindow('report'),
      onToggleWidget: () => {
        if (!db || !windows || !tracker) return
        const cur = db.getSettings()
        const updated = db.updateSettings({
          stickyWidget: { ...cur.stickyWidget, visible: !cur.stickyWidget.visible }
        })
        windows.syncStickyWidgetWindow(updated.stickyWidget)
        windows.broadcast('settings:updated', updated)
        tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
      },
      onTogglePomodoroWidget: () => {
        if (!db || !windows || !tracker) return
        const cur = db.getSettings()
        const updated = db.updateSettings({
          pomodoroWidget: { ...cur.pomodoroWidget, visible: !cur.pomodoroWidget.visible }
        })
        windows.syncPomodoroWidgetWindow(updated.pomodoroWidget)
        windows.broadcast('settings:updated', updated)
        tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
      },
      onTriggerPreset: (presetId) => {
        tracker?.triggerQuickIdlePreset(presetId)
        syncPresetsEverywhere()
        broadcastTimelineChanged()
      },
      onTogglePause: () => tracker?.togglePauseTracking(),
      onResumeWork: () => {
        tracker?.resumeFromIdle()
        broadcastTimelineChanged()
      },
      onChangeLanguage: (lang) => {
        if (!db || !windows || !tracker) return
        const updated = db.updateSettings({ language: lang })
        windows.broadcast('settings:updated', updated)
        tray?.refresh(updated, tracker.getLiveState(), db.getQuickIdlePresets(), true)
      },
      onQuit: () => {
        windows?.setQuitting(true)
      }
    })

    tracker.on('state', (state) => {
      windows?.broadcast('tracking:state', state)
      if (db) {
        tray?.refresh(db.getSettings(), state, db.getQuickIdlePresets())
      }
    })

    tracker.on('return-popup', () => {
      windows?.showReturnPopup()
    })

    tracker.on('return-popup-closed', () => {
      windows?.closeReturnPopup()
    })

    tracker.on('break-overlay', () => {
      windows?.showBreakOverlay()
    })

    tracker.on('break-overlay-closed', () => {
      windows?.closeBreakOverlay()
    })

    tracker.on('notification', (evt) => {
      dispatchTrackerNotification(evt)
    })

    powerMonitor.on('suspend', () => tracker?.handleSystemSuspendOrLock('suspend'))
    powerMonitor.on('lock-screen', () => tracker?.handleSystemSuspendOrLock('lock-screen'))
    powerMonitor.on('resume', () => tracker?.handleSystemResumeOrUnlock())
    powerMonitor.on('unlock-screen', () => tracker?.handleSystemResumeOrUnlock())
    powerMonitor.on('shutdown', () => {
      windows?.setQuitting(true)
      tracker?.stop()
    })

    registerIpcHandlers()

    tray.init(initialSettings, tracker.getLiveState(), db.getQuickIdlePresets())
    windows.createOrShowMainWindow()
    if (initialSettings.stickyWidget.visible) {
      windows.syncStickyWidgetWindow(initialSettings.stickyWidget)
    }
    if (initialSettings.pomodoroWidget.visible) {
      windows.syncPomodoroWidgetWindow(initialSettings.pomodoroWidget)
    }

    tracker.start()

    const isSmokeTest =
      process.env.WORKPACER_SMOKE_TEST === '1' || process.env.IDLEPULSE_SMOKE_TEST === '1'

    if (isSmokeTest) {
      setTimeout(() => {
        console.log('WORKPACER_SMOKE_READY')
        windows?.setQuitting(true)
        app.quit()
      }, 2200)
    } else if (initialSettings.autoCheckUpdates) {
      setTimeout(() => {
        void performUpdateCheck(true)
      }, 3500)
    }

    app.on('activate', () => {
      windows?.createOrShowMainWindow()
    })
  })

  app.on('before-quit', () => {
    windows?.setQuitting(true)
    tracker?.stop()
    tray?.destroy()
    db?.close()
  })

  app.on('window-all-closed', () => {
    // Keep alive in System Tray on both Windows & macOS unless explicitly quitting
  })
}
