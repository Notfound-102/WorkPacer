import { writeFile } from 'fs/promises'
import { app, dialog, ipcMain, nativeTheme, Notification, powerMonitor } from 'electron'
import { formatLocalDate, IdlePulseDatabase } from './database'
import { migrateLegacyDatabaseIfNeeded } from './dataMigration'
import { detectSmartException } from './smartExceptions'
import { IdleTrackingEngine } from './idleTracker'
import { WindowManager } from './windowManager'
import { TrayManager } from './trayManager'
import { translateMain } from '../shared/i18nResources'
import { synthesizeDailyReportRows } from '../shared/reportFormatter'
import {
  AnalyticsRange,
  AppSettings,
  DailyReportDocument,
  IdleTag,
  LanguageCode,
  MainTabId,
  PomodoroPreset,
  QuickPresetIcon,
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
    meetingLabel: translateMain(settings.language, 'tags.meeting')
  })

  return db.saveDailyReport({
    date: dateStr,
    shiftStart,
    shiftEnd,
    rows,
    updatedAt: Date.now()
  })
}

function syncPresetsEverywhere(): void {
  if (!db || !windows || !tracker) return
  const presets = db.getQuickIdlePresets()
  windows.broadcast('presets:updated', presets)
  tray?.refresh(db.getSettings(), tracker.getLiveState(), presets, true)
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

  ipcMain.handle('settings:update', (_e, partial: Partial<AppSettings>) => {
    if (!db || !windows || !tracker) throw new Error('Engine not initialized')
    const updated = db.updateSettings(partial)
    windows.syncNativeTheme(updated.theme)
    windows.syncStickyWidgetWindow(updated.stickyWidget)
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
  })

  ipcMain.handle('tracking:resumeFromIdle', () => {
    tracker?.resumeFromIdle()
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
    return presets
  })

  // Return Popup
  ipcMain.handle(
    'tracking:submitReturnTag',
    (_e, sessionId: number, tag: IdleTag | null, note?: string) => {
      tracker?.submitReturnTag(sessionId, tag, note)
      windows?.closeReturnPopup()
    }
  )

  ipcMain.handle('tracking:dismissReturnPopup', () => {
    tracker?.dismissReturnPopup()
    windows?.closeReturnPopup()
  })

  // Tasks
  ipcMain.handle('tasks:start', (_e, title: string, category?: string) => {
    if (!tracker) throw new Error('Tracker not initialized')
    return tracker.startTask(title, category)
  })

  ipcMain.handle('tasks:stopActive', () => {
    tracker?.stopActiveTask()
  })

  ipcMain.handle('tasks:getByDate', (_e, dateStr: string) => {
    return db?.getTasksByDate(dateStr) ?? []
  })

  ipcMain.handle('tasks:update', (_e, id: number, updates: any) => {
    db?.updateTask(id, updates)
    tracker?.emitState()
  })

  ipcMain.handle('tasks:delete', (_e, id: number) => {
    db?.deleteTask(id)
    tracker?.emitState()
  })

  // Pomodoro
  ipcMain.handle(
    'pomodoro:start',
    (_e, preset?: PomodoroPreset, customFocus?: number, customBreak?: number) => {
      tracker?.startPomodoro(preset, customFocus, customBreak)
    }
  )

  ipcMain.handle('pomodoro:pause', () => tracker?.pausePomodoro())
  ipcMain.handle('pomodoro:reset', () => tracker?.resetPomodoro())
  ipcMain.handle('pomodoro:skip', () => tracker?.skipPomodoroPhase())

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

  // Daily Report (日報)
  ipcMain.handle('report:get', (_e, dateStr: string, forceRegenerate?: boolean) => {
    return buildDailyReport(dateStr, Boolean(forceRegenerate))
  })

  ipcMain.handle('report:save', (_e, doc: DailyReportDocument) => {
    if (!db) throw new Error('Database not initialized')
    return db.saveDailyReport(doc)
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
      onTriggerPreset: (presetId) => {
        tracker?.triggerQuickIdlePreset(presetId)
        syncPresetsEverywhere()
      },
      onTogglePause: () => tracker?.togglePauseTracking(),
      onResumeWork: () => tracker?.resumeFromIdle(),
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

    tracker.start()

    if (process.env.WORKPACER_SMOKE_TEST === '1' || process.env.IDLEPULSE_SMOKE_TEST === '1') {
      setTimeout(() => {
        console.log('WORKPACER_SMOKE_READY')
        windows?.setQuitting(true)
        app.quit()
      }, 2200)
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
