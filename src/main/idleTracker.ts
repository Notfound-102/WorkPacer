import { EventEmitter } from 'events'
import {
  ActiveBreakOverlay,
  AppSettings,
  IdleTag,
  LiveTrackingState,
  PendingReturnPopup,
  PomodoroPreset,
  PomodoroState,
  SessionRecord,
  SmartExceptionReason,
  TaskRecord
} from '../shared/types'
import { parseTimeToMinutes } from '../shared/reportFormatter'
import { formatLocalDate, IdlePulseDatabase } from './database'

export interface TrackerDependencies {
  db: IdlePulseDatabase
  getSystemIdleTime: () => number
  detectSmartException: () => Promise<SmartExceptionReason>
  now?: () => number
}

export class IdleTrackingEngine extends EventEmitter {
  private db: IdlePulseDatabase
  private getSystemIdleTime: () => number
  private detectSmartException: () => Promise<SmartExceptionReason>
  private now: () => number

  private tickTimer: NodeJS.Timeout | null = null
  private currentSession: SessionRecord
  private systemLockedOrSuspended = false
  private manualIdleStartedAt = 0
  private returnReminderFiredForSessionId: number | null = null

  private currentSmartException: SmartExceptionReason = 'none'
  private lastSmartCheckMs = 0

  private pendingReturnPopup: PendingReturnPopup | null = null
  private activeBreakOverlay: ActiveBreakOverlay | null = null

  private eyeCareRemainingSec: number
  private continuousActiveSec = 0
  private sittingAlertFired = false

  private pomodoro: PomodoroState = {
    running: false,
    phase: 'idle',
    preset: '25_5',
    focusMinutes: 25,
    breakMinutes: 5,
    remainingSec: 25 * 60,
    completedFocusCount: 0
  }

  private lastHeartbeatMs = 0
  private lastScheduledCheckMs = 0

  constructor(deps: TrackerDependencies) {
    super()
    this.db = deps.db
    this.getSystemIdleTime = deps.getSystemIdleTime
    this.detectSmartException = deps.detectSmartException
    this.now = deps.now ?? (() => Date.now())

    const settings = this.db.getSettings()
    this.eyeCareRemainingSec = settings.eyeCareIntervalMinutes * 60

    const initNow = this.now()
    // Recover any crash / shutdown / overnight gap before starting new active session
    this.db.recoverFromShutdownOrSleep(initNow, settings.idleThresholdMinutes * 60)

    this.currentSession = this.db.startSession({
      type: 'active',
      startTime: initNow
    })
    this.db.recordHeartbeat(initNow, 'active', this.currentSession.id)
    this.lastHeartbeatMs = initNow
  }

  public start(): void {
    if (this.tickTimer) return
    this.tickTimer = setInterval(() => {
      void this.tick()
    }, 1000)
  }

