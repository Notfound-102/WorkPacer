import { app, Menu, nativeImage, Tray } from 'electron'
import {
  AppSettings,
  LanguageCode,
  LiveTrackingState,
  QuickIdlePreset
} from '../shared/types'
import { translateMain } from '../shared/i18nResources'

export type TrayVisualStatus = 'active' | 'idle' | 'pomodoro' | 'paused'

export interface TrayActions {
  onOpenMain: () => void
  onOpenDailyReport: () => void
  onToggleWidget: () => void
  onTogglePomodoroWidget: () => void
  onTriggerPreset: (presetId: string) => void
  onTogglePause: () => void
  onResumeWork: () => void
  onChangeLanguage: (lang: LanguageCode) => void
  onQuit: () => void
}

function clamp(v: number, lo = 0, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

function sdSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const pax = px - ax
  const pay = py - ay
  const bax = bx - ax
  const bay = by - ay
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay))
  return Math.hypot(pax - bax * h, pay - bay * h)
}

function renderTrayBitmapBGRA(size: number, status: TrayVisualStatus): Buffer {
  const buf = Buffer.alloc(size * size * 4)
  const badgeColors: Record<TrayVisualStatus, { r: number; g: number; b: number }> = {
    active: { r: 16, g: 185, b: 129 },
    idle: { r: 245, g: 158, b: 11 },
    pomodoro: { r: 244, g: 63, b: 94 },
    paused: { r: 148, g: 163, b: 184 }
  }
  const accent = badgeColors[status]
  const aa = 2.2 / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1
      const ny = ((y + 0.5) / size) * 2 - 1

      let outR = 0
      let outG = 0
      let outB = 0
      let outA = 0

      const blend = (r: number, g: number, b: number, a: number): void => {
        const sa = clamp(a)
        if (sa <= 0) return
        const na = sa + outA * (1 - sa)
        if (na <= 0) return
        outR = (r * sa + outR * outA * (1 - sa)) / na
        outG = (g * sa + outG * outA * (1 - sa)) / na
        outB = (b * sa + outB * outA * (1 - sa)) / na
        outA = na
      }

      const distCenter = Math.hypot(nx + 0.06, ny + 0.06)
      const dialOuter = 0.82
      const dDial = distCenter - dialOuter
      const dialAlpha = 1 - smoothstep(-aa, aa, dDial)
      if (dialAlpha > 0) {
        blend(18, 28, 46, dialAlpha * 0.94)
      }

      const dRing = Math.abs(distCenter - 0.68) - 0.105
      const ringAlpha = 1 - smoothstep(-aa, aa, dRing)
      if (ringAlpha > 0) {
        blend(248, 250, 252, ringAlpha * 0.95)
      }

      const dHand1 = sdSegment(nx, ny, -0.06, -0.06, 0.3, -0.34) - 0.115
      const dHand2 = sdSegment(nx, ny, -0.06, -0.06, -0.28, -0.2) - 0.1
      const handAlpha = Math.max(
        1 - smoothstep(-aa, aa, dHand1),
        1 - smoothstep(-aa, aa, dHand2)
      )
      if (handAlpha > 0) {
        blend(255, 255, 255, handAlpha)
      }

      const dotDist = Math.hypot(nx - 0.48, ny - 0.48)
      const haloAlpha = 1 - smoothstep(-aa, aa, dotDist - 0.46)
      if (haloAlpha > 0) {
        blend(15, 23, 42, haloAlpha * 0.96)
      }
      const dotAlpha = 1 - smoothstep(-aa, aa, dotDist - 0.35)
      if (dotAlpha > 0) {
        blend(accent.r, accent.g, accent.b, dotAlpha)
      }

      const idx = (y * size + x) * 4
      buf[idx] = Math.round(clamp(outB, 0, 255))
      buf[idx + 1] = Math.round(clamp(outG, 0, 255))
      buf[idx + 2] = Math.round(clamp(outR, 0, 255))
      buf[idx + 3] = Math.round(clamp(outA * 255, 0, 255))
    }
  }
  return buf
}

function createWorkPacerTrayIcon(status: TrayVisualStatus): Electron.NativeImage {
  const img = nativeImage.createEmpty()
  img.addRepresentation({
    scaleFactor: 1.0,
    width: 16,
    height: 16,
    buffer: renderTrayBitmapBGRA(16, status)
  })
  img.addRepresentation({
    scaleFactor: 2.0,
    width: 32,
    height: 32,
    buffer: renderTrayBitmapBGRA(32, status)
  })
  return img
}

