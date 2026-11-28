import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  ArrowDownUp,
  Check,
  Copy,
  FileText,
  GripVertical,
  Plus,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react'
import { AppSettings, DailyReportDocument, DailyReportRow } from '@shared/types'
import {
  formatDailyReportPlainText,
  minutesToReportTime,
  parseTimeToMinutes,
  reorderTimelineRowsWithConstraint,
  sortReportRowsChronologically
} from '@shared/reportFormatter'
import { bridge } from '../lib/bridge'
import { getTodayDateString } from '../lib/formatters'

interface DailyReportViewProps {
  settings: AppSettings
  timelineVersion: number
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  settings,
  timelineVersion
}) => {
  const { t } = useTranslation()
  const [dateStr, setDateStr] = useState(getTodayDateString())
  const [doc, setDoc] = useState<DailyReportDocument | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Drag & Drop state
  const [dragEnabledRowId, setDragEnabledRowId] = useState<string | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragError, setDragError] = useState<string | null>(null)

  useEffect(() => {
    void bridge.getDailyReport(dateStr, false).then(setDoc)
  }, [dateStr, timelineVersion])

  const persistDoc = async (next: DailyReportDocument): Promise<void> => {
    setDoc(next)
    await bridge.saveDailyReport(next)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1800)
  }

  const handleRegenerate = async (): Promise<void> => {
    const fresh = await bridge.getDailyReport(dateStr, true)
    setDoc(fresh)
  }

  const handleRowChange = (
    id: string,
    field: keyof Omit<DailyReportRow, 'id'>,
    value: string
  ): void => {
    if (!doc) return
    const nextRows = doc.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    void persistDoc({ ...doc, rows: nextRows })
  }

  // Auto-sorts Timeline chronologically immediately upon adding a new row
  const handleAddRow = (): void => {
    if (!doc) return
    const last = doc.rows[doc.rows.length - 1]
    const nextStart = last ? last.endTime : doc.shiftStart
    const startMin = parseTimeToMinutes(nextStart)
    const endMin = Math.min(parseTimeToMinutes(doc.shiftEnd), startMin + 40)
    const nextEnd = endMin > startMin ? minutesToReportTime(endMin) : doc.shiftEnd

    const newRow: DailyReportRow = {
      id: `manual-${Date.now()}`,
      startTime: nextStart,
      endTime: nextEnd,
      content: t('report.defaultWork')
    }

    const sortedRows = sortReportRowsChronologically([...doc.rows, newRow])
    void persistDoc({ ...doc, rows: sortedRows })
  }

  const handleDeleteRow = (id: string): void => {
    if (!doc) return
    void persistDoc({ ...doc, rows: doc.rows.filter((r) => r.id !== id) })
  }

  const handleSortRows = (): void => {
    if (!doc) return
    setDragError(null)
    const sorted = sortReportRowsChronologically(doc.rows)
    void persistDoc({ ...doc, rows: sorted })
  }

  const handleDropRow = (targetIndex: number): void => {
    if (!doc || draggingIndex === null) {
      setDraggingIndex(null)
      setDragOverIndex(null)
      setDragEnabledRowId(null)
      return
    }

    const res = reorderTimelineRowsWithConstraint(doc.rows, draggingIndex, targetIndex)
    setDraggingIndex(null)
    setDragOverIndex(null)
    setDragEnabledRowId(null)

    if (!res.valid) {
      setDragError(t('report.dragTimeViolation'))
      setTimeout(() => {
        setDragError((cur) => (cur === t('report.dragTimeViolation') ? null : cur))
      }, 4500)
      return
    }

    setDragError(null)
    void persistDoc({ ...doc, rows: res.rows })
  }

  const handleShiftOverride = async (
    field: 'shiftStart' | 'shiftEnd',
    value: string
  ): Promise<void> => {
    if (!doc) return
    const updated = { ...doc, [field]: value }
    await persistDoc(updated)
  }

  const plainText = useMemo(() => {
    if (!doc) return ''
    return formatDailyReportPlainText(
      dateStr,
      settings.userName,
      doc.rows,
      settings.reportTitle
    )
  }, [dateStr, settings.userName, settings.reportTitle, doc])

  const handleCopyPlainText = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(plainText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = plainText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('report.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('report.subtitle')}</p>
        </div>

        <button
          id="report-regenerate-btn"
          type="button"
          onClick={() => void handleRegenerate()}
          className="btn-subtle px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
          {t('report.regenerate')}
        </button>
      </div>

      {/* Config Strip */}
      <div className="card-surface p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-semibold text-[var(--text-secondary)]">
            <span>{t('report.reportDate')}:</span>
            <input
              id="report-date-input"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="input-control !py-1 !px-2.5 !text-xs"
            />
          </label>

          {doc && (
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="font-semibold">{t('report.shiftWindow')}:</span>
              <input
                type="time"
                value={doc.shiftStart.padStart(5, '0')}
                onChange={(e) => void handleShiftOverride('shiftStart', e.target.value)}
                className="input-control !py-1 !px-2.5 !text-xs font-mono"
              />
              <span>~</span>
              <input
                type="time"
                value={doc.shiftEnd.padStart(5, '0')}
                onChange={(e) => void handleShiftOverride('shiftEnd', e.target.value)}
                className="input-control !py-1 !px-2.5 !text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={settings.hideLunchInReport}
              onChange={async (e) => {
                await bridge.updateSettings({ hideLunchInReport: e.target.checked })
                const fresh = await bridge.getDailyReport(dateStr, true)
                setDoc(fresh)
              }}
              className="accent-[var(--accent)]"
            />
            <span>
              {t('report.hideLunch', {
                start: settings.lunchStart,
                end: settings.lunchEnd
              })}
            </span>
          </label>

          <label className="flex items-center gap-1.5 font-medium">
            <span>{t('report.mergeMicro', { min: settings.mergeMicroBreaksMinutes })}</span>
            <input
              type="number"
              min={0}
              max={30}
              value={settings.mergeMicroBreaksMinutes}
              onChange={async (e) => {
                const val = Math.max(0, Math.min(30, Number(e.target.value)))
                await bridge.updateSettings({ mergeMicroBreaksMinutes: val })
                const fresh = await bridge.getDailyReport(dateStr, true)
                setDoc(fresh)
              }}
              className="input-control w-14 !py-1 !px-2 !text-xs font-mono"
            />
          </label>
        </div>
      </div>

      {/* Main Split Studio: Drag-and-Drop Timeline Editor (Left) + Plain-Text Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 card-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold">Timeline ({doc?.rows.length ?? 0})</h2>
              {savedFlash && (
                <span className="text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 rounded-full">
                  {t('report.savedBadge')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                id="report-manual-sort-btn"
                type="button"
                onClick={handleSortRows}
                className="btn-subtle px-3 py-1.5 text-xs font-semibold flex items-center gap-1"
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
                {t('report.sortRows')}
              </button>
              <button
                id="report-add-row-btn"
                type="button"
                onClick={handleAddRow}
                className="btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('report.addRow')}
              </button>
            </div>
          </div>

          {/* Time-Order Violation Reminder Banner */}
          {dragError && (
            <div className="px-3.5 py-2.5 rounded-2xl bg-[var(--amber-soft)] border border-[var(--amber)]/40 text-[var(--amber)] text-xs font-semibold flex items-start justify-between gap-2 animate-fluid-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{dragError}</span>
              </div>
              <button
                type="button"
                onClick={() => setDragError(null)}
                className="p-0.5 rounded-full hover:opacity-75 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-2">
            <div className="grid grid-cols-[24px_76px_12px_76px_minmax(0,1fr)_32px] gap-1.5 px-1 text-[11px] font-bold text-[var(--text-secondary)]">
              <span />
              <span>{t('report.colStart')}</span>
              <span />
              <span>{t('report.colEnd')}</span>
              <span>{t('report.colContent')}</span>
              <span />
            </div>

            {doc?.rows.map((row, index) => {
              const isDragging = draggingIndex === index
              const isDropTarget = dragOverIndex === index && draggingIndex !== index

              return (
                <div
                  key={row.id}
                  draggable={dragEnabledRowId === row.id}
                  onDragStart={(e) => {
                    setDraggingIndex(index)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', row.id)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverIndex !== index) setDragOverIndex(index)
                  }}
                  onDragEnd={() => {
                    setDraggingIndex(null)
                    setDragOverIndex(null)
                    setDragEnabledRowId(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDropRow(index)
                  }}
                  className={`grid grid-cols-[24px_76px_12px_76px_minmax(0,1fr)_32px] gap-1.5 items-center rounded-xl py-0.5 transition-all ${
                    isDragging ? 'opacity-45 scale-[0.99]' : ''
                  } ${
                    isDropTarget
                      ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)] px-1'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    title={t('report.dragHint')}
                    onMouseDown={() => setDragEnabledRowId(row.id)}
                    onMouseUp={() => setDragEnabledRowId(null)}
                    className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center justify-center"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={row.startTime}
                    onChange={(e) => handleRowChange(row.id, 'startTime', e.target.value)}
                    placeholder="8:30"
                    className="input-control !py-1.5 !px-2 !text-xs font-mono font-semibold text-center tabular-nums"
                  />
                  <span className="text-center text-xs text-[var(--text-secondary)] font-mono">
                    ~
                  </span>
                  <input
                    type="text"
                    value={row.endTime}
                    onChange={(e) => handleRowChange(row.id, 'endTime', e.target.value)}
                    placeholder="9:30"
                    className="input-control !py-1.5 !px-2 !text-xs font-mono font-semibold text-center tabular-nums"
                  />
                  <input
                    type="text"
                    value={row.content}
                    onChange={(e) => handleRowChange(row.id, 'content', e.target.value)}
                    className="input-control !py-1.5 !px-3 !text-xs font-medium w-full"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(row.id)}
                    className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--coral)] flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* High-Contrast Plain-Text Preview & Copy */}
        <div className="lg:col-span-5 card-surface p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold">{t('report.previewTitle')}</h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {t('report.previewHint')}
            </p>
          </div>

          <pre
            id="daily-report-plaintext-preview"
            style={{ tabSize: 6 }}
            className="w-full min-h-[268px] p-4 rounded-2xl bg-[var(--bg-editor)] text-[var(--text-primary)] border border-[var(--border-strong)] font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre select-all"
          >
            {plainText}
          </pre>

          <button
            id="copy-daily-report-btn"
            type="button"
            onClick={() => void handleCopyPlainText()}
            className="w-full btn-primary py-2.5 px-5 text-sm flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                {t('report.copiedBtn')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t('report.copyBtn')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
