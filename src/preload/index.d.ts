import { IdlePulseAPI } from '../shared/types'

declare global {
  interface Window {
    idlePulse?: IdlePulseAPI
  }
}
