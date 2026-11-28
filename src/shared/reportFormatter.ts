import { DailyReportRow, IdleTag, SessionRecord, TaskRecord } from './types'

export function parseTimeToMinutes(timeStr: string): number {
  const clean = timeStr.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(clean)
  if (!match) return 0
  const h = Math.min(23, Math.max(0, Number(match[1])))
  const m = Math.min(59, Math.max(0, Number(match[2])))
  return h * 60 + m
}

export function minutesToReportTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export function normalizeReportTime(timeStr: string): string {
  const clean = timeStr.trim()
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(clean)
  if (!match) return clean
  const h = Number(match[1])
  const m = Number(match[2])
  return `${h}:${String(m).padStart(2, '0')}`
}

export function epochToDayMinutes(epochMs: number, dayStartMs: number): number {
  return Math.round((epochMs - dayStartMs) / 60000)
}

export function getDayStartMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime()
}

export function formatReportDateHeader(
  dateStr: string,
  userName: string,
  reportTitle = 'Daily Report'
): string {
  const slashDate = dateStr.replace(/-/g, '/')
  const displayUser = userName.trim() || 'User'
  const cleanTitle = reportTitle.trim()
  return cleanTitle
    ? `${slashDate} (${displayUser}) ${cleanTitle}`
    : `${slashDate} (${displayUser})`
}

// Backward-compatible alias
export const formatNippoDateHeader = formatReportDateHeader

/**
 * Formats Daily Report into Tab-delimited plain-text format:
 * YYYY/MM/DD (User Name) Daily Report
 * 8:30~9:30\tlàm gì
 */
export function formatDailyReportPlainText(
  dateStr: string,
  userName: string,
  rows: DailyReportRow[],
  reportTitle = 'Daily Report'
): string {
  const header = formatReportDateHeader(dateStr, userName, reportTitle)
  const lines = rows
    .filter((r) => r.startTime.trim() || r.endTime.trim() || r.content.trim())
    .map((r) => {
      const start = normalizeReportTime(r.startTime)
      const end = normalizeReportTime(r.endTime)
      return `${start}~${end}\t${r.content.trim()}`
    })
  return [header, ...lines].join('\n')
}

export function sortReportRowsChronologically(rows: DailyReportRow[]): DailyReportRow[] {
  return [...rows].sort((a, b) => {
    const startDiff = parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
    if (startDiff !== 0) return startDiff
    return parseTimeToMinutes(a.endTime) - parseTimeToMinutes(b.endTime)
  })
}

export function isTimelineOrderChronological(rows: DailyReportRow[]): boolean {
  for (let i = 0; i < rows.length - 1; i++) {
    const curStart = parseTimeToMinutes(rows[i].startTime)
    const nextStart = parseTimeToMinutes(rows[i + 1].startTime)
    if (curStart > nextStart) {
      return false
    }
  }
  return true
}

/**
 * Reorders a row from `fromIndex` to `toIndex`, enforcing chronological time order:
 * A task with a later start time cannot be placed before a task with an earlier start time.
 */
export function reorderTimelineRowsWithConstraint(
  rows: DailyReportRow[],
  fromIndex: number,
  toIndex: number
): { valid: boolean; rows: DailyReportRow[] } {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= rows.length ||
    toIndex >= rows.length
  ) {
    return { valid: true, rows }
  }

  const candidate = [...rows]
  const [moved] = candidate.splice(fromIndex, 1)
  candidate.splice(toIndex, 0, moved)

  if (!isTimelineOrderChronological(candidate)) {
    return { valid: false, rows }
  }

  return { valid: true, rows: candidate }
}

interface MinuteSpan {
  startMin: number
  endMin: number
  content: string
}

