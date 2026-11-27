import Database from 'better-sqlite3'
import {
  AnalyticsPayload,
  AnalyticsRange,
  AppSettings,
  BreakCategory,
  ChartDataPoint,
  classifyBreakDuration,
  DailyReportDocument,
  DEFAULT_SETTINGS,
  HeatmapCell,
  IdleTag,
  SessionRecord,
  SessionType,
  SmartExceptionReason,
  TaskRecord,
  TopIdleHourItem
} from '../shared/types'
import { getDayStartMs } from '../shared/reportFormatter'

export interface HeartbeatRow {
  lastSeenAt: number
  status: string
  activeSessionId: number | null
}

function mapSessionRow(row: any): SessionRecord {
  const endMs = row.end_time ?? null
  const dur =
    endMs !== null
      ? Math.max(0, Math.round((endMs - row.start_time) / 1000))
      : Number(row.duration_sec || 0)
  return {
    id: Number(row.id),
    type: row.type as SessionType,
    startTime: Number(row.start_time),
    endTime: endMs !== null ? Number(endMs) : null,
    durationSec: dur,
    breakCategory: (row.break_category || 'none') as BreakCategory,
    tag: (row.tag || null) as IdleTag | null,
    note: String(row.note || ''),
    smartException: (row.smart_exception || 'none') as SmartExceptionReason,
    isManual: Boolean(row.is_manual)
  }
}

function mapTaskRow(row: any): TaskRecord {
  const endMs = row.end_time ?? null
  const dur =
    endMs !== null
      ? Math.max(0, Math.round((endMs - row.start_time) / 1000))
      : Number(row.duration_sec || 0)
  return {
    id: Number(row.id),
    title: String(row.title),
    startTime: Number(row.start_time),
    endTime: endMs !== null ? Number(endMs) : null,
    durationSec: dur,
    category: String(row.category || 'general')
  }
}

export class IdlePulseDatabase {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('foreign_keys = ON')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration_sec INTEGER NOT NULL DEFAULT 0,
        break_category TEXT NOT NULL DEFAULT 'none',
        tag TEXT,
        note TEXT NOT NULL DEFAULT '',
        smart_exception TEXT NOT NULL DEFAULT 'none',
        is_manual INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_time ON sessions(start_time, end_time);

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration_sec INTEGER NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT 'general'
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_time ON tasks(start_time);

