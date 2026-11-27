import { describe, expect, it } from 'vitest'
import {
  formatDailyReportPlainText,
  synthesizeDailyReportRows
} from '../src/shared/reportFormatter'
import { SessionRecord, TaskRecord } from '../src/shared/types'

describe('Daily Report (日報) Synthesizer & Tab Formatter', () => {
  const dateStr = '2026-11-26'
  const dayStart = new Date(2026, 10, 26, 0, 0, 0, 0).getTime()
  const at = (h: number, m: number): number => dayStart + (h * 60 + m) * 60 * 1000

  it('formats exact Nippo header and Tab-delimited H:mm~H:mm lines', () => {
    const text = formatDailyReportPlainText('2026-11-26', 'Nguyen Van A', [
      { id: '1', startTime: '08:30', endTime: '09:30', content: 'Review PR & Standup' },
      { id: '2', startTime: '9:30', endTime: '12:00', content: 'Implement IdleTracker' },
      { id: '3', startTime: '13:00', endTime: '17:30', content: 'Build Daily Report UI' }
    ])

    const lines = text.split('\n')
    expect(lines[0]).toBe('2026/11/26 (Nguyen Van A)日報')
    expect(lines[1]).toBe('8:30~9:30\tReview PR & Standup')
    expect(lines[2]).toBe('9:30~12:00\tImplement IdleTracker')
    expect(lines[3]).toBe('13:00~17:30\tBuild Daily Report UI')
  })

  it('automatically hides lunch break (12:00-13:00) and merges micro-breaks < X min while preserving longer breaks', () => {
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
      // 8-minute short break (>= 5 min threshold -> kept as gap!)
      {
        id: 4,
        type: 'auto_idle',
        startTime: at(10, 6),
        endTime: at(10, 14),
        durationSec: 480,
        breakCategory: 'short',
        tag: 'rest',
        note: '',
        smartException: 'none',
        isManual: false
      },
      // Continuous active spanning across 12:00-13:00 lunch -> must split cleanly at 12:00 and 13:00!
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
      nowMs: at(17, 30)
    })

    expect(rows.map((r) => `${r.startTime}~${r.endTime}\t${r.content}`)).toEqual([
      '8:30~9:30\tThiết kế kiến trúc SQLite',
      '9:30~10:06\tXây dựng Core Tracking Engine',
      '10:14~12:00\tPhát triển Sticky Widget & Dashboard',
      '13:00~14:20\tPhát triển Sticky Widget & Dashboard'
    ])
  })
})
