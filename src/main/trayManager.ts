import { app, Menu, nativeImage, Tray } from 'electron'
import { AppSettings, LanguageCode, LiveTrackingState } from '../shared/types'
import { translateMain } from '../shared/i18nResources'

export interface TrayActions {
  onOpenMain: () => void
  onOpenDailyReport: () => void
  onToggleWidget: () => void
  onManualIdle: (tag: 'eating' | 'meeting' | 'rest') => void
  onResumeWork: () => void
  onChangeLanguage: (lang: LanguageCode) => void
  onQuit: () => void
}

/**
 * Generates a clean 16x16 RGBA circle icon dynamically so System Tray never breaks
 * across Windows, macOS, or Linux environments.
 */
function createStatusTrayIcon(status: 'active' | 'idle' | 'pomodoro'): Electron.NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  // BGRA on little-endian / RGBA buffer for createFromBitmap
  const colors = {
    active: { r: 16, g: 185, b: 129 }, // Emerald/Teal
    idle: { r: 245, g: 158, b: 11 }, // Amber
    pomodoro: { r: 244, g: 63, b: 94 } // Coral/Rose
  }[status]

  const center = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x - center, y - center)
      const idx = (y * size + x) * 4
      if (dist <= 6.2) {
        // Inner ring / pulse dot
        const isInner = dist <= 2.4
        buf[idx] = isInner ? 255 : colors.b
        buf[idx + 1] = isInner ? 255 : colors.g
        buf[idx + 2] = isInner ? 255 : colors.r
        buf[idx + 3] = 255
      } else if (dist <= 7.2) {
        // Anti-aliased edge
        buf[idx] = colors.b
        buf[idx + 1] = colors.g
        buf[idx + 2] = colors.r
        buf[idx + 3] = 110
      } else {
        buf[idx + 3] = 0
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

export class TrayManager {
  private tray: Tray | null = null
  private lastLang: LanguageCode | null = null
  private lastStatusKey = ''

  constructor(private actions: TrayActions) {}

  public init(settings: AppSettings, state: LiveTrackingState): void {
    try {
      const icon = createStatusTrayIcon('active')
      this.tray = new Tray(icon)
      this.tray.setToolTip('IdlePulse')
      this.tray.on('double-click', () => this.actions.onOpenMain())
      this.refresh(settings, state, true)
    } catch {
      // Headless environment without status-notifier tray daemon: safely ignore
      this.tray = null
    }
  }

  public refresh(settings: AppSettings, state: LiveTrackingState, force = false): void {
    if (!this.tray) return
    const visualStatus: 'active' | 'idle' | 'pomodoro' = state.pomodoro.running
      ? 'pomodoro'
      : state.status === 'active'
        ? 'active'
        : 'idle'

    const statusKey = `${settings.language}-${state.status}-${visualStatus}-${settings.stickyWidget.visible}`
    const lang = settings.language

    // Update tooltip live with elapsed timer
    const mins = Math.floor(state.currentSessionElapsedSec / 60)
    const statusLabel = translateMain(lang, `status.${state.status}`)
    this.tray.setToolTip(`IdlePulse — ${statusLabel} (${mins}m)`)

    if (!force && statusKey === this.lastStatusKey && lang === this.lastLang) {
      return
    }
    this.lastStatusKey = statusKey
    this.lastLang = lang

    this.tray.setImage(createStatusTrayIcon(visualStatus))

    const menu = Menu.buildFromTemplate([
      {
        label: `IdlePulse • ${statusLabel}`,
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
        label: translateMain(lang, 'tray.openReport'),
        click: () => this.actions.onOpenDailyReport()
      },
      { type: 'separator' },
      ...(state.status !== 'active'
        ? [
            {
              label: translateMain(lang, 'tray.resumeWork'),
              click: () => this.actions.onResumeWork()
            },
            { type: 'separator' as const }
          ]
        : []),
      {
        label: translateMain(lang, 'tray.manualLunch'),
        click: () => this.actions.onManualIdle('eating')
      },
      {
        label: translateMain(lang, 'tray.manualMeeting'),
        click: () => this.actions.onManualIdle('meeting')
      },
      {
        label: translateMain(lang, 'tray.manualBreak'),
        click: () => this.actions.onManualIdle('rest')
      },
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
