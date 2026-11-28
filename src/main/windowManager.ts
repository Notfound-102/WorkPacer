import { existsSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow, nativeTheme, screen } from 'electron'
import { IdlePulseDatabase } from './database'
import {
  MainTabId,
  PomodoroWidgetPrefs,
  ResolvedTheme,
  StickyWidgetPrefs,
  ThemeMode
} from '../shared/types'

const LIGHT_BG = '#edf3fb'
const DARK_BG = '#080d1a'
const LIGHT_TITLEBAR = '#eef4fb'
const DARK_TITLEBAR = '#0b1222'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private widgetWindow: BrowserWindow | null = null
  private pomodoroWidgetWindow: BrowserWindow | null = null
  private returnPopupWindow: BrowserWindow | null = null
  private breakOverlayWindow: BrowserWindow | null = null
  private isQuitting = false

  private widgetBoundsTimer: NodeJS.Timeout | null = null
  private pomoBoundsTimer: NodeJS.Timeout | null = null
  private popupBoundsTimer: NodeJS.Timeout | null = null
  private widgetFadeTimer: NodeJS.Timeout | null = null
  private pomoFadeTimer: NodeJS.Timeout | null = null

  constructor(private db: IdlePulseDatabase) {}

  public setQuitting(val: boolean): void {
    this.isQuitting = val
  }

  public resolveTheme(mode?: ThemeMode): ResolvedTheme {
    const theme = mode ?? this.db.getSettings().theme
    if (theme === 'dark') return 'dark'
    if (theme === 'light') return 'light'
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  public syncNativeTheme(mode: ThemeMode): ResolvedTheme {
    if (nativeTheme.themeSource !== mode) {
      nativeTheme.themeSource = mode
    }
    const resolved = this.resolveTheme(mode)
    this.applyThemeToOpenWindows(resolved)
    return resolved
  }

  public applyThemeToOpenWindows(resolved: ResolvedTheme): void {
    const isDark = resolved === 'dark'
    const bg = isDark ? DARK_BG : LIGHT_BG

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setBackgroundColor(bg)
      if (
        process.platform !== 'darwin' &&
        typeof this.mainWindow.setTitleBarOverlay === 'function'
      ) {
        try {
          this.mainWindow.setTitleBarOverlay({
            color: isDark ? DARK_TITLEBAR : LIGHT_TITLEBAR,
            symbolColor: isDark ? '#f8fafc' : '#0f172a',
            height: 36
          })
        } catch {
          // Ignore on platforms where titleBarOverlay is unsupported
        }
      }
    }
  }

  private getPreloadPath(): string {
    return join(__dirname, '../preload/index.js')
  }

  private getWindowIconPath(): string | undefined {
    const candidates = [
      join(__dirname, '../../build/icon.ico'),
      join(__dirname, '../../build/icon.png'),
      join(__dirname, '../../resources/icon.png'),
      join(process.resourcesPath || '', 'build/icon.png'),
      join(process.resourcesPath || '', 'resources/icon.png')
    ]
    if (process.platform === 'win32') {
      return candidates.find((p) => existsSync(p))
    }
    return candidates.slice(1).find((p) => existsSync(p))
  }

  private loadRoute(win: BrowserWindow, hashRoute: string): void {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!app.isPackaged && devUrl) {
      void win.loadURL(`${devUrl}#/${hashRoute}`)
    } else {
      void win.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `/${hashRoute}`
      })
    }
  }

  private fadeInWindow(win: BrowserWindow, targetOpacity = 1, showInactive = false): void {
    if (win.isDestroyed()) return
    win.setOpacity(0)
    if (showInactive) {
      win.showInactive()
    } else {
      win.show()
    }
    const steps = 6
    let step = 0
    const interval = setInterval(() => {
      if (win.isDestroyed()) {
        clearInterval(interval)
        return
      }
      step++
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3)
      win.setOpacity(Math.min(targetOpacity, eased * targetOpacity))
      if (step >= steps) {
        clearInterval(interval)
        win.setOpacity(targetOpacity)
      }
    }, 26)
  }

  private fadeOutWindow(
    win: BrowserWindow,
    closeAfter: boolean,
    timerSlot: 'widget' | 'pomo' | 'none' = 'none'
  ): void {
    if (win.isDestroyed()) return
    if (timerSlot === 'widget' && this.widgetFadeTimer) {
      clearInterval(this.widgetFadeTimer)
      this.widgetFadeTimer = null
    }
    if (timerSlot === 'pomo' && this.pomoFadeTimer) {
      clearInterval(this.pomoFadeTimer)
      this.pomoFadeTimer = null
    }

    const startOpacity = win.getOpacity()
    const steps = 5
    let step = 0
    const timer = setInterval(() => {
      if (win.isDestroyed()) {
        clearInterval(timer)
        return
      }
      step++
      const next = Math.max(0, startOpacity * (1 - step / steps))
      win.setOpacity(next)
      if (step >= steps) {
        clearInterval(timer)
        if (timerSlot === 'widget') this.widgetFadeTimer = null
        if (timerSlot === 'pomo') this.pomoFadeTimer = null
        if (closeAfter) {
          win.close()
        } else {
          win.hide()
          win.setOpacity(1)
        }
      }
    }, 24)

    if (timerSlot === 'widget') this.widgetFadeTimer = timer
    if (timerSlot === 'pomo') this.pomoFadeTimer = timer
  }

  // --- 1. Main Application Window ---
  public createOrShowMainWindow(initialTab?: MainTabId): BrowserWindow {
    const settings = this.db.getSettings()
    const resolved = this.syncNativeTheme(settings.theme)
    const isDark = resolved === 'dark'

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore()
      this.applyThemeToOpenWindows(resolved)
      this.mainWindow.show()
      this.mainWindow.focus()
      if (initialTab) {
        this.mainWindow.webContents.send('nav:tab', initialTab)
      }
      return this.mainWindow
    }

    const isMac = process.platform === 'darwin'

    this.mainWindow = new BrowserWindow({
      width: 1220,
      height: 800,
      minWidth: 960,
      minHeight: 660,
      show: false,
      title: 'WorkPacer',
      icon: this.getWindowIconPath(),
      autoHideMenuBar: true,
      backgroundColor: isDark ? DARK_BG : LIGHT_BG,
      titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
      ...(isMac
        ? {}
        : {
            titleBarOverlay: {
              color: isDark ? DARK_TITLEBAR : LIGHT_TITLEBAR,
              symbolColor: isDark ? '#f8fafc' : '#0f172a',
              height: 36
            }
          }),
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    this.mainWindow.on('ready-to-show', () => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return
      this.mainWindow.show()
      if (initialTab) {
        this.mainWindow.webContents.send('nav:tab', initialTab)
      }
    })

    this.mainWindow.on('close', (e) => {
      if (!this.isQuitting) {
        e.preventDefault()
        this.mainWindow?.hide()
      }
    })

    this.loadRoute(this.mainWindow, 'main')
    return this.mainWindow
  }

  // --- 2. Floating Sticky Widget Window (Zero square corner artifacts on Windows!) ---
  public syncStickyWidgetWindow(prefs: StickyWidgetPrefs): void {
    if (!prefs.visible) {
      if (this.widgetWindow && !this.widgetWindow.isDestroyed() && this.widgetWindow.isVisible()) {
        this.fadeOutWindow(this.widgetWindow, false, 'widget')
      }
      return
    }

    const collapsedHeight = 72
    const savedWidth = Math.min(540, Math.max(296, prefs.width ?? 344))
    const savedHeight = Math.min(500, Math.max(264, prefs.height ?? 316))
    const targetHeight = prefs.collapsed ? collapsedHeight : savedHeight

    if (!this.widgetWindow || this.widgetWindow.isDestroyed()) {
      const display = screen.getPrimaryDisplay().workArea
      const safeX =
        prefs.x !== undefined &&
        prefs.x >= display.x - 100 &&
        prefs.x <= display.x + display.width - 80
          ? prefs.x
          : display.x + display.width - savedWidth - 20
      const safeY =
        prefs.y !== undefined &&
        prefs.y >= display.y &&
        prefs.y <= display.y + display.height - 48
          ? prefs.y
          : display.y + 40

      this.widgetWindow = new BrowserWindow({
        width: savedWidth,
        height: targetHeight,
        minWidth: 296,
        maxWidth: 540,
        minHeight: prefs.collapsed ? collapsedHeight : 264,
        maxHeight: prefs.collapsed ? collapsedHeight : 500,
        x: safeX,
        y: safeY,
        title: 'WorkPacer Widget',
        icon: this.getWindowIconPath(),
        frame: false,
        transparent: true,
        hasShadow: false,
        backgroundColor: '#00000000',
        resizable: !prefs.collapsed,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: prefs.alwaysOnTop,
        show: false,
        webPreferences: {
          preload: this.getPreloadPath(),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      })

      if (prefs.alwaysOnTop) {
        this.widgetWindow.setAlwaysOnTop(true, 'floating')
      }

      const persistWidgetBounds = (): void => {
        if (this.widgetBoundsTimer) clearTimeout(this.widgetBoundsTimer)
        this.widgetBoundsTimer = setTimeout(() => {
          if (!this.widgetWindow || this.widgetWindow.isDestroyed()) return
          const bounds = this.widgetWindow.getBounds()
          const cur = this.db.getSettings()
          this.db.updateSettings({
            stickyWidget: {
              ...cur.stickyWidget,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              ...(cur.stickyWidget.collapsed ? {} : { height: bounds.height })
            }
          })
        }, 140)
      }

      this.widgetWindow.on('moved', persistWidgetBounds)
      this.widgetWindow.on('resized', persistWidgetBounds)

      this.widgetWindow.once('ready-to-show', () => {
        if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
          this.fadeInWindow(this.widgetWindow, 1, true)
        }
      })

      this.loadRoute(this.widgetWindow, 'widget')
    } else {
      if (this.widgetFadeTimer) {
        clearInterval(this.widgetFadeTimer)
        this.widgetFadeTimer = null
      }
      this.widgetWindow.setAlwaysOnTop(
        prefs.alwaysOnTop,
        prefs.alwaysOnTop ? 'floating' : 'normal'
      )
      this.widgetWindow.setResizable(!prefs.collapsed)
      this.widgetWindow.setMinimumSize(296, prefs.collapsed ? collapsedHeight : 264)
      this.widgetWindow.setMaximumSize(540, prefs.collapsed ? collapsedHeight : 500)

      const [curW, curH] = this.widgetWindow.getSize()
      if (curH !== targetHeight) {
        this.widgetWindow.setSize(curW, targetHeight, true)
      }

      if (!this.widgetWindow.isVisible()) {
        this.fadeInWindow(this.widgetWindow, 1, true)
      } else {
        this.widgetWindow.setOpacity(1)
      }
    }
  }

  // --- 3. Floating Pomodoro Window (Always-on-Top, 3 Clock Styles, Zero Square Corners) ---
  public syncPomodoroWidgetWindow(prefs: PomodoroWidgetPrefs): void {
    if (!prefs.visible) {
      if (
        this.pomodoroWidgetWindow &&
        !this.pomodoroWidgetWindow.isDestroyed() &&
        this.pomodoroWidgetWindow.isVisible()
      ) {
        this.fadeOutWindow(this.pomodoroWidgetWindow, false, 'pomo')
      }
      return
    }

    const savedWidth = Math.min(440, Math.max(244, prefs.width ?? 276))
    const savedHeight = Math.min(460, Math.max(264, prefs.height ?? 308))

    if (!this.pomodoroWidgetWindow || this.pomodoroWidgetWindow.isDestroyed()) {
      const display = screen.getPrimaryDisplay().workArea
      const safeX =
        prefs.x !== undefined &&
        prefs.x >= display.x - 80 &&
        prefs.x <= display.x + display.width - 80
          ? prefs.x
          : display.x + display.width - savedWidth - 28
      const safeY =
        prefs.y !== undefined &&
        prefs.y >= display.y &&
        prefs.y <= display.y + display.height - 48
          ? prefs.y
          : Math.min(display.y + display.height - savedHeight - 24, display.y + 370)

      this.pomodoroWidgetWindow = new BrowserWindow({
        width: savedWidth,
        height: savedHeight,
        minWidth: 244,
        maxWidth: 440,
        minHeight: 264,
        maxHeight: 460,
        x: safeX,
        y: safeY,
        title: 'WorkPacer Pomodoro',
        icon: this.getWindowIconPath(),
        frame: false,
        transparent: true,
        hasShadow: false,
        backgroundColor: '#00000000',
        resizable: true,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: prefs.alwaysOnTop,
        show: false,
        webPreferences: {
          preload: this.getPreloadPath(),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      })

      if (prefs.alwaysOnTop) {
        this.pomodoroWidgetWindow.setAlwaysOnTop(true, 'floating')
      }

      const persistPomoBounds = (): void => {
        if (this.pomoBoundsTimer) clearTimeout(this.pomoBoundsTimer)
        this.pomoBoundsTimer = setTimeout(() => {
          if (!this.pomodoroWidgetWindow || this.pomodoroWidgetWindow.isDestroyed()) return
          const bounds = this.pomodoroWidgetWindow.getBounds()
          const cur = this.db.getSettings()
          this.db.updateSettings({
            pomodoroWidget: {
              ...cur.pomodoroWidget,
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height
            }
          })
        }, 140)
      }

      this.pomodoroWidgetWindow.on('moved', persistPomoBounds)
      this.pomodoroWidgetWindow.on('resized', persistPomoBounds)

      this.pomodoroWidgetWindow.once('ready-to-show', () => {
        if (this.pomodoroWidgetWindow && !this.pomodoroWidgetWindow.isDestroyed()) {
          this.fadeInWindow(this.pomodoroWidgetWindow, 1, true)
        }
      })

      this.loadRoute(this.pomodoroWidgetWindow, 'pomodoro-widget')
    } else {
      if (this.pomoFadeTimer) {
        clearInterval(this.pomoFadeTimer)
        this.pomoFadeTimer = null
      }
      this.pomodoroWidgetWindow.setAlwaysOnTop(
        prefs.alwaysOnTop,
        prefs.alwaysOnTop ? 'floating' : 'normal'
      )
      if (!this.pomodoroWidgetWindow.isVisible()) {
        this.fadeInWindow(this.pomodoroWidgetWindow, 1, true)
      } else {
        this.pomodoroWidgetWindow.setOpacity(1)
      }
    }
  }

  // --- 4. Return Idle Modal Window (ALWAYS Centered on Primary Display WorkArea!) ---
  public showReturnPopup(): void {
    const workArea = screen.getPrimaryDisplay().workArea
    const saved = this.db.getSettings().returnPopupBounds
    const width = Math.min(560, Math.max(392, saved?.width ?? 440))
    const height = Math.min(460, Math.max(300, saved?.height ?? 336))
    const x = Math.round(workArea.x + (workArea.width - width) / 2)
    const y = Math.round(workArea.y + (workArea.height - height) / 2)

    if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
      this.returnPopupWindow.setBounds({ x, y, width, height })
      this.returnPopupWindow.center()
      if (!this.returnPopupWindow.isVisible()) {
        this.fadeInWindow(this.returnPopupWindow, 1, false)
      } else {
        this.returnPopupWindow.focus()
      }
      return
    }

    this.returnPopupWindow = new BrowserWindow({
      width,
      height,
      minWidth: 392,
      maxWidth: 560,
      minHeight: 300,
      maxHeight: 460,
      x,
      y,
      center: true,
      title: 'WorkPacer Idle Modal',
      icon: this.getWindowIconPath(),
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      resizable: true,
      maximizable: false,
      minimizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    this.returnPopupWindow.setAlwaysOnTop(true, 'pop-up-menu')

    const persistPopupSize = (): void => {
      if (this.popupBoundsTimer) clearTimeout(this.popupBoundsTimer)
      this.popupBoundsTimer = setTimeout(() => {
        if (!this.returnPopupWindow || this.returnPopupWindow.isDestroyed()) return
        const b = this.returnPopupWindow.getBounds()
        this.db.updateSettings({
          returnPopupBounds: { width: b.width, height: b.height }
        })
      }, 150)
    }

    this.returnPopupWindow.on('resized', persistPopupSize)

    this.returnPopupWindow.once('ready-to-show', () => {
      if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
        this.returnPopupWindow.setBounds({ x, y, width, height })
        this.fadeInWindow(this.returnPopupWindow, 1, false)
      }
    })

    this.loadRoute(this.returnPopupWindow, 'return-popup')
  }

  public closeReturnPopup(): void {
    if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
      this.fadeOutWindow(this.returnPopupWindow, true)
    }
    this.returnPopupWindow = null
  }

  // --- 5. Fullscreen Frosted Liquid Glass 20-20-20 Break Overlay Window ---
  public showBreakOverlay(): void {
    const bounds = screen.getPrimaryDisplay().bounds

    if (this.breakOverlayWindow && !this.breakOverlayWindow.isDestroyed()) {
      this.breakOverlayWindow.setBounds(bounds)
      if (!this.breakOverlayWindow.isVisible()) {
        this.fadeInWindow(this.breakOverlayWindow, 1, false)
      }
      return
    }

    this.breakOverlayWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      title: 'WorkPacer Wellness Break',
      icon: this.getWindowIconPath(),
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      focusable: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    this.breakOverlayWindow.setAlwaysOnTop(true, 'screen-saver')

    this.breakOverlayWindow.once('ready-to-show', () => {
      if (this.breakOverlayWindow && !this.breakOverlayWindow.isDestroyed()) {
        this.fadeInWindow(this.breakOverlayWindow, 1, false)
      }
    })

    this.loadRoute(this.breakOverlayWindow, 'break-overlay')
  }

  public closeBreakOverlay(): void {
    if (this.breakOverlayWindow && !this.breakOverlayWindow.isDestroyed()) {
      this.fadeOutWindow(this.breakOverlayWindow, true)
    }
    this.breakOverlayWindow = null
  }

  public broadcast(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload)
      }
    }
  }
}
