import { describe, expect, it } from 'vitest'
import { checkForGitHubUpdates, compareSemver } from '../src/main/updateChecker'
import { IdlePulseDatabase } from '../src/main/database'
import { IdleTrackingEngine } from '../src/main/idleTracker'

describe('GitHub Releases Update Checker & Return Modal Note-Only Persistence', () => {
  it('compares semantic versions accurately (with or without v prefix & prereleases)', () => {
    expect(compareSemver('v1.3.0', '1.2.0')).toBe(1)
    expect(compareSemver('1.2.1', 'v1.2.0')).toBe(1)
    expect(compareSemver('v1.2.0', '1.2.0')).toBe(0)
    expect(compareSemver('v1.1.9', '1.2.0')).toBe(-1)
    expect(compareSemver('1.2.0', '1.2.0-beta.1')).toBe(1)
  })

  it('detects newer GitHub release and handles 404 gracefully when no release exists yet', async () => {
    const mockNewReleaseFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        tag_name: 'v1.3.0',
        name: 'WorkPacer v1.3.0',
        html_url: 'https://github.com/Notfound-102/WorkPacer/releases/tag/v1.3.0',
        body: 'Added new productivity widgets'
      })
    })) as unknown as typeof fetch

    const resUpdate = await checkForGitHubUpdates('1.2.0', mockNewReleaseFetch)
    expect(resUpdate.hasUpdate).toBe(true)
    expect(resUpdate.latestVersion).toBe('v1.3.0')
    expect(resUpdate.releaseUrl).toBe(
      'https://github.com/Notfound-102/WorkPacer/releases/tag/v1.3.0'
    )

    const mock404Fetch = (async () => ({
      ok: false,
      status: 404,
      json: async () => ({})
    })) as unknown as typeof fetch

    const res404 = await checkForGitHubUpdates('1.2.0', mock404Fetch)
    expect(res404.hasUpdate).toBe(false)
    expect(res404.error).toBeUndefined()
  })

  it('persists Return Idle Modal submission even when user only types a note or sessionId falls back to 0', async () => {
    const db = new IdlePulseDatabase(':memory:')
    let nowMs = new Date(2026, 10, 27, 10, 0, 0).getTime()
    let osIdle = 0

    const tracker = new IdleTrackingEngine({
      db,
      getSystemIdleTime: () => osIdle,
      detectSmartException: async () => 'none',
      now: () => nowMs
    })

    // Leave desk for 6 minutes
    nowMs += 6 * 60 * 1000
    osIdle = 360
    await tracker.tick()

    // Return to desk
    osIdle = 0
    await tracker.tick()
    expect(tracker.getLiveState().pendingReturnPopup).not.toBeNull()

    // User types custom reason without clicking a tag (tag = null) and with sessionId = 0 fallback
    const saved = tracker.submitReturnTag(0, null, 'Đi nhận bưu phẩm')
    expect(saved).not.toBeNull()
    expect(saved?.tag).toBe('other')
    expect(saved?.note).toBe('Đi nhận bưu phẩm')

    tracker.stop()
    db.close()
  })
})
