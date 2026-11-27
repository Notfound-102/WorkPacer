import { existsSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow, nativeTheme, screen } from 'electron'
import { IdlePulseDatabase } from './database'
import { MainTabId, ResolvedTheme, StickyWidgetPrefs, ThemeMode } from '../shared/types'

const LIGHT_BG = '#edf3fb'
const DARK_BG = '#080d1a'
const LIGHT_TITLEBAR = '#eef4fb'
const DARK_TITLEBAR = '#0b1222'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private widgetWindow: BrowserWindow | null = null
  private returnPopupWindow: BrowserWindow | null = null
  private breakOverlayWindow: BrowserWindow | null = null
  private isQuitting = false

  private widgetBoundsTimer: NodeJS.Timeout | null = null
  private popupBoundsTimer: NodeJS.Timeout | null = null
  private widgetFadeTimer: NodeJS.Timeout | null = null

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

  /**
   * Synchronizes Electron's nativeTheme.themeSource, window background color,
   * and Windows/Linux TitleBarOverlay caption colors immediately without white flash.
   */
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
      if (process.platform !== 'darwin' && typeof this.mainWindow.setTitleBarOverlay === 'function') {
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
      // Smooth ease-out curve matching cubic-bezier(0.22, 1, 0.36, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      win.setOpacity(Math.min(targetOpacity, eased * targetOpacity))
      if (step >= steps) {
        clearInterval(interval)
        win.setOpacity(targetOpacity)
      }
    }, 28)
  }

  private fadeOutAndHideWindow(win: BrowserWindow, closeAfter = false): void {
    if (win.isDestroyed()) return
    if (this.widgetFadeTimer) {
      clearInterval(this.widgetFadeTimer)
      this.widgetFadeTimer = null
    }
    const startOpacity = win.getOpacity()
    const steps = 5
    let step = 0
    this.widgetFadeTimer = setInterval(() => {
      if (win.isDestroyed()) {
        if (this.widgetFadeTimer) clearInterval(this.widgetFadeTimer)
        this.widgetFadeTimer = null
        return
      }
      step++
      const next = Math.max(0, startOpacity * (1 - step / steps))
      win.setOpacity(next)
      if (step >= steps) {
        if (this.widgetFadeTimer) clearInterval(this.widgetFadeTimer)
        this.widgetFadeTimer = null
        if (closeAfter) {
          win.close()
        } else {
          win.hide()
          win.setOpacity(1)
        }
      }
    }, 26)
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

  // --- 2. Resizable Liquid Glass Floating Sticky Widget Window ---
  public syncStickyWidgetWindow(prefs: StickyWidgetPrefs): void {
    if (!prefs.visible) {
      if (this.widgetWindow && !this.widgetWindow.isDestroyed() && this.widgetWindow.isVisible()) {
        this.fadeOutAndHideWindow(this.widgetWindow, false)
      }
      return
    }

    const savedWidth = Math.min(520, Math.max(286, prefs.width ?? 332))
    const savedHeight = Math.min(480, Math.max(248, prefs.height ?? 304))
    const targetHeight = prefs.collapsed ? 58 : savedHeight

    if (!this.widgetWindow || this.widgetWindow.isDestroyed()) {
      const display = screen.getPrimaryDisplay().workArea
      const safeX =
        prefs.x !== undefined &&
        prefs.x >= display.x - 100 &&
        prefs.x <= display.x + display.width - 80
          ? prefs.x
          : display.x + display.width - savedWidth - 24
      const safeY =
        prefs.y !== undefined &&
        prefs.y >= display.y &&
        prefs.y <= display.y + display.height - 48
          ? prefs.y
          : display.y + 44

      this.widgetWindow = new BrowserWindow({
        width: savedWidth,
        height: targetHeight,
        minWidth: 286,
        maxWidth: 520,
        minHeight: prefs.collapsed ? 58 : 248,
        maxHeight: prefs.collapsed ? 58 : 480,
        x: safeX,
        y: safeY,
        title: 'WorkPacer Widget',
        icon: this.getWindowIconPath(),
        frame: false,
        transparent: true,
        resizable: !prefs.collapsed,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: prefs.alwaysOnTop,
        hasShadow: true,
        ...(process.platform === 'darwin' ? { vibrancy: 'hud' as const } : {}),
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
      this.widgetWindow.setMinimumSize(286, prefs.collapsed ? 58 : 248)
      this.widgetWindow.setMaximumSize(520, prefs.collapsed ? 58 : 480)

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

  // --- 3. Resizable Return UX Quick Tag Popup Window ---
  public showReturnPopup(): void {
    const workArea = screen.getPrimaryDisplay().workArea
    const saved = this.db.getSettings().returnPopupBounds
    const width = Math.min(540, Math.max(348, saved?.width ?? 384))
    const height = Math.min(440, Math.max(272, saved?.height ?? 298))
    const x =
      saved?.x !== undefined &&
      saved.x >= workArea.x &&
      saved.x <= workArea.x + workArea.width - 120
        ? saved.x
        : workArea.x + workArea.width - width - 20
    const y =
      saved?.y !== undefined &&
      saved.y >= workArea.y &&
      saved.y <= workArea.y + workArea.height - 100
        ? saved.y
        : workArea.y + workArea.height - height - 20

    if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
      this.returnPopupWindow.setBounds({ x, y, width, height })
      if (!this.returnPopupWindow.isVisible()) {
        this.fadeInWindow(this.returnPopupWindow, 1, true)
      }
      return
    }

    this.returnPopupWindow = new BrowserWindow({
      width,
      height,
      minWidth: 348,
      maxWidth: 540,
      minHeight: 272,
      maxHeight: 440,
      x,
      y,
      title: 'WorkPacer Quick Tag',
      icon: this.getWindowIconPath(),
      frame: false,
      transparent: true,
      resizable: true,
      maximizable: false,
      minimizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      show: false,
      ...(process.platform === 'darwin' ? { vibrancy: 'popover' as const } : {}),
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    this.returnPopupWindow.setAlwaysOnTop(true, 'pop-up-menu')

    const persistPopupBounds = (): void => {
      if (this.popupBoundsTimer) clearTimeout(this.popupBoundsTimer)
      this.popupBoundsTimer = setTimeout(() => {
        if (!this.returnPopupWindow || this.returnPopupWindow.isDestroyed()) return
        const b = this.returnPopupWindow.getBounds()
        this.db.updateSettings({
          returnPopupBounds: { x: b.x, y: b.y, width: b.width, height: b.height }
        })
      }, 150)
    }

    this.returnPopupWindow.on('moved', persistPopupBounds)
    this.returnPopupWindow.on('resized', persistPopupBounds)

    this.returnPopupWindow.once('ready-to-show', () => {
      if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
        this.fadeInWindow(this.returnPopupWindow, 1, true)
      }
    })

    this.loadRoute(this.returnPopupWindow, 'return-popup')
  }

  public closeReturnPopup(): void {
    if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
      this.fadeOutAndHideWindow(this.returnPopupWindow, true)
    }
    this.returnPopupWindow = null
  }

  // --- 4. Fullscreen Frosted Liquid Glass 20-20-20 Break Overlay Window ---
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
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      focusable: true,
      skipTaskbar: true,
      hasShadow: false,
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
      this.fadeOutAndHideWindow(this.breakOverlayWindow, true)
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
