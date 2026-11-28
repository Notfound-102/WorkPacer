import { useEffect, useState } from 'react'
import {
  AppSettings,
  DEFAULT_SETTINGS,
  LiveTrackingState,
  MainTabId,
  QuickIdlePreset,
  ResolvedTheme,
  TaskRecord,
  ThemeMode,
  UpdateCheckResult
} from '@shared/types'
import { bridge } from '../lib/bridge'
import i18n from '../i18n'

export function useIdlePulse() {
  const [state, setState] = useState<LiveTrackingState | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [tasksToday, setTasksToday] = useState<TaskRecord[]>([])
  const [quickIdlePresets, setQuickIdlePresets] = useState<QuickIdlePreset[]>([])
  const [timelineVersion, setTimelineVersion] = useState(0)
  const [updateStatus, setUpdateStatus] = useState<UpdateCheckResult | null>(null)
  const [activeTab, setActiveTab] = useState<MainTabId>('dashboard')

  useEffect(() => {
    let mounted = true

    void bridge.getInitialData().then((init) => {
      if (!mounted) return
      setState(init.state)
      setSettings(init.settings)
      setTasksToday(init.tasksToday)
      setQuickIdlePresets(init.quickIdlePresets)
      if (i18n.language !== init.settings.language) {
        void i18n.changeLanguage(init.settings.language)
      }
      applyAppearanceClasses(
        init.settings.theme,
        init.state.resolvedTheme,
        init.settings.reduceTransparency
      )
    })

    const unsubState = bridge.onStateUpdate((nextState) => {
      if (!mounted) return
      setState(nextState)
    })

    const unsubSettings = bridge.onSettingsUpdate((nextSettings) => {
      if (!mounted) return
      setSettings(nextSettings)
      if (i18n.language !== nextSettings.language) {
        void i18n.changeLanguage(nextSettings.language)
      }
    })

    const unsubPresets = bridge.onPresetsUpdate((nextPresets) => {
      if (!mounted) return
      setQuickIdlePresets(nextPresets)
    })

    const unsubTimeline = bridge.onTimelineChanged(() => {
      if (!mounted) return
      setTimelineVersion((v) => v + 1)
    })

    const unsubUpdate = bridge.onUpdateStatus((res) => {
      if (!mounted) return
      setUpdateStatus(res)
    })

    const unsubNav = bridge.onNavigateTab((tab) => {
      if (!mounted) return
      setActiveTab(tab)
    })

    return () => {
      mounted = false
      unsubState()
      unsubSettings()
      unsubPresets()
      unsubTimeline()
      unsubUpdate()
      unsubNav()
    }
  }, [])

  useEffect(() => {
    applyAppearanceClasses(
      settings.theme,
      state?.resolvedTheme,
      settings.reduceTransparency
    )
  }, [settings.theme, settings.reduceTransparency, state?.resolvedTheme])

  const refreshTasks = async (dateStr: string): Promise<void> => {
    const list = await bridge.getTasksByDate(dateStr)
    setTasksToday(list)
  }

  return {
    state,
    settings,
    tasksToday,
    quickIdlePresets,
    timelineVersion,
    updateStatus,
    setUpdateStatus,
    activeTab,
    setActiveTab,
    refreshTasks
  }
}

function applyAppearanceClasses(
  theme: ThemeMode,
  resolvedFromMain: ResolvedTheme | undefined,
  reduceTransparency: boolean
): void {
  const root = document.documentElement
  const isDark =
    theme === 'dark'
      ? true
      : theme === 'light'
        ? false
        : resolvedFromMain
          ? resolvedFromMain === 'dark'
          : window.matchMedia?.('(prefers-color-scheme: dark)').matches

  root.classList.toggle('dark', Boolean(isDark))
  root.classList.toggle('reduce-transparency', Boolean(reduceTransparency))
}