  public stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    const nowMs = this.now()
    this.db.closeSession(this.currentSession.id, nowMs)
    this.db.recordHeartbeat(nowMs, 'stopped', null)
  }

  public async tick(): Promise<void> {
    const nowMs = this.now()
    const settings = this.db.getSettings()
    const osIdleSec = this.systemLockedOrSuspended
      ? Math.max(settings.idleThresholdMinutes * 60, Math.round((nowMs - this.currentSession.startTime) / 1000))
      : this.getSystemIdleTime()

    const thresholdSec = Math.max(60, settings.idleThresholdMinutes * 60)

    // Refresh Smart Exception status near or above threshold
    if (
      settings.smartExceptionMode !== 'off' &&
      osIdleSec >= Math.max(15, thresholdSec - 10) &&
      nowMs - this.lastSmartCheckMs >= 5000
    ) {
      this.lastSmartCheckMs = nowMs
      this.currentSmartException = await this.detectSmartException()
    } else if (osIdleSec < 10) {
      this.currentSmartException = 'none'
    }

    // --- Core State Machine ---
    if (this.currentSession.type === 'active') {
      if (osIdleSec >= thresholdSec || this.systemLockedOrSuspended) {
        if (
          !this.systemLockedOrSuspended &&
          settings.smartExceptionMode === 'ignore' &&
          this.currentSmartException !== 'none'
        ) {
          // Smart Exception: Ignore idle & keep Active while watching fullscreen video or in call
        } else {
          // Transition Active -> Auto Idle (backdate start to when user stopped input)
          const backdatedStart = this.systemLockedOrSuspended
            ? nowMs
            : Math.max(this.currentSession.startTime, nowMs - osIdleSec * 1000)

          this.db.closeSession(this.currentSession.id, backdatedStart)
          const flagReason =
            settings.smartExceptionMode === 'flag' ? this.currentSmartException : 'none'

          this.currentSession = this.db.startSession({
            type: 'auto_idle',
            startTime: backdatedStart,
            smartException: flagReason,
            isManual: false
          })
          this.returnReminderFiredForSessionId = null
        }
      }
    } else if (this.currentSession.type === 'auto_idle') {
      if (!this.systemLockedOrSuspended && osIdleSec < 3) {
        this.transitionIdleToActive(nowMs, settings)
      }
    } else if (this.currentSession.type === 'manual_idle') {
      const graceElapsed = nowMs - this.manualIdleStartedAt > 20_000
      if (settings.autoResumeManualIdle && !this.systemLockedOrSuspended && graceElapsed && osIdleSec < 2) {
        this.transitionIdleToActive(nowMs, settings)
      }
    }

    // --- Health & Wellness Timers ---
    this.updateHealthTimers(nowMs, settings)

    // --- Pomodoro Timer ---
    this.updatePomodoroTimer()

    // --- Periodic SQLite Heartbeat (every 15s) ---
    if (nowMs - this.lastHeartbeatMs >= 15_000) {
      this.lastHeartbeatMs = nowMs
      this.db.recordHeartbeat(nowMs, this.currentSession.type, this.currentSession.id)
    }

    // --- Scheduled OS Notifications (End of Shift, Daily/Weekly Summary) ---
    if (nowMs - this.lastScheduledCheckMs >= 15_000) {
      this.lastScheduledCheckMs = nowMs
      this.checkScheduledNotifications(nowMs, settings)
    }

    this.emitState()
  }

  private transitionIdleToActive(nowMs: number, settings: AppSettings): void {
    const closed = this.db.closeSession(this.currentSession.id, nowMs)
    const wasAutoIdle = this.currentSession.type === 'auto_idle'
    const hadTag = Boolean(this.currentSession.tag)

    this.currentSession = this.db.startSession({
      type: 'active',
      startTime: nowMs
    })

    if (closed && closed.durationSec >= 180) {
      // Reset continuous sitting streak after >= 3 min break
      this.continuousActiveSec = 0
      this.sittingAlertFired = false
    }
    if (closed && closed.durationSec >= 60) {
      this.eyeCareRemainingSec = settings.eyeCareIntervalMinutes * 60
    }

    if (
      closed &&
      wasAutoIdle &&
      !hadTag &&
      closed.durationSec >= settings.returnPopupMinMinutes * 60
    ) {
      this.pendingReturnPopup = {
        sessionId: closed.id,
        durationSec: closed.durationSec,
        startTime: closed.startTime,
        endTime: closed.endTime ?? nowMs
      }
      this.emit('return-popup', this.pendingReturnPopup)
    }
  }

  private updateHealthTimers(nowMs: number, settings: AppSettings): void {
    // Active break overlay countdown (e.g. 20-second 20-20-20 countdown)
    if (this.activeBreakOverlay) {
      if (this.activeBreakOverlay.countdownSec > 1) {
        this.activeBreakOverlay = {
          ...this.activeBreakOverlay,
          countdownSec: this.activeBreakOverlay.countdownSec - 1
        }
      } else {
        this.activeBreakOverlay = null
        this.eyeCareRemainingSec = settings.eyeCareIntervalMinutes * 60
        this.emit('break-overlay-closed')
      }
      return
    }

    if (this.currentSession.type === 'active') {
      // 1) 20-20-20 Eye Care
      if (settings.eyeCareEnabled) {
        this.eyeCareRemainingSec = Math.max(0, this.eyeCareRemainingSec - 1)
        if (this.eyeCareRemainingSec === 0) {
          this.triggerEyeBreak()
        }
      } else {
        this.eyeCareRemainingSec = settings.eyeCareIntervalMinutes * 60
      }

      // 2) Long Sitting Alert
      this.continuousActiveSec += 1
      if (
        settings.longSittingEnabled &&
        !this.sittingAlertFired &&
        this.continuousActiveSec >= settings.longSittingMinutes * 60
      ) {
        this.sittingAlertFired = true
        this.activeBreakOverlay = { kind: 'long_sitting', countdownSec: 30 }
        this.emit('break-overlay', this.activeBreakOverlay)
        this.emit('notification', {
          type: 'long_sitting',
          minutes: Math.round(this.continuousActiveSec / 60)
        })
      }
    } else {
      // Idle: check if break >= 3m resets continuous sitting, and check Return-to-Work nudge
      const idleElapsedSec = Math.max(0, Math.round((nowMs - this.currentSession.startTime) / 1000))
      if (idleElapsedSec >= 180) {
        this.continuousActiveSec = 0
        this.sittingAlertFired = false
      }
      if (idleElapsedSec >= 60) {
        this.eyeCareRemainingSec = settings.eyeCareIntervalMinutes * 60
      }

      if (
        settings.returnToWorkReminderEnabled &&
        this.currentSession.tag !== 'meeting' &&
        this.currentSession.tag !== 'eating' &&
        this.returnReminderFiredForSessionId !== this.currentSession.id &&
        idleElapsedSec >= settings.returnToWorkMaxIdleMinutes * 60 &&
        this.isWithinWorkShiftExcludingLunch(nowMs, settings)
      ) {
        this.returnReminderFiredForSessionId = this.currentSession.id
        this.emit('notification', {
          type: 'return_to_work',
          minutes: Math.round(idleElapsedSec / 60)
        })
      }
    }
  }

  private isWithinWorkShiftExcludingLunch(nowMs: number, settings: AppSettings): boolean {
    const dt = new Date(nowMs)
    const curMin = dt.getHours() * 60 + dt.getMinutes()
    const shiftStart = parseTimeToMinutes(settings.shiftStart)
    const shiftEnd = parseTimeToMinutes(settings.shiftEnd)
    const lunchStart = parseTimeToMinutes(settings.lunchStart)
    const lunchEnd = parseTimeToMinutes(settings.lunchEnd)

    if (curMin < shiftStart || curMin > shiftEnd) return false
    if (curMin >= lunchStart && curMin < lunchEnd) return false
    return true
  }

  private updatePomodoroTimer(): void {
    if (!this.pomodoro.running || this.pomodoro.phase === 'idle') return
    if (this.pomodoro.remainingSec > 1) {
      this.pomodoro = {
        ...this.pomodoro,
        remainingSec: this.pomodoro.remainingSec - 1
      }
    } else {
      // Phase finished -> switch phase
      if (this.pomodoro.phase === 'focus') {
        const nextCount = this.pomodoro.completedFocusCount + 1
        this.pomodoro = {
          ...this.pomodoro,
          phase: 'break',
          remainingSec: this.pomodoro.breakMinutes * 60,
          completedFocusCount: nextCount
        }
        this.emit('notification', { type: 'pomodoro_break', count: nextCount })
      } else {
        this.pomodoro = {
          ...this.pomodoro,
          phase: 'focus',
          remainingSec: this.pomodoro.focusMinutes * 60
        }
        this.emit('notification', { type: 'pomodoro_focus' })
      }
    }
  }

  private checkScheduledNotifications(nowMs: number, settings: AppSettings): void {
    const dt = new Date(nowMs)
    const dateStr = formatLocalDate(nowMs)
    const curMin = dt.getHours() * 60 + dt.getMinutes()
    const shiftEndMin = parseTimeToMinutes(settings.shiftEnd)

    // 1) End-of-Shift Nippo Reminder
    if (settings.endOfShiftNotification && curMin >= shiftEndMin && curMin <= shiftEndMin + 30) {
      const key = `end_of_shift_${dateStr}_${settings.shiftEnd}`
      if (!this.db.hasNotificationFired(key)) {
        this.db.markNotificationFired(key, nowMs)
        this.emit('notification', { type: 'end_of_shift', time: settings.shiftEnd })
      }
    }

    // 2) Daily Summary Notification (10 minutes after shift end)
    if (
      settings.dailySummaryNotification &&
      curMin >= shiftEndMin + 10 &&
      curMin <= shiftEndMin + 45
    ) {
      const key = `daily_summary_${dateStr}`
      if (!this.db.hasNotificationFired(key)) {
        this.db.markNotificationFired(key, nowMs)
        this.emit('notification', { type: 'daily_summary' })
      }
    }

    // 3) Weekly Summary Notification (Friday after shift end)
    if (settings.weeklySummaryNotification && dt.getDay() === 5 && curMin >= shiftEndMin + 15) {
      const key = `weekly_summary_${dateStr}`
      if (!this.db.hasNotificationFired(key)) {
        this.db.markNotificationFired(key, nowMs)
        this.emit('notification', { type: 'weekly_summary' })
      }
    }
  }

  // --- Public Actions ---
  public startManualIdle(tag: IdleTag, note = ''): void {
    const nowMs = this.now()
    this.db.closeSession(this.currentSession.id, nowMs)
    this.currentSession = this.db.startSession({
      type: 'manual_idle',
      startTime: nowMs,
      tag,
      note,
      isManual: true
    })
    this.manualIdleStartedAt = nowMs
    this.returnReminderFiredForSessionId = null
    this.db.recordHeartbeat(nowMs, 'manual_idle', this.currentSession.id)
    this.emitState()
  }

  public resumeFromIdle(): void {
    if (this.currentSession.type === 'active') return
    const nowMs = this.now()
    const settings = this.db.getSettings()
    this.systemLockedOrSuspended = false
    this.transitionIdleToActive(nowMs, settings)
    this.db.recordHeartbeat(nowMs, 'active', this.currentSession.id)
    this.emitState()
  }

  public handleSystemSuspendOrLock(reason: 'suspend' | 'lock-screen'): void {
    const nowMs = this.now()
    this.systemLockedOrSuspended = true
    if (this.currentSession.type === 'active') {
      this.db.closeSession(this.currentSession.id, nowMs)
      this.currentSession = this.db.startSession({
        type: 'auto_idle',
        startTime: nowMs,
        note: reason === 'lock-screen' ? 'Screen locked' : 'System sleep',
        isManual: false
      })
    }
    this.db.recordHeartbeat(nowMs, 'auto_idle', this.currentSession.id)
    this.emitState()
  }

  public handleSystemResumeOrUnlock(): void {
    const nowMs = this.now()
    this.systemLockedOrSuspended = false
    const settings = this.db.getSettings()
    if (this.currentSession.type === 'auto_idle') {
      this.transitionIdleToActive(nowMs, settings)
    }
    this.db.recordHeartbeat(nowMs, this.currentSession.type, this.currentSession.id)
    this.emitState()
  }

  public submitReturnTag(sessionId: number, tag: IdleTag | null, note = ''): void {
    if (tag) {
      this.db.updateSessionTag(sessionId, tag, note)
    }
    if (this.pendingReturnPopup?.sessionId === sessionId) {
      this.pendingReturnPopup = null
    }
    this.emit('return-popup-closed')
    this.emitState()
  }

  public dismissReturnPopup(): void {
    this.pendingReturnPopup = null
    this.emit('return-popup-closed')
    this.emitState()
  }

  public triggerEyeBreak(): void {
    this.activeBreakOverlay = { kind: 'eye_20_20_20', countdownSec: 20 }
    this.emit('break-overlay', this.activeBreakOverlay)
    this.emitState()
  }

  public dismissBreakOverlay(snoozeMinutes?: number): void {
    const settings = this.db.getSettings()
    this.activeBreakOverlay = null
    if (snoozeMinutes && snoozeMinutes > 0) {
      this.eyeCareRemainingSec = snoozeMinutes * 60
    } else {
      this.eyeCareRemainingSec = settings.eyeCareIntervalMinutes * 60
    }
    this.emit('break-overlay-closed')
    this.emitState()
  }

  // --- Pomodoro Controls ---
  public startPomodoro(
    preset?: PomodoroPreset,
    customFocus?: number,
    customBreak?: number
  ): void {
    const nextPreset = preset ?? this.pomodoro.preset
    let focusMinutes = this.pomodoro.focusMinutes
    let breakMinutes = this.pomodoro.breakMinutes

    if (nextPreset === '25_5') {
      focusMinutes = 25
      breakMinutes = 5
    } else if (nextPreset === '50_10') {
      focusMinutes = 50
      breakMinutes = 10
    } else {
      focusMinutes = Math.max(1, customFocus ?? focusMinutes)
      breakMinutes = Math.max(1, customBreak ?? breakMinutes)
    }

    const isResumingPaused =
      !preset && this.pomodoro.phase !== 'idle' && !this.pomodoro.running
    this.pomodoro = {
      ...this.pomodoro,
      running: true,
      preset: nextPreset,
      focusMinutes,
      breakMinutes,
      phase: isResumingPaused ? this.pomodoro.phase : 'focus',
      remainingSec: isResumingPaused ? this.pomodoro.remainingSec : focusMinutes * 60
    }
    this.emitState()
  }

  public pausePomodoro(): void {
    this.pomodoro = { ...this.pomodoro, running: false }
    this.emitState()
  }

  public resetPomodoro(): void {
    this.pomodoro = {
      ...this.pomodoro,
      running: false,
      phase: 'idle',
      remainingSec: this.pomodoro.focusMinutes * 60
    }
    this.emitState()
  }

  public skipPomodoroPhase(): void {
    if (this.pomodoro.phase === 'focus') {
      this.pomodoro = {
        ...this.pomodoro,
        phase: 'break',
        remainingSec: this.pomodoro.breakMinutes * 60,
        completedFocusCount: this.pomodoro.completedFocusCount + 1
      }
    } else {
      this.pomodoro = {
        ...this.pomodoro,
        phase: 'focus',
        remainingSec: this.pomodoro.focusMinutes * 60
      }
    }
    this.emitState()
  }

  // --- Tasks Shortcut ---
  public startTask(title: string, category = 'general'): TaskRecord {
    const nowMs = this.now()
    const task = this.db.startTask(title, nowMs, category)
    if (this.currentSession.type !== 'active') {
      this.resumeFromIdle()
    } else {
      this.emitState()
    }
    return task
  }

  public stopActiveTask(): void {
    this.db.stopActiveTask(this.now())
    this.emitState()
  }

  public getLiveState(): LiveTrackingState {
    const nowMs = this.now()
    const todayStr = formatLocalDate(nowMs)
    const totals = this.db.getDayTotals(todayStr, nowMs)
    const activeTask = this.db.getActiveTask()
    const elapsedSec = Math.max(0, Math.round((nowMs - this.currentSession.startTime) / 1000))

    return {
      status:
        this.currentSession.type === 'manual_idle'
          ? 'manual_idle'
          : this.currentSession.type === 'auto_idle'
            ? 'auto_idle'
            : 'active',
      osIdleSec: this.getSystemIdleTime(),
      currentSessionStart: this.currentSession.startTime,
      currentSessionElapsedSec: elapsedSec,
      currentManualTag: this.currentSession.tag,
      currentSmartException: this.currentSmartException,
      activeTask: activeTask
        ? {
            ...activeTask,
            durationSec: Math.max(0, Math.round((nowMs - activeTask.startTime) / 1000))
          }
        : null,
      todayActiveSec: totals.activeSec,
      todayIdleSec: totals.idleSec,
      pomodoro: { ...this.pomodoro },
      health: {
        eyeCareRemainingSec: this.eyeCareRemainingSec,
        eyeBreakCountdownSec:
          this.activeBreakOverlay?.kind === 'eye_20_20_20'
            ? this.activeBreakOverlay.countdownSec
            : null,
        continuousActiveSec: this.continuousActiveSec,
        sittingAlertActive: this.activeBreakOverlay?.kind === 'long_sitting'
      },
      pendingReturnPopup: this.pendingReturnPopup,
      activeBreakOverlay: this.activeBreakOverlay
    }
  }

  public emitState(): void {
    this.emit('state', this.getLiveState())
  }
}