      CREATE TABLE IF NOT EXISTS heartbeats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_seen_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        active_session_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS daily_reports (
        date TEXT PRIMARY KEY,
        shift_start TEXT NOT NULL,
        shift_end TEXT NOT NULL,
        rows_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_log (
        key TEXT PRIMARY KEY,
        sent_at INTEGER NOT NULL
      );
    `)
  }

  public close(): void {
    this.db.close()
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('app_settings') as { value: string } | undefined
    if (!row) {
      this.saveSettings(DEFAULT_SETTINGS)
      return { ...DEFAULT_SETTINGS, stickyWidget: { ...DEFAULT_SETTINGS.stickyWidget } }
    }
    try {
      const parsed = JSON.parse(row.value)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        stickyWidget: {
          ...DEFAULT_SETTINGS.stickyWidget,
          ...(parsed.stickyWidget || {})
        }
      }
    } catch {
      return { ...DEFAULT_SETTINGS, stickyWidget: { ...DEFAULT_SETTINGS.stickyWidget } }
    }
  }

  public saveSettings(settings: AppSettings): AppSettings {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES ('app_settings', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(JSON.stringify(settings))
    return settings
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const next: AppSettings = {
      ...current,
      ...partial,
      stickyWidget: {
        ...current.stickyWidget,
        ...(partial.stickyWidget || {})
      }
    }
    return this.saveSettings(next)
  }

  // --- Heartbeats & Crash/Shutdown/Sleep Gap Recovery ---
  public recordHeartbeat(nowMs: number, status: string, activeSessionId: number | null): void {
    this.db
      .prepare(
        `INSERT INTO heartbeats (id, last_seen_at, status, active_session_id)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           last_seen_at = excluded.last_seen_at,
           status = excluded.status,
           active_session_id = excluded.active_session_id`
      )
      .run(nowMs, status, activeSessionId)
  }

  public getLastHeartbeat(): HeartbeatRow | null {
    const row = this.db.prepare('SELECT * FROM heartbeats WHERE id = 1').get() as any
    if (!row) return null
    return {
      lastSeenAt: Number(row.last_seen_at),
      status: String(row.status),
      activeSessionId: row.active_session_id ? Number(row.active_session_id) : null
    }
  }

  public recoverFromShutdownOrSleep(nowMs: number, idleThresholdSec: number): SessionRecord | null {
    const hb = this.getLastHeartbeat()
    const openSessions = this.db
      .prepare('SELECT * FROM sessions WHERE end_time IS NULL')
      .all() as any[]

    const fallbackCloseMs = hb ? hb.lastSeenAt : nowMs

    for (const s of openSessions) {
      const closeAt = Math.max(Number(s.start_time), fallbackCloseMs)
      this.closeSession(Number(s.id), closeAt)
    }

    // Close any dangling tasks at last heartbeat
    const openTasks = this.db.prepare('SELECT * FROM tasks WHERE end_time IS NULL').all() as any[]
    for (const t of openTasks) {
      const closeAt = Math.max(Number(t.start_time), fallbackCloseMs)
      const dur = Math.max(0, Math.round((closeAt - Number(t.start_time)) / 1000))
      this.db
        .prepare('UPDATE tasks SET end_time = ?, duration_sec = ? WHERE id = ?')
        .run(closeAt, dur, t.id)
    }

    if (hb && nowMs - hb.lastSeenAt >= idleThresholdSec * 1000) {
      const gapSec = Math.round((nowMs - hb.lastSeenAt) / 1000)
      const cat = classifyBreakDuration(gapSec)
      const tag: IdleTag = gapSec >= 4 * 3600 ? 'sleep' : 'out'
      const res = this.db
        .prepare(
          `INSERT INTO sessions (type, start_time, end_time, duration_sec, break_category, tag, note, smart_exception, is_manual)
           VALUES ('system_offline', ?, ?, ?, ?, ?, 'System sleep / shutdown gap recovered', 'none', 0)`
        )
        .run(hb.lastSeenAt, nowMs, gapSec, cat, tag)
      return this.getSessionById(Number(res.lastInsertRowid))
    }

    return null
  }

  // --- Sessions ---
  public startSession(params: {
    type: SessionType
    startTime: number
    tag?: IdleTag | null
    note?: string
    smartException?: SmartExceptionReason
    isManual?: boolean
  }): SessionRecord {
    const res = this.db
      .prepare(
        `INSERT INTO sessions (type, start_time, end_time, duration_sec, break_category, tag, note, smart_exception, is_manual)
         VALUES (?, ?, NULL, 0, 'none', ?, ?, ?, ?)`
      )
      .run(
        params.type,
        params.startTime,
        params.tag ?? null,
        params.note ?? '',
        params.smartException ?? 'none',
        params.isManual ? 1 : 0
      )
    return this.getSessionById(Number(res.lastInsertRowid))!
  }

  public closeSession(sessionId: number, endTimeMs: number): SessionRecord | null {
    const existing = this.getSessionById(sessionId)
    if (!existing) return null
    const clampedEnd = Math.max(existing.startTime, endTimeMs)
    const durationSec = Math.max(0, Math.round((clampedEnd - existing.startTime) / 1000))
    const breakCategory: BreakCategory =
      existing.type === 'active' ? 'none' : classifyBreakDuration(durationSec)

    this.db
      .prepare(
        `UPDATE sessions
         SET end_time = ?, duration_sec = ?, break_category = ?
         WHERE id = ?`
      )
      .run(clampedEnd, durationSec, breakCategory, sessionId)

    return this.getSessionById(sessionId)
  }

  public updateSessionTag(sessionId: number, tag: IdleTag | null, note = ''): SessionRecord | null {
    this.db
      .prepare('UPDATE sessions SET tag = ?, note = ? WHERE id = ?')
      .run(tag, note, sessionId)
    return this.getSessionById(sessionId)
  }

  public updateSessionSmartException(
    sessionId: number,
    reason: SmartExceptionReason
  ): void {
    this.db
      .prepare('UPDATE sessions SET smart_exception = ? WHERE id = ?')
      .run(reason, sessionId)
  }

  public getSessionById(id: number): SessionRecord | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
    return row ? mapSessionRow(row) : null
  }

  public getSessionsOverlapping(startMs: number, endMs: number): SessionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE start_time < ? AND (end_time IS NULL OR end_time > ?)
         ORDER BY start_time ASC`
      )
      .all(endMs, startMs)
    return rows.map(mapSessionRow)
  }

  // --- Tasks ---
  public getActiveTask(): TaskRecord | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1')
      .get()
    return row ? mapTaskRow(row) : null
  }

  public startTask(title: string, nowMs: number, category = 'general'): TaskRecord {
    this.stopActiveTask(nowMs)
    const res = this.db
      .prepare(
        `INSERT INTO tasks (title, start_time, end_time, duration_sec, category)
         VALUES (?, ?, NULL, 0, ?)`
      )
      .run(title.trim(), nowMs, category)
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(res.lastInsertRowid)
    return mapTaskRow(row)
  }

  public stopActiveTask(nowMs: number): void {
    const openTasks = this.db.prepare('SELECT * FROM tasks WHERE end_time IS NULL').all() as any[]
    for (const t of openTasks) {
      const clampedEnd = Math.max(Number(t.start_time), nowMs)
      const dur = Math.max(0, Math.round((clampedEnd - Number(t.start_time)) / 1000))
      this.db
        .prepare('UPDATE tasks SET end_time = ?, duration_sec = ? WHERE id = ?')
        .run(clampedEnd, dur, t.id)
    }
  }

  public getTasksByDate(dateStr: string): TaskRecord[] {
    const startMs = getDayStartMs(dateStr)
    const endMs = startMs + 24 * 3600 * 1000
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE start_time < ? AND (end_time IS NULL OR end_time > ?)
         ORDER BY start_time ASC`
      )
      .all(endMs, startMs)
    return rows.map(mapTaskRow)
  }

  public updateTask(
    id: number,
    updates: Partial<Pick<TaskRecord, 'title' | 'startTime' | 'endTime'>>
  ): void {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any
    if (!row) return
    const nextTitle = updates.title !== undefined ? updates.title.trim() : row.title
    const nextStart = updates.startTime !== undefined ? updates.startTime : Number(row.start_time)
    const nextEnd =
      updates.endTime !== undefined
        ? updates.endTime
        : row.end_time !== null
          ? Number(row.end_time)
          : null
    const dur =
      nextEnd !== null ? Math.max(0, Math.round((nextEnd - nextStart) / 1000)) : Number(row.duration_sec)

    this.db
      .prepare('UPDATE tasks SET title = ?, start_time = ?, end_time = ?, duration_sec = ? WHERE id = ?')
      .run(nextTitle, nextStart, nextEnd, dur, id)
  }

  public deleteTask(id: number): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  // --- Daily Reports ---
  public getSavedDailyReport(dateStr: string): DailyReportDocument | null {
    const row = this.db
      .prepare('SELECT * FROM daily_reports WHERE date = ?')
      .get(dateStr) as any
    if (!row) return null
    try {
      return {
        date: String(row.date),
        shiftStart: String(row.shift_start),
        shiftEnd: String(row.shift_end),
        rows: JSON.parse(row.rows_json),
        updatedAt: Number(row.updated_at)
      }
    } catch {
      return null
    }
  }

  public saveDailyReport(doc: DailyReportDocument): DailyReportDocument {
    const now = Date.now()
    const updated: DailyReportDocument = { ...doc, updatedAt: now }
    this.db
      .prepare(
        `INSERT INTO daily_reports (date, shift_start, shift_end, rows_json, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           shift_start = excluded.shift_start,
           shift_end = excluded.shift_end,
           rows_json = excluded.rows_json,
           updated_at = excluded.updated_at`
      )
      .run(updated.date, updated.shiftStart, updated.shiftEnd, JSON.stringify(updated.rows), now)
    return updated
  }

  // --- Notification Deduplication ---
  public hasNotificationFired(key: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM notification_log WHERE key = ?').get(key)
    return Boolean(row)
  }

  public markNotificationFired(key: string, nowMs = Date.now()): void {
    this.db
      .prepare(
        `INSERT INTO notification_log (key, sent_at) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET sent_at = excluded.sent_at`
      )
      .run(key, nowMs)
  }

  // --- Totals & Analytics ---
  public getDayTotals(dateStr: string, nowMs = Date.now()): {
    activeSec: number
    idleSec: number
    microSec: number
    shortSec: number
    longSec: number
    sessions: SessionRecord[]
  } {
    const dayStart = getDayStartMs(dateStr)
    const dayEnd = dayStart + 24 * 3600 * 1000
    const sessions = this.getSessionsOverlapping(dayStart, dayEnd)

    let activeSec = 0
    let idleSec = 0
    let microSec = 0
    let shortSec = 0
    let longSec = 0

    for (const s of sessions) {
      const rawEnd = s.endTime ?? nowMs
      const clippedStart = Math.max(dayStart, s.startTime)
      const clippedEnd = Math.min(dayEnd, rawEnd)
      if (clippedEnd <= clippedStart) continue
      const sec = Math.round((clippedEnd - clippedStart) / 1000)

      if (s.type === 'active') {
        activeSec += sec
      } else if (s.type === 'auto_idle' || s.type === 'manual_idle') {
        idleSec += sec
        const totalDur = Math.round((rawEnd - s.startTime) / 1000)
        const cat = s.endTime ? s.breakCategory : classifyBreakDuration(totalDur)
        if (cat === 'micro') microSec += sec
        else if (cat === 'short') shortSec += sec
        else longSec += sec
      }
    }

    return { activeSec, idleSec, microSec, shortSec, longSec, sessions }
  }

  public getAnalytics(
    range: AnalyticsRange,
    anchorDateStr?: string,
    nowMs = Date.now()
  ): AnalyticsPayload {
    const todayDate = anchorDateStr || formatLocalDate(nowMs)
    const todayTotals = this.getDayTotals(todayDate, nowMs)
    const totalTracked = todayTotals.activeSec + todayTotals.idleSec
    const activeRatioPercent =
      totalTracked > 0 ? Math.round((todayTotals.activeSec / totalTracked) * 100) : 0

    const chartPoints: ChartDataPoint[] = []

    if (range === 'hour') {
      const dayStart = getDayStartMs(todayDate)
      for (let h = 0; h < 24; h++) {
        const bStart = dayStart + h * 3600 * 1000
        const bEnd = bStart + 3600 * 1000
        const bucket = this.computeBucketStats(todayTotals.sessions, bStart, bEnd, nowMs)
        chartPoints.push({
          label: `${String(h).padStart(2, '0')}:00`,
          ...bucket
        })
      }
    } else if (range === 'day') {
      const anchorStart = getDayStartMs(todayDate)
      for (let offset = 6; offset >= 0; offset--) {
        const bStart = anchorStart - offset * 24 * 3600 * 1000
        const bEnd = bStart + 24 * 3600 * 1000
        const d = new Date(bStart)
        const sessions = this.getSessionsOverlapping(bStart, bEnd)
        const bucket = this.computeBucketStats(sessions, bStart, bEnd, nowMs)
        chartPoints.push({
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          ...bucket
        })
      }
    } else {
      // 'week' - past 6 weeks
      const anchorStart = getDayStartMs(todayDate)
      const anchorDate = new Date(anchorStart)
      const dayOfWeek = anchorDate.getDay()
      const currentWeekStart = anchorStart - dayOfWeek * 24 * 3600 * 1000

      for (let w = 5; w >= 0; w--) {
        const bStart = currentWeekStart - w * 7 * 24 * 3600 * 1000
        const bEnd = bStart + 7 * 24 * 3600 * 1000
        const d = new Date(bStart)
        const sessions = this.getSessionsOverlapping(bStart, bEnd)
        const bucket = this.computeBucketStats(sessions, bStart, bEnd, nowMs)
        chartPoints.push({
          label: `${d.getMonth() + 1}/${d.getDate()}~`,
          ...bucket
        })
      }
    }

    // 14-day history for 7x24 Heatmap & Top Idle Hours
    const historyEnd = getDayStartMs(todayDate) + 24 * 3600 * 1000
    const historyStart = historyEnd - 14 * 24 * 3600 * 1000
    const histSessions = this.getSessionsOverlapping(historyStart, historyEnd)

    const heatmapMatrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
    const dayCountsPerWeekday = new Array(7).fill(0)
    for (let d = 0; d < 14; d++) {
      const dt = new Date(historyStart + d * 24 * 3600 * 1000)
      dayCountsPerWeekday[dt.getDay()]++
    }

    const hourlyIdleSecTotal = new Array(24).fill(0)
    const activeDaysSet = new Set<string>()

    for (const s of histSessions) {
      if (s.type !== 'auto_idle' && s.type !== 'manual_idle') continue
      const rawEnd = Math.min(historyEnd, s.endTime ?? nowMs)
      let cursor = Math.max(historyStart, s.startTime)

      while (cursor < rawEnd) {
        const dt = new Date(cursor)
        activeDaysSet.add(formatLocalDate(cursor))
        const hourStart = new Date(
          dt.getFullYear(),
          dt.getMonth(),
          dt.getDate(),
          dt.getHours(),
          0,
          0,
          0
        ).getTime()
        const hourEnd = hourStart + 3600 * 1000
        const sliceEnd = Math.min(rawEnd, hourEnd)
        const sec = Math.max(0, (sliceEnd - cursor) / 1000)

        const dow = dt.getDay()
        const hr = dt.getHours()
        heatmapMatrix[dow][hr] += sec / 60
        hourlyIdleSecTotal[hr] += sec

        cursor = sliceEnd
      }
    }

    const heatmap: HeatmapCell[] = []
    for (let dow = 0; dow < 7; dow++) {
      const divisor = Math.max(1, dayCountsPerWeekday[dow])
      for (let hr = 0; hr < 24; hr++) {
        heatmap.push({
          dayOfWeek: dow,
          hour: hr,
          idleMinutes: Math.round(heatmapMatrix[dow][hr] / divisor)
        })
      }
    }

    const numObservedDays = Math.max(1, activeDaysSet.size)
    const maxHourSec = Math.max(1, ...hourlyIdleSecTotal)
    const topIdleHours: TopIdleHourItem[] = hourlyIdleSecTotal
      .map((sec, hr) => ({
        hour: hr,
        label: `${String(hr).padStart(2, '0')}:00–${String((hr + 1) % 24).padStart(2, '0')}:00`,
        totalIdleMin: Math.round(sec / 60),
        avgIdleMin: Math.round(sec / 60 / numObservedDays),
        percentage: Math.round((sec / maxHourSec) * 100)
      }))
      .filter((item) => item.totalIdleMin > 0)
      .sort((a, b) => b.totalIdleMin - a.totalIdleMin)
      .slice(0, 5)

    return {
      range,
      chartPoints,
      todayActiveSec: todayTotals.activeSec,
      todayIdleSec: todayTotals.idleSec,
      activeRatioPercent,
      breakBreakdown: {
        microSec: todayTotals.microSec,
        shortSec: todayTotals.shortSec,
        longSec: todayTotals.longSec
      },
      intradaySessions: todayTotals.sessions.map((s) => ({
        ...s,
        durationSec:
          s.endTime !== null
            ? s.durationSec
            : Math.max(0, Math.round((nowMs - s.startTime) / 1000))
      })),
      heatmap,
      topIdleHours
    }
  }

  private computeBucketStats(
    sessions: SessionRecord[],
    bStart: number,
    bEnd: number,
    nowMs: number
  ): Omit<ChartDataPoint, 'label'> {
    let activeSec = 0
    let idleSec = 0
    let microSec = 0
    let shortSec = 0
    let longSec = 0

    for (const s of sessions) {
      const rawEnd = s.endTime ?? nowMs
      const cStart = Math.max(bStart, s.startTime)
      const cEnd = Math.min(bEnd, rawEnd)
      if (cEnd <= cStart) continue
      const sec = (cEnd - cStart) / 1000

      if (s.type === 'active') {
        activeSec += sec
      } else if (s.type === 'auto_idle' || s.type === 'manual_idle') {
        idleSec += sec
        const cat = s.endTime
          ? s.breakCategory
          : classifyBreakDuration(Math.round((rawEnd - s.startTime) / 1000))
        if (cat === 'micro') microSec += sec
        else if (cat === 'short') shortSec += sec
        else longSec += sec
      }
    }

    return {
      activeMin: Math.round(activeSec / 60),
      idleMin: Math.round(idleSec / 60),
      microMin: Math.round(microSec / 60),
      shortMin: Math.round(shortSec / 60),
      longMin: Math.round(longSec / 60)
    }
  }

  // --- CSV & JSON Export ---
  public exportHistory(
    format: 'csv' | 'json',
    startDateStr: string,
    endDateStr: string
  ): { content: string; rowCount: number } {
    const startMs = getDayStartMs(startDateStr)
    const endMs = getDayStartMs(endDateStr) + 24 * 3600 * 1000
    const sessions = this.getSessionsOverlapping(startMs, endMs)
    const tasks = this.db
      .prepare(
        `SELECT * FROM tasks WHERE start_time < ? AND (end_time IS NULL OR end_time > ?) ORDER BY start_time ASC`
      )
      .all(endMs, startMs)
      .map(mapTaskRow)

    if (format === 'json') {
      const payload = {
        exportedAt: new Date().toISOString(),
        range: { startDate: startDateStr, endDate: endDateStr },
        sessions,
        tasks
      }
      return {
        content: JSON.stringify(payload, null, 2),
        rowCount: sessions.length + tasks.length
      }
    }

    // UTF-8 BOM (\uFEFF) so Microsoft Excel on Windows & macOS renders Vietnamese/Japanese properly
    const headers = [
      'RecordType',
      'ID',
      'SessionOrCategory',
      'StartTimeISO',
      'EndTimeISO',
      'DurationSeconds',
      'DurationMinutes',
      'BreakCategory',
      'Tag',
      'SmartException',
      'TitleOrNote'
    ]
    const escapeCsv = (val: string | number | null | undefined): string => {
      const str = val === null || val === undefined ? '' : String(val)
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const lines = [headers.join(',')]
    for (const s of sessions) {
      lines.push(
        [
          'session',
          s.id,
          s.type,
          new Date(s.startTime).toISOString(),
          s.endTime ? new Date(s.endTime).toISOString() : '',
          s.durationSec,
          (s.durationSec / 60).toFixed(1),
          s.breakCategory,
          s.tag ?? '',
          s.smartException,
          s.note
        ]
          .map(escapeCsv)
          .join(',')
      )
    }

    for (const t of tasks) {
      lines.push(
        [
          'task',
          t.id,
          t.category,
          new Date(t.startTime).toISOString(),
          t.endTime ? new Date(t.endTime).toISOString() : '',
          t.durationSec,
          (t.durationSec / 60).toFixed(1),
          '',
          '',
          '',
          t.title
        ]
          .map(escapeCsv)
          .join(',')
      )
    }

    return {
      content: '\uFEFF' + lines.join('\n'),
      rowCount: sessions.length + tasks.length
    }
  }
}

export function formatLocalDate(epochMs: number): string {
  const d = new Date(epochMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
