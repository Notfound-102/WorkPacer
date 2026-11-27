import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
  Trash2,
  Users,
  Utensils
} from 'lucide-react'
import { LiveTrackingState, PomodoroPreset, TaskRecord } from '@shared/types'
import { bridge } from '../lib/bridge'
import {
  formatClockTimer,
  formatDurationHuman,
  formatTimeHM,
  getTodayDateString
} from '../lib/formatters'

interface TasksPomodoroViewProps {
  state: LiveTrackingState
}

export const TasksPomodoroView: React.FC<TasksPomodoroViewProps> = ({ state }) => {
  const { t } = useTranslation()
  const [taskInput, setTaskInput] = useState('')
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [customFocus, setCustomFocus] = useState(40)
  const [customBreak, setCustomBreak] = useState(8)

  const loadTasks = async (): Promise<void> => {
    const list = await bridge.getTasksByDate(getTodayDateString())
    setTasks(list)
  }

  useEffect(() => {
    void loadTasks()
  }, [state.activeTask?.id, state.status])

  const handleStartTask = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!taskInput.trim()) return
    await bridge.startTask(taskInput.trim())
    setTaskInput('')
    await loadTasks()
  }

  const handleStopTask = async (): Promise<void> => {
    await bridge.stopActiveTask()
    await loadTasks()
  }

  const handleDeleteTask = async (id: number): Promise<void> => {
    await bridge.deleteTask(id)
    await loadTasks()
  }

  const pomo = state.pomodoro
  const totalPomoSec =
    (pomo.phase === 'break' ? pomo.breakMinutes : pomo.focusMinutes) * 60 || 1500
  const pomoProgressPct = Math.max(
    0,
    Math.min(100, ((totalPomoSec - pomo.remainingSec) / totalPomoSec) * 100)
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('tasks.title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('tasks.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Task Logger (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card-surface p-4 space-y-3">
            <form onSubmit={(e) => void handleStartTask(e)} className="flex gap-2">
              <input
                id="main-task-input"
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder={t('tasks.inputPlaceholder')}
                className="input-control flex-1"
              />
              <button
                id="main-task-start-btn"
                type="submit"
                className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 shrink-0"
              >
                <Play className="w-4 h-4" />
                {t('tasks.startBtn')}
              </button>
            </form>

            {/* Active Task Banner */}
            <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  {t('tasks.currentTask')}
                </div>
                {state.activeTask ? (
                  <div className="text-sm font-semibold truncate mt-0.5">
                    {state.activeTask.title}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text-muted)] mt-0.5">
                    {t('tasks.noActiveTask')}
                  </div>
                )}
              </div>

              {state.activeTask && (
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-mono text-sm font-bold text-[var(--accent)] tabular-nums">
                    {formatClockTimer(state.activeTask.durationSec)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleStopTask()}
                    className="btn-subtle px-2.5 py-1.5 text-xs font-medium flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                    {t('tasks.stopBtn')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Today's Task History */}
          <div className="card-surface p-4 space-y-3">
            <h2 className="text-sm font-semibold">{t('tasks.todayTasks')}</h2>
            {tasks.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-6 text-center">
                {t('tasks.emptyTasks')}
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {tasks.map((task) => {
                  const isRunning = task.endTime === null
                  return (
                    <div
                      key={task.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isRunning ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
                            }`}
                          />
                          <span className="font-medium truncate">{task.title}</span>
                        </div>
                        <div className="text-xs font-mono text-[var(--text-muted)] ml-4 mt-0.5 tabular-nums">
                          {formatTimeHM(task.startTime)} ~{' '}
                          {task.endTime ? formatTimeHM(task.endTime) : 'Now'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-[var(--text-secondary)] tabular-nums">
                          {formatDurationHuman(
                            isRunning && state.activeTask?.id === task.id
                              ? state.activeTask.durationSec
                              : task.durationSec
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTask(task.id)}
                          title={t('tasks.delete')}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--coral)]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Integrated Pomodoro & Manual Idle (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pomodoro Card */}
          <div className="card-surface p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-[var(--coral)]" />
                {t('tasks.pomodoroTitle')}
              </h2>
              <span className="text-xs text-[var(--text-muted)] tabular-nums">
                {t('tasks.completedCycles', { count: pomo.completedFocusCount })}
              </span>
            </div>

            {/* Preset Switcher */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: '25_5', label: t('tasks.preset25') },
                  { id: '50_10', label: t('tasks.preset50') },
                  { id: 'custom', label: t('tasks.presetCustom') }
                ] as { id: PomodoroPreset; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    void bridge.startPomodoro(item.id, customFocus, customBreak)
                  }
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    pomo.preset === item.id
                      ? 'bg-[var(--coral-soft)] border-[var(--coral)] text-[var(--coral)]'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {pomo.preset === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-[var(--text-secondary)] space-y-1">
                  <span>{t('tasks.focusMin')}</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={customFocus}
                    onChange={(e) => setCustomFocus(Number(e.target.value))}
                    className="input-control w-full !py-1 !text-xs"
                  />
                </label>
                <label className="text-xs text-[var(--text-secondary)] space-y-1">
                  <span>{t('tasks.breakMin')}</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={customBreak}
                    onChange={(e) => setCustomBreak(Number(e.target.value))}
                    className="input-control w-full !py-1 !text-xs"
                  />
                </label>
              </div>
            )}

            {/* Circular Timer */}
            <div className="flex flex-col items-center py-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="var(--bg-subtle)"
                    strokeWidth="7"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={pomo.phase === 'break' ? 'var(--accent)' : 'var(--coral)'}
                    strokeWidth="7"
                    strokeDasharray={326.7}
                    strokeDashoffset={326.7 - (326.7 * pomoProgressPct) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="font-mono text-2xl font-bold tabular-nums">
                    {formatClockTimer(pomo.remainingSec)}
                  </div>
                  <div className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {pomo.phase === 'break'
                      ? t('status.pomodoro_break')
                      : t('status.pomodoro_focus')}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {pomo.running ? (
                <button
                  type="button"
                  onClick={() => void bridge.pausePomodoro()}
                  className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  {t('tasks.pausePomo')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void bridge.startPomodoro(
                      pomo.phase === 'idle' ? pomo.preset : undefined,
                      customFocus,
                      customBreak
                    )
                  }
                  className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t('tasks.startPomo')}
                </button>
              )}

              <button
                type="button"
                onClick={() => void bridge.skipPomodoroPhase()}
                title={t('tasks.skipPhase')}
                className="btn-subtle p-2 text-xs"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => void bridge.resetPomodoro()}
                title={t('tasks.resetPomo')}
                className="btn-subtle p-2 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Manual Idle Switcher */}
          <div className="card-surface p-4 space-y-3">
            <h2 className="text-sm font-semibold">{t('tasks.manualIdleSection')}</h2>
            {state.status !== 'active' ? (
              <button
                type="button"
                onClick={() => void bridge.resumeFromIdle()}
                className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                {t('status.resumeWork')}
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void bridge.startManualIdle('eating', t('tags.lunchQuick'))}
                  className="btn-subtle py-2 px-2 text-xs font-medium flex flex-col items-center gap-1"
                >
                  <Utensils className="w-4 h-4 text-[var(--amber)]" />
                  <span>{t('tags.lunchQuick')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void bridge.startManualIdle('meeting', t('tags.meetingQuick'))}
                  className="btn-subtle py-2 px-2 text-xs font-medium flex flex-col items-center gap-1"
                >
                  <Users className="w-4 h-4 text-[var(--sky)]" />
                  <span>{t('tags.meetingQuick')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void bridge.startManualIdle('rest', t('tags.shortBreakQuick'))}
                  className="btn-subtle py-2 px-2 text-xs font-medium flex flex-col items-center gap-1"
                >
                  <Coffee className="w-4 h-4 text-[var(--accent)]" />
                  <span>{t('tags.shortBreakQuick')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
