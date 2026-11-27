import { DailyReportRow, SessionRecord, TaskRecord } from './types'

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

export function formatNippoDateHeader(dateStr: string, userName: string): string {
  const slashDate = dateStr.replace(/-/g, '/')
  const displayUser = userName.trim() || 'User'
  return `${slashDate} (${displayUser})日報`
}

/**
 * Formats Daily Report into exact plain-text Tab-delimited Nippo format:
 * YYYY/MM/DD (Tên người dùng)日報
 * 8:30~9:30\tlàm gì
 */
export function formatDailyReportPlainText(
  dateStr: string,
  userName: string,
  rows: DailyReportRow[]
): string {
  const header = formatNippoDateHeader(dateStr, userName)
  const lines = rows
    .filter((r) => r.startTime.trim() || r.endTime.trim() || r.content.trim())
    .map((r) => {
      const start = normalizeReportTime(r.startTime)
      const end = normalizeReportTime(r.endTime)
      return `${start}~${end}\t${r.content.trim()}`
    })
  return [header, ...lines].join('\n')
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
  nowMs?: number
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

  // Build minute-by-minute timeline array [0..1440) for unambiguous priority resolution:
  // Priority 1: Explicit non-meeting Idle >= mergeMicroBreaksMinutes => gap (null)
  // Priority 2: Named TaskRecord => task.title
  // Priority 3: Meeting tagged session => note || meetingLabel
  // Priority 4: Active session => defaultWorkLabel
  const slots: (string | null)[] = new Array(24 * 60).fill(null)

  // Step 1: Mark active & meeting sessions
  for (const s of opts.sessions) {
    const sStart = Math.max(shiftStartMin, epochToDayMinutes(s.startTime, dayStartMs))
    const rawEndMs = s.endTime ?? nowMs
    const sEnd = Math.min(effectiveEndMin, epochToDayMinutes(rawEndMs, dayStartMs))
    if (sEnd <= sStart) continue

    if (s.type === 'active') {
      for (let m = sStart; m < sEnd; m++) {
        slots[m] = opts.defaultWorkLabel
      }
    } else if (s.tag === 'meeting') {
      const label = s.note?.trim() ? `${opts.meetingLabel}: ${s.note.trim()}` : opts.meetingLabel
      for (let m = sStart; m < sEnd; m++) {
        slots[m] = label
      }
    }
  }

  // Step 2: Overlay named tasks (higher specificity than generic "Active")
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

  // Step 3: Carve out real idle breaks (>= mergeMicroBreaksMinutes), while absorbing micro-breaks (< X min)
  for (const s of opts.sessions) {
    if (s.type === 'active' || s.tag === 'meeting') continue
    const rawEndMs = s.endTime ?? nowMs
    const durMin = (rawEndMs - s.startTime) / 60000
    const sStart = Math.max(shiftStartMin, epochToDayMinutes(s.startTime, dayStartMs))
    const sEnd = Math.min(effectiveEndMin, epochToDayMinutes(rawEndMs, dayStartMs))
    if (sEnd <= sStart) continue

    if (durMin >= opts.mergeMicroBreaksMinutes) {
      for (let m = sStart; m < sEnd; m++) {
        slots[m] = null
      }
    } else {
      // Micro-break < threshold: bridge with neighboring work label if surrounded by work
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
      // Do not bridge across lunch if hideLunch is enabled
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

  // Fallback starter template if no activity exists in shift window yet
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