export class TrayManager {
  private tray: Tray | null = null
  private lastMenuSignature = ''
  private lastVisualStatus: TrayVisualStatus | null = null

  constructor(private actions: TrayActions) {}

  public init(
    settings: AppSettings,
    state: LiveTrackingState,
    presets: QuickIdlePreset[]
  ): void {
    try {
      const icon = createWorkPacerTrayIcon('active')
      this.tray = new Tray(icon)
      this.tray.setToolTip('WorkPacer')
      this.tray.on('double-click', () => this.actions.onOpenMain())
      this.refresh(settings, state, presets, true)
    } catch {
      this.tray = null
    }
  }

  public refresh(
    settings: AppSettings,
    state: LiveTrackingState,
    presets: QuickIdlePreset[],
    force = false
  ): void {
    if (!this.tray) return

    const visualStatus: TrayVisualStatus =
      state.status === 'paused'
        ? 'paused'
        : state.pomodoro.running
          ? 'pomodoro'
          : state.status === 'active'
            ? 'active'
            : 'idle'

    const lang = settings.language
    const mins = Math.floor(state.currentSessionElapsedSec / 60)
    const statusLabel = translateMain(lang, `status.${state.status}`)
    this.tray.setToolTip(`WorkPacer — ${statusLabel} (${mins}m)`)

    if (this.lastVisualStatus !== visualStatus) {
      this.lastVisualStatus = visualStatus
      this.tray.setImage(createWorkPacerTrayIcon(visualStatus))
    }

    const presetSig = presets.map((p) => `${p.id}:${p.label}:${p.usageCount}`).join('|')
    const menuSignature = `${lang}-${state.status}-${visualStatus}-${settings.stickyWidget.visible}-${settings.pomodoroWidget.visible}-${presetSig}`
    if (!force && menuSignature === this.lastMenuSignature) {
      return
    }
    this.lastMenuSignature = menuSignature

    const presetMenuItems: Electron.MenuItemConstructorOptions[] = presets.map((p) => ({
      label: `${p.label}${p.usageCount > 0 ? ` (${p.usageCount})` : ''}`,
      click: () => this.actions.onTriggerPreset(p.id)
    }))

    const menu = Menu.buildFromTemplate([
      {
        label: `WorkPacer • ${statusLabel}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: translateMain(lang, 'tray.openApp'),
        click: () => this.actions.onOpenMain()
      },
      {
        label: translateMain(lang, 'tray.toggleWidget'),
        type: 'checkbox',
        checked: settings.stickyWidget.visible,
        click: () => this.actions.onToggleWidget()
      },
      {
        label: translateMain(lang, 'tray.togglePomodoroWidget'),
        type: 'checkbox',
        checked: settings.pomodoroWidget.visible,
        click: () => this.actions.onTogglePomodoroWidget()
      },
      {
        label: translateMain(lang, 'tray.openReport'),
        click: () => this.actions.onOpenDailyReport()
      },
      { type: 'separator' },
      ...(state.status !== 'active'
        ? [
            {
              label: translateMain(lang, 'tray.resumeWork'),
              click: () => this.actions.onResumeWork()
            }
          ]
        : [
            {
              label: translateMain(lang, 'tray.pauseTracking'),
              click: () => this.actions.onTogglePause()
            }
          ]),
      ...(presetMenuItems.length > 0
        ? [{ type: 'separator' as const }, ...presetMenuItems]
        : []),
      { type: 'separator' },
      {
        label: translateMain(lang, 'tray.languageMenu'),
        submenu: [
          {
            label: 'Tiếng Việt (VI)',
            type: 'radio',
            checked: lang === 'vi',
            click: () => this.actions.onChangeLanguage('vi')
          },
          {
            label: 'English (EN)',
            type: 'radio',
            checked: lang === 'en',
            click: () => this.actions.onChangeLanguage('en')
          },
          {
            label: '日本語 (JA)',
            type: 'radio',
            checked: lang === 'ja',
            click: () => this.actions.onChangeLanguage('ja')
          }
        ]
      },
      { type: 'separator' },
      {
        label: translateMain(lang, 'tray.quit'),
        click: () => {
          this.actions.onQuit()
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(menu)
  }

  public destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
