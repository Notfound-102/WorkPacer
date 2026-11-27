import { IdlePulseAPI } from '@shared/types'
import { createMockBridge } from './mockBridge'

export const isElectronEnv = typeof window !== 'undefined' && Boolean(window.idlePulse)

const fallback = isElectronEnv ? null : createMockBridge()

export const bridge: IdlePulseAPI = isElectronEnv ? window.idlePulse! : fallback!

export function simulateBrowserReturnPopup(minutesAway = 12): void {
  fallback?.simulateReturnPopup(minutesAway)
}
