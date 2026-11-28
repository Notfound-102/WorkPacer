import { describe, expect, it } from 'vitest'
import {
  formatDailyReportPlainText,
  reorderTimelineRowsWithConstraint,
  sortReportRowsChronologically,
  synthesizeDailyReportRows
} from '../src/shared/reportFormatter'
import { DailyReportRow, SessionRecord, TaskRecord } from '../src/shared/types'

describe('Daily Report Synthesizer, Custom Header & Timeline Drag-and-Drop Constraints', () => {
  const dateStr = '2026-11-26'
  const dayStart = new Date(2026, 10, 26, 0, 0, 0, 0).getTime()
  const at = (h: number, m: number): number => dayStart + (h * 60 + m) * 60 * 1000

  it('formats customizable header (defaulting to Daily Report) and Tab-delimited H:mm~H:mm lines', () => {
    const defaultText = formatDailyReportPlainText('2026-11-26', 'Nguyen Van A', [
      { id: '1', startTime: '08:30', endTime: '09:30', content: 'Review PR & Standup' },
      { id: '2', startTime: '9:30', endTime: '12:00', content: 'Implement IdleTracker' },
      { id: '3', startTime: '13:00', endTime: '17:30', content: 'Build Daily Report UI' }
    ])

    const lines = defaultText.split('\n')
    expect(lines[0]).toBe('2026/11/26 (Nguyen Van A) Daily Report')
    expect(lines[1]).toBe('8:30~9:30\tReview PR & Standup')
    expect(lines[2]).toBe('9:30~12:00\tImplement IdleTracker')
    expect(lines[3]).toBe('13:00~17:30\tBuild Daily Report UI')

    const customText = formatDailyReportPlainText(
      '2026-11-26',
      'Nguyen Van A',
      [{ id: '1', startTime: '8:30', endTime: '9:30', content: 'Task A' }],
      'End of Shift Summary'
    )
    expect(customText.split('\n')[0]).toBe('2026/11/26 (Nguyen Van A) End of Shift Summary')
  })

  it('enforces chronological time order during Drag & Drop and auto-sorts newly added rows', () => {
    const rows: DailyReportRow[] = [
      { id: 'r1', startTime: '8:30', endTime: '9:30', content: 'Morning Standup' },
      { id: 'r2', startTime: '10:00', endTime: '12:00', content: 'API Development' },
      { id: 'r3', startTime: '14:00', endTime: '16:00', content: 'UI Polish' }
    ]

    // Attempt to drag 14:00 (index 2) above 10:00 (index 1) -> VIOLATION! Must reject & keep original
    const invalidUp = reorderTimelineRowsWithConstraint(rows, 2, 1)
    expect(invalidUp.valid).toBe(false)
    expect(invalidUp.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])

    // Attempt to drag 8:30 (index 0) below 10:00 (index 1) -> VIOLATION!
    const invalidDown = reorderTimelineRowsWithConstraint(rows, 0, 1)
    expect(invalidDown.valid).toBe(false)
    expect(invalidDown.rows.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])

    // User edits r3's time to 9:30 first, then drags r3 (index 2) to index 1 -> VALID!
    const editedRows: DailyReportRow[] = [
      rows[0],
      rows[1],
      { ...rows[2], startTime: '9:30', endTime: '10:00' }
    ]
    const validMove = reorderTimelineRowsWithConstraint(editedRows, 2, 1)
    expect(validMove.valid).toBe(true)
    expect(validMove.rows.map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])

    // Auto-sort when adding a new earlier row
    const autoSorted = sortReportRowsChronologically([
      ...rows,
      { id: 'r4', startTime: '9:35', endTime: '9:55', content: 'Quick Sync' }
    ])
    expect(autoSorted.map((r) => r.id)).toEqual(['r1', 'r4', 'r2', 'r3'])
  })

  it('includes Return Idle Modal submitted reasons on the synthesized timeline while hiding lunch and merging micro-breaks', () => {
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
      // 2-minute micro-break (< 5 min threshold -> merged!)
      {
        id: 2,
        type: 'auto_idle',
        startTime: at(9, 36),
        endTime: at(9, 38),
        durationSec: 120,
        breakCategory: 'micro',
        tag: null,
        note: '',
        smartException: 'none',
        isManual: false
      },
      {
        id: 3,
        type: 'active',
        startTime: at(9, 38),
        endTime: at(10, 6),
        durationSec: 28 * 60,
        breakCategory: 'none',
        tag: null,
        note: '',
        smartException: 'none',
        isManual: false
      },
      // 8-minute away session where user submitted reason in Return Modal!
      {
        id: 4,
        type: 'auto_idle',
        startTime: at(10, 6),
        endTime: at(10, 14),
        durationSec: 480,
        breakCategory: 'short',
        tag: 'out',
        note: 'Nhận tài liệu tầng 1',
        smartException: 'none',
        isManual: false
      },
      {
        id: 5,
        type: 'active',
        startTime: at(10, 14),
        endTime: at(14, 20),
        durationSec: 246 * 60,
        breakCategory: 'none',
        tag: null,
        note: '',
        smartException: 'none',
        isManual: false
      }
    ]

    const tasks: TaskRecord[] = [
      {
        id: 1,
        title: 'Thiết kế kiến trúc SQLite',
        startTime: at(8, 30),
        endTime: at(9, 30),
        durationSec: 3600,
        category: 'dev'
      },
      {
        id: 2,
        title: 'Xây dựng Core Tracking Engine',
        startTime: at(9, 30),
        endTime: at(10, 6),
        durationSec: 2160,
        category: 'dev'
      },
      {
        id: 3,
        title: 'Phát triển Sticky Widget & Dashboard',
        startTime: at(10, 14),
        endTime: at(14, 20),
        durationSec: 246 * 60,
        category: 'dev'
      }
    ]

    const rows = synthesizeDailyReportRows({
      dateStr,
      shiftStart: '08:30',
      shiftEnd: '17:30',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      hideLunch: true,
      mergeMicroBreaksMinutes: 5,
      sessions,
      tasks,
      defaultWorkLabel: 'Công việc chung',
      meetingLabel: 'Họp',
      tagLabels: { out: 'Ra ngoài', rest: 'Nghỉ ngơi', eating: 'Ăn uống', meeting: 'Họp', sleep: 'Ngủ', other: 'Khác' },
      nowMs: at(17, 30)
    })

    expect(rows.map((r) => `${r.startTime}~${r.endTime}\t${r.content}`)).toEqual([
      '8:30~9:30\tThiết kế kiến trúc SQLite',
      '9:30~10:06\tXây dựng Core Tracking Engine',
      '10:06~10:14\tRa ngoài: Nhận tài liệu tầng 1',
      '10:14~12:00\tPhát triển Sticky Widget & Dashboard',
      '13:00~14:20\tPhát triển Sticky Widget & Dashboard'
    ])
  })
})