function subtractInterval(spans: MinuteSpan[], cutStart: number, cutEnd: number): MinuteSpan[] {
  if (cutEnd <= cutStart) return spans
  const result: MinuteSpan[] = []
  for (const s of spans) {
    if (s.endMin <= cutStart || s.startMin >= cutEnd) {
      result.push(s)
    } else {
      if (s.startMin < cutStart) {
        result.push({ startMin: s.startMin, endMin: cutStart, content: s.content })
      }
      if (s.endMin > cutEnd) {
        result.push({ startMin: cutEnd, endMin: s.endMin, content: s.content })
      }
    }
  }
  return result
}

export interface SynthesizeOptions {
  dateStr: string
  shiftStart: string
  shiftEnd: string
  lunchStart: string
  lunchEnd: string
  hideLunch: boolean
  mergeMicroBreaksMinutes: number
  sessions: SessionRecord[]
  tasks: TaskRecord[]
  defaultWorkLabel: string
  meetingLabel: string
  tagLabels?: Partial<Record<IdleTag, string>>
  nowMs?: number
}

function formatTaggedIdleReason(
  session: SessionRecord,
  meetingLabel: string,
  tagLabels?: Partial<Record<IdleTag, string>>
): string | null {
  const customNote = session.note?.trim() || ''
  // Ignore auto-generated system notes when untagged
  const isSystemAutoNote =
    customNote === 'Screen locked' ||
    customNote === 'System sleep' ||
    customNote === 'System sleep / shutdown gap recovered'

  const userNote = isSystemAutoNote ? '' : customNote

  if (session.tag === 'meeting') {
    return userNote ? `${meetingLabel}: ${userNote}` : meetingLabel
  }

  // Only include non-meeting idle sessions on the Timeline if the user explicitly typed a note
  // or submitted a tag on an auto_idle Return Modal / custom note
  if (userNote) {
    if (session.tag && tagLabels?.[session.tag] && userNote !== tagLabels[session.tag]) {
      return `${tagLabels[session.tag]}: ${userNote}`
    }
    return userNote
  }

  if (session.type === 'auto_idle' && session.tag && tagLabels?.[session.tag]) {
    return tagLabels[session.tag]!
  }

  return null
}

