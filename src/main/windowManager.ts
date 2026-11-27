import { join } from 'path'
import { app, BrowserWindow, screen } from 'electron'
import { IdlePulseDatabase } from './database'
import { MainTabId, StickyWidgetPrefs } from '../shared/types'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private widgetWindow: BrowserWindow | null = null
  private returnPopupWindow: BrowserWindow | null = null
  private breakOverlayWindow: BrowserWindow | null = null
  private isQuitting = false

  constructor(private db: IdlePulseDatabase) {}

  public setQuitting(val: boolean): void {
    this.isQuitting = val
  }

  private getPreloadPath(): string {
    return join(__dirname, '../preload/index.js')
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

  // --- 1. Main Application Window ---
  public createOrShowMainWindow(initialTab?: MainTabId): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore()
      this.mainWindow.show()
      this.mainWindow.focus()
      if (initialTab) {
        this.mainWindow.webContents.send('nav:tab', initialTab)
      }
      return this.mainWindow
    }

    this.mainWindow = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 920,
      minHeight: 620,
      show: false,
      title: 'IdlePulse',
      autoHideMenuBar: true,
      backgroundColor: '#f8fafc',
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show()
      if (initialTab) {
        this.mainWindow?.webContents.send('nav:tab', initialTab)
      }
    })

    // Minimize to System Tray instead of killing background tracking
    this.mainWindow.on('close', (e) => {
      if (!this.isQuitting) {
        e.preventDefault()
        this.mainWindow?.hide()
      }
    })

    this.loadRoute(this.mainWindow, 'main')
    return this.mainWindow
  }

  // --- 2. Floating Sticky Widget Window ---
  public syncStickyWidgetWindow(prefs: StickyWidgetPrefs): void {
    if (!prefs.visible) {
      if (this.widgetWindow && !this.widgetWindow.isDestroyed()) {
        this.widgetWindow.close()
      }
      this.widgetWindow = null
      return
    }

    const width = 316
    const height = prefs.collapsed ? 58 : 272

    if (!this.widgetWindow || this.widgetWindow.isDestroyed()) {
      const display = screen.getPrimaryDisplay().workArea
      const safeX =
        prefs.x !== undefined &&
        prefs.x >= display.x - 100 &&
        prefs.x <= display.x + display.width - 60
          ? prefs.x
          : display.x + display.width - width - 24
      const safeY =
        prefs.y !== undefined &&
        prefs.y >= display.y &&
        prefs.y <= display.y + display.height - 40
          ? prefs.y
          : display.y + 32

      this.widgetWindow = new BrowserWindow({
        width,
        height,
        x: safeX,
        y: safeY,
        frame: false,
        transparent: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: prefs.alwaysOnTop,
        opacity: Math.min(1, Math.max(0.35, prefs.opacity)),
        hasShadow: true,
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

      this.widgetWindow.on('moved', () => {
        if (!this.widgetWindow || this.widgetWindow.isDestroyed()) return
        const [nx, ny] = this.widgetWindow.getPosition()
        const cur = this.db.getSettings()
        this.db.updateSettings({
          stickyWidget: { ...cur.stickyWidget, x: nx, y: ny }
        })
      })

      this.loadRoute(this.widgetWindow, 'widget')
    } else {
      this.widgetWindow.setAlwaysOnTop(prefs.alwaysOnTop, prefs.alwaysOnTop ? 'floating' : 'normal')
      this.widgetWindow.setOpacity(Math.min(1, Math.max(0.35, prefs.opacity)))
      const [, curH] = this.widgetWindow.getSize()
      if (curH !== height) {
        this.widgetWindow.setSize(width, height, true)
      }
      this.widgetWindow.showInactive()
    }
  }

  // --- 3. Return UX Quick Tag Popup Window ---
  public showReturnPopup(): void {
    const workArea = screen.getPrimaryDisplay().workArea
    const width = 368
    const height = 286
    const x = workArea.x + workArea.width - width - 20
    const y = workArea.y + workArea.height - height - 20

    if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
      this.returnPopupWindow.setPosition(x, y)
      this.returnPopupWindow.showInactive()
      return
    }

    this.returnPopupWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    this.returnPopupWindow.setAlwaysOnTop(true, 'pop-up-menu')
    this.loadRoute(this.returnPopupWindow, 'return-popup')
  }

  public closeReturnPopup(): void {
    if (this.returnPopupWindow && !this.returnPopupWindow.isDestroyed()) {
      this.returnPopupWindow.close()
    }
    this.returnPopupWindow = null
  }

  // --- 4. 20-20-20 Eye Care & Sitting Break Overlay Window ---
  public showBreakOverlay(): void {
    const workArea = screen.getPrimaryDisplay().workArea
    const width = 392
    const height = 224
    const x = Math.round(workArea.x + (workArea.width - width) / 2)
    const y = workArea.y + 36

    if (this.breakOverlayWindow && !this.breakOverlayWindow.isDestroyed()) {
      this.breakOverlayWindow.setPosition(x, y)
      this.breakOverlayWindow.showInactive()
      return
    }

    this.breakOverlayWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      focusable: true,
      skipTaskbar: true,
      hasShadow: true,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })
    this.breakOverlayWindow.setAlwaysOnTop(true, 'screen-saver')
    this.loadRoute(this.breakOverlayWindow, 'break-overlay')
  }

  public closeBreakOverlay(): void {
    if (this.breakOverlayWindow && !this.breakOverlayWindow.isDestroyed()) {
      this.breakOverlayWindow.close()
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
