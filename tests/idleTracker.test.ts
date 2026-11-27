import { describe, expect, it } from 'vitest'
import { IdlePulseDatabase } from '../src/main/database'
import { IdleTrackingEngine } from '../src/main/idleTracker'
import { SmartExceptionReason } from '../src/shared/types'

describe('IdleTrackingEngine (Core Tracking, Smart Exceptions, Return UX & Health)', () => {
  it('backdates Auto Idle start when OS idle exceeds threshold and triggers Return Quick Tag Popup after >= 5m idle', async () => {
    const db = new IdlePulseDatabase(':memory:')
    let virtualNow = new Date(2026, 10, 26, 10, 0, 0).getTime()
    let osIdleSec = 0
    let smartReason: SmartExceptionReason = 'none'

    const tracker = new IdleTrackingEngine({
      db,
      getSystemIdleTime: () => osIdleSec,
      detectSmartException: async () => smartReason,
      now: () => virtualNow
    })

    // Work active for 10 minutes (10:00 -> 10:10)
    virtualNow += 10 * 60 * 1000
    osIdleSec = 0
    await tracker.tick()
    expect(tracker.getLiveState().status).toBe('active')

    // User stops touching mouse at 10:10; at 10:12 (osIdleSec = 120s == 2m default threshold)
    virtualNow += 2 * 60 * 1000
    osIdleSec = 120
    await tracker.tick()

    const idleState = tracker.getLiveState()
    expect(idleState.status).toBe('auto_idle')
    // Backdated to 10:10 -> elapsed idle is already 120s!
    expect(idleState.currentSessionElapsedSec).toBe(120)

    // User stays away until 10:17 (total 7 minutes away -> > 5m returnPopupMinMinutes)
    virtualNow += 5 * 60 * 1000
    osIdleSec = 420
    await tracker.tick()

    // User returns and moves mouse (osIdleSec = 0)
    osIdleSec = 0
    await tracker.tick()

    const returnedState = tracker.getLiveState()
    expect(returnedState.status).toBe('active')
    expect(returnedState.pendingReturnPopup).not.toBeNull()
    expect(returnedState.pendingReturnPopup?.durationSec).toBe(420)

    // Tag session from Return Popup
    tracker.submitReturnTag(returnedState.pendingReturnPopup!.sessionId, 'eating', 'Cà phê sáng')
    expect(tracker.getLiveState().pendingReturnPopup).toBeNull()

    const tagged = db.getSessionById(returnedState.pendingReturnPopup!.sessionId)
    expect(tagged?.tag).toBe('eating')
    expect(tagged?.breakCategory).toBe('short')

    tracker.stop()
    db.close()
  })

  it('respects Smart Exceptions (ignore mode keeps Active during fullscreen video or call)', async () => {
    const db = new IdlePulseDatabase(':memory:')
    db.updateSettings({ smartExceptionMode: 'ignore', idleThresholdMinutes: 2 })

    let virtualNow = new Date(2026, 10, 26, 14, 0, 0).getTime()
    let osIdleSec = 180
    const smartReason: SmartExceptionReason = 'call_active'

    const tracker = new IdleTrackingEngine({
      db,
      getSystemIdleTime: () => osIdleSec,
      detectSmartException: async () => smartReason,
      now: () => virtualNow
    })

    virtualNow += 3 * 60 * 1000
    await tracker.tick()

    // Despite 180s OS idle, call_active keeps status === 'active'!
    expect(tracker.getLiveState().status).toBe('active')
    expect(tracker.getLiveState().currentSmartException).toBe('call_active')

    osIdleSec = 0
    tracker.stop()
    db.close()
  })

  it('triggers 20-20-20 Eye Care 20s countdown after 20 minutes of active screen time', async () => {
    const db = new IdlePulseDatabase(':memory:')
    db.updateSettings({ eyeCareEnabled: true, eyeCareIntervalMinutes: 1 }) // 1 min for fast test

    let virtualNow = new Date(2026, 10, 26, 9, 0, 0).getTime()
    const tracker = new IdleTrackingEngine({
      db,
      getSystemIdleTime: () => 0,
      detectSmartException: async () => 'none',
      now: () => virtualNow
    })

    for (let i = 0; i < 60; i++) {
      virtualNow += 1000
      await tracker.tick()
    }

    const state = tracker.getLiveState()
    expect(state.activeBreakOverlay?.kind).toBe('eye_20_20_20')
    expect(state.activeBreakOverlay?.countdownSec).toBe(20)

    tracker.stop()
    db.close()
  })
})
