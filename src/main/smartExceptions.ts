import { execFile } from 'child_process'
import { promisify } from 'util'
import { SmartExceptionReason } from '../shared/types'

const execFileAsync = promisify(execFile)

let cachedReason: SmartExceptionReason = 'none'
let lastCheckedAt = 0
const CACHE_TTL_MS = 8000

/**
 * Lightweight, non-blocking cross-platform detector for:
 * 1) Active microphone / voice-video call (Zoom, Teams, Meet, Slack, Discord)
 * 2) Fullscreen video / media playback assertion (YouTube, VLC, Netflix, Presentation)
 *
 * Uses native OS state queries without heavy background polling.
 */
export async function detectSmartException(): Promise<SmartExceptionReason> {
  const now = Date.now()
  if (now - lastCheckedAt < CACHE_TTL_MS) {
    return cachedReason
  }
  lastCheckedAt = now

  try {
    if (process.platform === 'darwin') {
      cachedReason = await detectMacOS()
    } else if (process.platform === 'win32') {
      cachedReason = await detectWindows()
    } else {
      cachedReason = await detectLinux()
    }
  } catch {
    cachedReason = 'none'
  }

  return cachedReason
}

async function detectMacOS(): Promise<SmartExceptionReason> {
  const { stdout } = await execFileAsync('pmset', ['-g', 'assertions'], { timeout: 1500 })
  const lower = stdout.toLowerCase()
  // Zoom, Teams, Meet, FaceTime, Discord hold coreaudiod / audio-in sleep assertions
  if (
    lower.includes('zoom.us') ||
    lower.includes('microsoft teams') ||
    lower.includes('webex') ||
    lower.includes('facetime') ||
    lower.includes('coreaudiod') && lower.includes('input')
  ) {
    return 'call_active'
  }
  // PreventUserIdleDisplaySleep 1 indicates active fullscreen video / presentation (YouTube, QuickTime, VLC)
  if (/preventuseridledisplaysleep\s+1/i.test(stdout)) {
    return 'fullscreen_media'
  }
  return 'none'
}

async function detectWindows(): Promise<SmartExceptionReason> {
  // 1) Check Windows 10/11 CapabilityAccessManager Microphone registry (LastUsedTimeStop == 0 means mic is currently live)
  // 2) Check SHQueryUserNotificationState for fullscreen D3D / presentation / video mode
  const psScript = `
$micActive = $false
$paths = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\NonPackaged\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone\\*'
)
foreach ($p in $paths) {
  $items = Get-ItemProperty -Path $p -Name LastUsedTimeStop -ErrorAction SilentlyContinue
  foreach ($item in $items) {
    if ($item.LastUsedTimeStop -eq 0) { $micActive = $true; break }
  }
  if ($micActive) { break }
}
if ($micActive) { Write-Output 'call_active'; exit 0 }

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinState {
  [DllImport("shell32.dll")]
  public static extern int SHQueryUserNotificationState(out int state);
}
"@ -ErrorAction SilentlyContinue
$st = 0
[WinState]::SHQueryUserNotificationState([ref]$st) | Out-Null
if ($st -eq 2 -or $st -eq 3 -or $st -eq 4) { Write-Output 'fullscreen_media'; exit 0 }
Write-Output 'none'
`
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', psScript],
    { timeout: 2000, windowsHide: true }
  )
  const trimmed = stdout.trim()
  if (trimmed === 'call_active') return 'call_active'
  if (trimmed === 'fullscreen_media') return 'fullscreen_media'
  return 'none'
}

async function detectLinux(): Promise<SmartExceptionReason> {
  try {
    const { stdout: sources } = await execFileAsync('pactl', ['list', 'source-outputs', 'short'], {
      timeout: 1000
    })
    if (sources.trim().length > 0) {
      return 'call_active'
    }
    const { stdout: sinks } = await execFileAsync('pactl', ['list', 'sink-inputs', 'short'], {
      timeout: 1000
    })
    if (sinks.trim().length > 0) {
      return 'fullscreen_media'
    }
  } catch {
    // pactl not installed or no active audio daemon
  }
  return 'none'
}
