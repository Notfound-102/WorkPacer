import { mkdtempSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { IdlePulseDatabase } from '../src/main/database'
import { migrateLegacyDatabaseIfNeeded } from '../src/main/dataMigration'
import { IdleTrackingEngine } from '../src/main/idleTracker'
import { MAX_QUICK_IDLE_PRESETS } from '../src/shared/types'

describe('Quick Idle Presets (Max 6 Limit & Automatic Usage Frequency Sorting)', () => {
  it('enforces the maximum limit of 6 Quick Idle Presets and supports edit & delete', () => {
    const db = new IdlePulseDatabase(':memory:')

    // Initially seeded with 3 defaults (Lunch, Meeting, Short Break)
    const initial = db.getQuickIdlePresets()
    expect(initial).toHaveLength(3)

    // Add 3 more presets to reach the maximum of 6
    db.createQuickIdlePreset({ label: 'Đi pha cà phê', icon: 'coffee', tag: 'rest' }, 1001)
    db.createQuickIdlePreset({ label: 'Tập giãn cơ', icon: 'dumbbell', tag: 'rest' }, 1002)
    const sixPresets = db.createQuickIdlePreset(
      { label: 'Nghe điện thoại', icon: 'phone', tag: 'other' },
      1003
    )
    expect(sixPresets).toHaveLength(MAX_QUICK_IDLE_PRESETS)

    // Attempting to add a 7th preset MUST fail
    expect(() =>
      db.createQuickIdlePreset({ label: 'Nút thứ 7 vượt giới hạn', icon: 'moon', tag: 'sleep' })
    ).toThrow(/MAX_QUICK_IDLE_PRESETS_EXCEEDED/)

    // Edit preset label & icon
    const targetId = sixPresets[0].id
    const afterEdit = db.updateQuickIdlePreset(targetId, {
      label: 'Ăn trưa cùng team',
      icon: 'utensils'
    })
    expect(afterEdit.find((p) => p.id === targetId)?.label).toBe('Ăn trưa cùng team')

    // Delete 1 preset -> count drops to 5 -> adding 1 new preset succeeds again!
    const afterDelete = db.deleteQuickIdlePreset(targetId)
    expect(afterDelete).toHaveLength(5)

    const backToSix = db.createQuickIdlePreset({
      label: 'Đọc tài liệu',
      icon: 'book',
      tag: 'other'
    })
    expect(backToSix).toHaveLength(6)

    db.close()
  })

  it('automatically sorts Quick Idle Presets by usage_count DESC, last_used_at DESC when triggered', () => {
    const db = new IdlePulseDatabase(':memory:')
    let virtualNow = 1_700_000_000_000

    const tracker = new IdleTrackingEngine({
      db,
      getSystemIdleTime: () => 0,
      detectSmartException: async () => 'none',
      now: () => virtualNow
    })

    const [pLunch, pMeeting, pBreak] = db.getQuickIdlePresets()

    // Use Short Break 3 times
    virtualNow += 1000
    tracker.triggerQuickIdlePreset(pBreak.id)
    virtualNow += 1000
    tracker.triggerQuickIdlePreset(pBreak.id)
    virtualNow += 1000
    tracker.triggerQuickIdlePreset(pBreak.id)

    // Use Meeting 2 times (earlier)
    virtualNow += 1000
    tracker.triggerQuickIdlePreset(pMeeting.id)
    virtualNow += 1000
    tracker.triggerQuickIdlePreset(pMeeting.id)

    // Use Lunch 2 times (more recent than Meeting -> wins tie-breaker via last_used_at DESC!)
    virtualNow += 5000
    tracker.triggerQuickIdlePreset(pLunch.id)
    virtualNow += 1000
    const sorted = tracker.triggerQuickIdlePreset(pLunch.id)

    expect(sorted.map((p) => p.id)).toEqual([pBreak.id, pLunch.id, pMeeting.id])
    expect(sorted[0].usageCount).toBe(3)
    expect(sorted[1].usageCount).toBe(2)
    expect(sorted[2].usageCount).toBe(2)
    expect(sorted[1].lastUsedAt).toBeGreaterThan(sorted[2].lastUsedAt)

    // Also verify Paused state toggle
    tracker.togglePauseTracking()
    expect(tracker.getLiveState().status).toBe('paused')
    tracker.togglePauseTracking()
    expect(tracker.getLiveState().status).toBe('active')

    tracker.stop()
    db.close()
  })

  it('migrates legacy IdlePulse SQLite database (+ WAL) intact to WorkPacer userData', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workpacer-mig-'))
    try {
      const legacyDir = join(tempRoot, 'IdlePulse')
      const newDir = join(tempRoot, 'WorkPacer')
      mkdirSync(legacyDir, { recursive: true })

      const legacyDbPath = join(legacyDir, 'idlepulse.sqlite')
      const legacyDb = new IdlePulseDatabase(legacyDbPath)
      legacyDb.updateSettings({ userName: 'Legacy User', dailyGoalMinutes: 300 })
      legacyDb.startTask('Dữ liệu lịch sử từ IdlePulse', Date.now())
      legacyDb.close()

      const mig = migrateLegacyDatabaseIfNeeded({
        appDataDir: tempRoot,
        newUserDataDir: newDir
      })

      expect(mig.migratedFrom).toBe(legacyDbPath)
      const migratedDb = new IdlePulseDatabase(mig.dbPath)
      expect(migratedDb.getSettings().userName).toBe('Legacy User')
      expect(migratedDb.getSettings().dailyGoalMinutes).toBe(300)
      expect(migratedDb.getActiveTask()?.title).toBe('Dữ liệu lịch sử từ IdlePulse')
      expect(migratedDb.getQuickIdlePresets()).toHaveLength(3)
      migratedDb.close()
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})
