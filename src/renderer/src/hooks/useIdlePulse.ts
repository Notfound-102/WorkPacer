import { useEffect, useState } from 'react'
import { AppSettings, DEFAULT_SETTINGS, LiveTrackingState, MainTabId, TaskRecord } from '@shared/types'
import { bridge } from '../lib/bridge'
import i18n from '../i18n'

export function useIdlePulse() {
  const [state, setState] = useState<LiveTrackingState | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [tasksToday, setTasksToday] = useState<TaskRecord[]>([])
  const [activeTab, setActiveTab] = useState<MainTabId>('dashboard')

  useEffect(() => {
    let mounted = true

    void bridge.getInitialData().then((init) => {
      if (!mounted) return
      setState(init.state)
      setSettings(init.settings)
      setTasksToday(init.tasksToday)
      if (i18n.language !== init.settings.language) {
        void i18n.changeLanguage(init.settings.language)
      }
      applyThemeClass(init.settings.theme)
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
      applyThemeClass(nextSettings.theme)
    })

    const unsubNav = bridge.onNavigateTab((tab) => {
      if (!mounted) return
      setActiveTab(tab)
    })

    return () => {
      mounted = false
      unsubState()
      unsubSettings()
      unsubNav()
    }
  }, [])

  const refreshTasks = async (dateStr: string): Promise<void> => {
    const list = await bridge.getTasksByDate(dateStr)
    setTasksToday(list)
  }

  return {
    state,
    settings,
    tasksToday,
    activeTab,
    setActiveTab,
    refreshTasks
  }
}

function applyThemeClass(theme: 'light' | 'dark'): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}
