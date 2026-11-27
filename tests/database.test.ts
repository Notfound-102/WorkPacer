import { describe, expect, it } from 'vitest'
import { IdlePulseDatabase } from '../src/main/database'

describe('IdlePulseDatabase (SQLite local repository)', () => {
  it('recovers shutdown/overnight gap using heartbeats and classifies break durations', () => {
    const db = new IdlePulseDatabase(':memory:')
    const t0 = new Date(2026, 10, 26, 9, 0, 0).getTime()
    const s1 = db.startSession({ type: 'active', startTime: t0 })

    // Heartbeat saved at 09:45
    const tHb = t0 + 45 * 60 * 1000
    db.recordHeartbeat(tHb, 'active', s1.id)

    // System restarts at 10:25 (40 min offline -> > 30 min 'long' break)
    const tWake = tHb + 40 * 60 * 1000
    const gapSession = db.recoverFromShutdownOrSleep(tWake, 120)

    expect(gapSession).not.toBeNull()
    expect(gapSession?.type).toBe('system_offline')
    expect(gapSession?.durationSec).toBe(40 * 60)
    expect(gapSession?.breakCategory).toBe('long')

    const closedActive = db.getSessionById(s1.id)
    expect(closedActive?.endTime).toBe(tHb)
    expect(closedActive?.durationSec).toBe(45 * 60)
    db.close()
  })

  it('computes analytics, active ratio, top idle hours, and exports CSV with UTF-8 BOM', () => {
    const db = new IdlePulseDatabase(':memory:')
    const base = new Date(2026, 10, 26, 0, 0, 0).getTime()
    const at = (h: number, m: number): number => base + (h * 60 + m) * 60 * 1000

    const sActive = db.startSession({ type: 'active', startTime: at(9, 0) })
    db.closeSession(sActive.id, at(11, 0)) // 120 min active

    const sMicro = db.startSession({ type: 'auto_idle', startTime: at(11, 0) })
    db.closeSession(sMicro.id, at(11, 3)) // 3 min micro

    const sShort = db.startSession({
      type: 'manual_idle',
      startTime: at(14, 0),
      tag: 'rest',
      isManual: true
    })
    db.closeSession(sShort.id, at(14, 25)) // 25 min short in 14:00-15:00 slot

    const t1 = db.startTask('Tối ưu hóa giao diện Tiếng Việt & 日本語', at(9, 0))
    db.stopActiveTask(at(11, 0))
    expect(t1.title).toContain('日本語')

    const analytics = db.getAnalytics('hour', '2026-11-26', at(15, 0))
    expect(analytics.todayActiveSec).toBe(120 * 60)
    expect(analytics.todayIdleSec).toBe(28 * 60)
    expect(analytics.breakBreakdown.microSec).toBe(3 * 60)
    expect(analytics.breakBreakdown.shortSec).toBe(25 * 60)
    expect(analytics.topIdleHours[0].hour).toBe(14)
    expect(analytics.topIdleHours[0].label).toBe('14:00–15:00')

    const csvExport = db.exportHistory('csv', '2026-11-26', '2026-11-26')
    expect(csvExport.content.startsWith('\uFEFF')).toBe(true)
    expect(csvExport.content).toContain('Tối ưu hóa giao diện Tiếng Việt & 日本語')
    expect(csvExport.rowCount).toBe(4)

    db.close()
  })
})
