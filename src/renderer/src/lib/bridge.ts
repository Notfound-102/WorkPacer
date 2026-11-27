import { WorkPacerAPI } from '@shared/types'
import { createMockBridge } from './mockBridge'

const electronApi =
  typeof window !== 'undefined' ? (window.workPacer ?? window.idlePulse) : undefined

export const isElectronEnv = Boolean(electronApi)

const fallback = isElectronEnv ? null : createMockBridge()

export const bridge: WorkPacerAPI = isElectronEnv ? electronApi! : fallback!

export function simulateBrowserReturnPopup(minutesAway = 12): void {
  fallback?.simulateReturnPopup(minutesAway)
}
