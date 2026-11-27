import { WorkPacerAPI } from '../shared/types'

declare global {
  interface Window {
    workPacer?: WorkPacerAPI
    idlePulse?: WorkPacerAPI
  }
}