export function synthesizeDailyReportRows(opts: SynthesizeOptions): DailyReportRow[] {
  const dayStartMs = getDayStartMs(opts.dateStr)
  const shiftStartMin = parseTimeToMinutes(opts.shiftStart)
  const shiftEndMin = parseTimeToMinutes(opts.shiftEnd)
  const lunchStartMin = parseTimeToMinutes(opts.lunchStart)
  const lunchEndMin = parseTimeToMinutes(opts.lunchEnd)

  const nowMs = opts.nowMs ?? Date.now()
  const todayStartMs = new Date(nowMs)
  todayStartMs.setHours(0, 0, 0, 0)
  const isToday = todayStartMs.getTime() === dayStartMs

  const currentDayMin = isToday
    ? Math.min(shiftEndMin, Math.max(shiftStartMin, epochToDayMinutes(nowMs, dayStartMs)))
    : shiftEndMin

  const effectiveEndMin = Math.max(shiftStartMin, currentDayMin || shiftEndMin)

  const slots: (string | null)[] = new Array(24 * 60).fill(null)

  // Step 1: Mark active sessions
  for (const s of opts.sessions) {
    const sStart = Math.max(shiftStartMin, epochToDayMinutes(s.startTime, dayStartMs))
    const rawEndMs = s.endTime ?? nowMs
    const sEnd = Math.min(effectiveEndMin, epochToDayMinutes(rawEndMs, dayStartMs))
    if (sEnd <= sStart) continue

    if (s.type === 'active') {
      for (let m = sStart; m < sEnd; m++) {
        slots[m] = opts.defaultWorkLabel
      }
    }
  }

  // Step 2: Overlay named tasks
  for (const t of opts.tasks) {
    const tStart = Math.max(shiftStartMin, epochToDayMinutes(t.startTime, dayStartMs))
    const rawEndMs = t.endTime ?? nowMs
    const tEnd = Math.min(effectiveEndMin, epochToDayMinutes(rawEndMs, dayStartMs))
    if (tEnd <= tStart) continue
    const title = t.title.trim() || opts.defaultWorkLabel
    for (let m = tStart; m < tEnd; m++) {
      slots[m] = title
    }
  }

  // Step 3: Apply idle breaks & user-submitted idle reasons (from Return Modal / Meetings)
  for (const s of opts.sessions) {
    if (s.type === 'active') continue
    const rawEndMs = s.endTime ?? nowMs
    const durMin = (rawEndMs - s.startTime) / 60000
    const sStart = Math.max(shiftStartMin, epochToDayMinutes(s.startTime, dayStartMs))
    const sEnd = Math.min(effectiveEndMin, epochToDayMinutes(rawEndMs, dayStartMs))
    if (sEnd <= sStart) continue

    const explicitReason =
      s.type !== 'system_offline' && opts.tagLabels
        ? formatTaggedIdleReason(s, opts.meetingLabel, opts.tagLabels)
        : s.tag === 'meeting'
          ? formatTaggedIdleReason(s, opts.meetingLabel)
          : null

    if (explicitReason) {
      for (let m = sStart; m < sEnd; m++) {
        slots[m] = explicitReason
      }
    } else if (durMin >= opts.mergeMicroBreaksMinutes) {
      for (let m = sStart; m < sEnd; m++) {
        slots[m] = null
      }
    } else {
      const prevLabel = sStart > shiftStartMin ? slots[sStart - 1] : null
      if (prevLabel) {
        for (let m = sStart; m < sEnd; m++) {
          if (!slots[m]) slots[m] = prevLabel
        }
      }
    }
  }

  // Step 4: Compress contiguous minute slots into spans
  let spans: MinuteSpan[] = []
  let curStart = -1
  let curLabel: string | null = null

  for (let m = shiftStartMin; m <= effectiveEndMin; m++) {
    const label = m < effectiveEndMin ? slots[m] : null
    if (label !== curLabel) {
      if (curLabel !== null && curStart >= 0 && m > curStart) {
        spans.push({ startMin: curStart, endMin: m, content: curLabel })
      }
      curStart = m
      curLabel = label
    }
  }

  // Step 5: Bridge remaining tiny gaps (< mergeMicroBreaksMinutes) between identical work labels
  if (opts.mergeMicroBreaksMinutes > 0 && spans.length > 1) {
    const merged: MinuteSpan[] = [spans[0]]
    for (let i = 1; i < spans.length; i++) {
      const prev = merged[merged.length - 1]
      const curr = spans[i]
      const gap = curr.startMin - prev.endMin
      const crossesLunch =
        opts.hideLunch && prev.endMin <= lunchStartMin && curr.startMin >= lunchEndMin
      if (
        !crossesLunch &&
        gap > 0 &&
        gap < opts.mergeMicroBreaksMinutes &&
        prev.content === curr.content
      ) {
        prev.endMin = curr.endMin
      } else {
        merged.push({ ...curr })
      }
    }
    spans = merged
  }

  // Step 6: Apply Hide Lunch Break (e.g., 12:00 - 13:00)
  if (opts.hideLunch && lunchEndMin > lunchStartMin) {
    spans = subtractInterval(spans, lunchStartMin, lunchEndMin)
  }

  if (spans.length === 0 && shiftEndMin > shiftStartMin) {
    if (opts.hideLunch && lunchStartMin > shiftStartMin && lunchEndMin < shiftEndMin) {
      spans = [
        { startMin: shiftStartMin, endMin: lunchStartMin, content: opts.defaultWorkLabel },
        { startMin: lunchEndMin, endMin: shiftEndMin, content: opts.defaultWorkLabel }
      ]
    } else {
      spans = [{ startMin: shiftStartMin, endMin: shiftEndMin, content: opts.defaultWorkLabel }]
    }
  }

  return spans
    .filter((s) => s.endMin > s.startMin)
    .map((s, idx) => ({
      id: `row-${opts.dateStr}-${idx}-${s.startMin}`,
      startTime: minutesToReportTime(s.startMin),
      endTime: minutesToReportTime(s.endMin),
      content: s.content
    }))
}
