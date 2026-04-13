import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { printSection } from '../utils/printSection'
import {
  getDurationHoursBetweenTimes,
  getNormalizedTimeRange,
  getScheduleIntervalBounds,
  getScheduleTimeRangeLabel,
} from '../utils/scheduleTime'

const AUTO_SCROLL_EDGE = 72
const AUTO_SCROLL_STEP = 22
const DRAG_ACTIVATION_DISTANCE = 6

function getScheduleEntryDay(entry) {
  return entry.day_of_week ?? entry.day ?? ''
}

function getScheduleEntryStartTime(entry) {
  if (entry.time) {
    return entry.time
  }

  return entry.start_time?.slice(0, 5) ?? ''
}

function getScheduleEntryEndTime(entry) {
  return entry.end_time?.slice(0, 5) ?? ''
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getReadableTextColor(backgroundColor) {
  if (typeof backgroundColor !== 'string' || !backgroundColor.startsWith('#')) {
    return '#ffffff'
  }

  const normalizedValue = backgroundColor.replace('#', '')
  const hexValue =
    normalizedValue.length === 3
      ? normalizedValue
          .split('')
          .map((segment) => `${segment}${segment}`)
          .join('')
      : normalizedValue

  if (hexValue.length !== 6) {
    return '#ffffff'
  }

  const red = Number.parseInt(hexValue.slice(0, 2), 16)
  const green = Number.parseInt(hexValue.slice(2, 4), 16)
  const blue = Number.parseInt(hexValue.slice(4, 6), 16)

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return '#ffffff'
  }

  const brightness = (red * 299 + green * 587 + blue * 114) / 1000
  return brightness > 170 ? '#0f172a' : '#ffffff'
}

function isSamePreview(left, right) {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return left.dayOfWeek === right.dayOfWeek
}

function formatDurationLabel(startTime, endTime) {
  const durationHours = getDurationHoursBetweenTimes(startTime, endTime)

  if (durationHours <= 0) {
    return ''
  }

  const durationMinutes = durationHours * 60
  if (durationMinutes < 60) {
    return `${durationMinutes} Min.`
  }

  return `${new Intl.NumberFormat('de-AT', {
    minimumFractionDigits: Number.isInteger(durationHours) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(durationHours)} Std.`
}

function PlanningWorkspace({
  calendarWeek,
  customersAvailableForWidget,
  customers,
  customersById,
  dashboardWeekLabel,
  isSavingSchedule,
  onAddCustomerToWidget,
  onCalendarWeekChange,
  onCopyPreviousWeek,
  onCreateScheduleEntry,
  onDeleteScheduleEntry,
  onMoveScheduleEntry,
  onRemoveCustomerFromWidget,
  onYearChange,
  scheduleDateRangeLabel,
  scheduleEntries,
  selectedEmployeeId,
  selectedEmployeeLabel,
  sidebarContent,
  widgetCustomers,
  weekdays,
  year,
}) {
  const [interaction, setInteraction] = useState(null)
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false)
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 })
  const [previewPlacement, setPreviewPlacement] = useState(null)
  const [editorDraft, setEditorDraft] = useState(null)
  const scrollAreaRef = useRef(null)
  const boardRef = useRef(null)

  const scheduledAssignmentsCount = scheduleEntries.length
  const isPlannerInteractive = selectedEmployeeId !== null && !isSavingSchedule
  const activePreviewCustomer =
    interaction?.customerId !== undefined ? customersById[interaction.customerId] ?? null : null
  const activeEditorCustomer =
    editorDraft?.customerId !== undefined ? customersById[editorDraft.customerId] ?? null : null
  const canAddCustomersToWidget = customersAvailableForWidget.length > 0
  const isCustomerPickerVisible = isCustomerPickerOpen && canAddCustomersToWidget
  const weekdayNumberByName = Object.fromEntries(
    weekdays.map((day, index) => [day, index + 1]),
  )
  const entriesByDay = Object.fromEntries(
    weekdays.map((day) => [day, scheduleEntries.filter((entry) => getScheduleEntryDay(entry) === day)]),
  )

  const hasScheduleConflict = ({ dayOfWeek, startTime, endTime, ignoreEntryId = null }) => {
    const candidateInterval = getScheduleIntervalBounds(
      dayOfWeek,
      startTime,
      endTime,
      weekdayNumberByName,
    )

    if (!candidateInterval) {
      return true
    }

    return scheduleEntries.some((entry) => {
      if (entry.id === ignoreEntryId) {
        return false
      }

      const entryInterval = getScheduleIntervalBounds(
        getScheduleEntryDay(entry),
        getScheduleEntryStartTime(entry),
        getScheduleEntryEndTime(entry),
        weekdayNumberByName,
      )

      if (!entryInterval) {
        return false
      }

      return candidateInterval.start < entryInterval.end && entryInterval.start < candidateInterval.end
    })
  }

  const getEditorValidation = (draft) => {
    if (!draft?.startTime || !draft?.endTime) {
      return {
        isValid: false,
        tone: 'info',
        message: 'Zeit von und bis manuell eintragen.',
      }
    }

    const normalizedTimeRange = getNormalizedTimeRange(draft.startTime, draft.endTime)

    if (!normalizedTimeRange) {
      return {
        isValid: false,
        tone: 'invalid',
        message:
          'Bitte gültige Uhrzeiten eintragen. Für Einsätze über Mitternacht darf die Bis-Uhrzeit früher sein.',
      }
    }

    if (
      hasScheduleConflict({
        dayOfWeek: draft.dayOfWeek,
        startTime: draft.startTime,
        endTime: draft.endTime,
        ignoreEntryId: draft.entryId ?? null,
      })
    ) {
      return {
        isValid: false,
        tone: 'invalid',
        message: 'Dieses Zeitfenster ist bereits belegt.',
      }
    }

    return {
      isValid: true,
      tone: 'valid',
      message: 'Zeitfenster frei. Auftrag kann gespeichert werden.',
    }
  }

  const editorValidation = editorDraft ? getEditorValidation(editorDraft) : null

  const maybeAutoScroll = (clientX, clientY) => {
    const scrollElement = scrollAreaRef.current
    if (!scrollElement) {
      return
    }

    const scrollRect = scrollElement.getBoundingClientRect()
    let leftDelta = 0
    let topDelta = 0

    if (clientX < scrollRect.left + AUTO_SCROLL_EDGE) {
      leftDelta = -AUTO_SCROLL_STEP
    } else if (clientX > scrollRect.right - AUTO_SCROLL_EDGE) {
      leftDelta = AUTO_SCROLL_STEP
    }

    if (clientY < scrollRect.top + AUTO_SCROLL_EDGE) {
      topDelta = -AUTO_SCROLL_STEP
    } else if (clientY > scrollRect.bottom - AUTO_SCROLL_EDGE) {
      topDelta = AUTO_SCROLL_STEP
    }

    if (leftDelta !== 0 || topDelta !== 0) {
      scrollElement.scrollBy({
        left: leftDelta,
        top: topDelta,
      })
    }
  }

  const getPlacementPreviewFromPointer = (clientX, clientY) => {
    const boardElement = boardRef.current
    const scrollElement = scrollAreaRef.current

    if (!boardElement || !scrollElement) {
      return null
    }

    const boardRect = boardElement.getBoundingClientRect()
    if (
      clientX < boardRect.left ||
      clientX > boardRect.right ||
      clientY < boardRect.top ||
      clientY > boardRect.bottom
    ) {
      return null
    }

    const contentX = clientX - boardRect.left + scrollElement.scrollLeft
    const dayWidth = boardElement.scrollWidth / weekdays.length
    const dayIndex = clamp(Math.floor(contentX / dayWidth), 0, weekdays.length - 1)

    return {
      dayOfWeek: weekdays[dayIndex],
    }
  }

  const handlePointerMove = useEffectEvent((event) => {
    if (!interaction) {
      return
    }

    setPointerPosition((currentPointer) => {
      if (currentPointer.x === event.clientX && currentPointer.y === event.clientY) {
        return currentPointer
      }

      return {
        x: event.clientX,
        y: event.clientY,
      }
    })

    const deltaX = event.clientX - interaction.originX
    const deltaY = event.clientY - interaction.originY
    const dragActivated =
      interaction.dragActivated ||
      Math.hypot(deltaX, deltaY) >= DRAG_ACTIVATION_DISTANCE

    if (!dragActivated) {
      return
    }

    if (!interaction.dragActivated) {
      setInteraction((currentInteraction) =>
        currentInteraction
          ? {
              ...currentInteraction,
              dragActivated: true,
            }
          : currentInteraction,
      )
    }

    maybeAutoScroll(event.clientX, event.clientY)

    const nextPreview = getPlacementPreviewFromPointer(event.clientX, event.clientY)
    setPreviewPlacement((currentPreview) =>
      isSamePreview(currentPreview, nextPreview) ? currentPreview : nextPreview,
    )
  })

  const handlePointerUp = useEffectEvent(() => {
    const activeInteraction = interaction
    const finalPreview = previewPlacement

    setInteraction(null)
    setPreviewPlacement(null)

    if (!activeInteraction?.dragActivated || !finalPreview || isSavingSchedule) {
      return
    }

    if (activeInteraction.mode === 'create') {
      setEditorDraft({
        mode: 'create',
        customerId: activeInteraction.customerId,
        dayOfWeek: finalPreview.dayOfWeek,
        startTime: '',
        endTime: '',
      })
      return
    }

    setEditorDraft({
      mode: 'move',
      entryId: activeInteraction.entryId,
      customerId: activeInteraction.customerId,
      dayOfWeek: finalPreview.dayOfWeek,
      startTime: activeInteraction.originalStartTime,
      endTime: activeInteraction.originalEndTime,
      originalDayOfWeek: activeInteraction.originalDayOfWeek,
      originalStartTime: activeInteraction.originalStartTime,
      originalEndTime: activeInteraction.originalEndTime,
    })
  })

  useEffect(() => {
    if (!interaction) {
      return undefined
    }

    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = interaction.dragActivated ? 'grabbing' : 'default'

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [interaction])

  const handleCustomerPointerDown = (customer, event) => {
    if (event.button !== 0 || event.target.closest('button')) {
      return
    }

    event.preventDefault()

    if (!isPlannerInteractive) {
      return
    }

    setEditorDraft(null)
    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setInteraction({
      mode: 'create',
      customerId: customer.id,
      originX: event.clientX,
      originY: event.clientY,
      dragActivated: false,
    })
    setPreviewPlacement(null)
  }

  const handleEntryPointerDown = (entry, event) => {
    if (event.button !== 0 || isSavingSchedule || event.target.closest('button')) {
      return
    }

    event.preventDefault()

    setEditorDraft(null)
    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setInteraction({
      mode: 'move',
      entryId: entry.id,
      customerId: entry.customer_id,
      originalDayOfWeek: getScheduleEntryDay(entry),
      originalStartTime: getScheduleEntryStartTime(entry),
      originalEndTime: getScheduleEntryEndTime(entry),
      originX: event.clientX,
      originY: event.clientY,
      dragActivated: false,
    })
    setPreviewPlacement(null)
  }

  const openEditorForEntry = (entry) => {
    setInteraction(null)
    setPreviewPlacement(null)
    setEditorDraft({
      mode: 'edit',
      entryId: entry.id,
      customerId: entry.customer_id,
      dayOfWeek: getScheduleEntryDay(entry),
      startTime: getScheduleEntryStartTime(entry),
      endTime: getScheduleEntryEndTime(entry),
      originalDayOfWeek: getScheduleEntryDay(entry),
      originalStartTime: getScheduleEntryStartTime(entry),
      originalEndTime: getScheduleEntryEndTime(entry),
    })
  }

  const handleEditorFieldChange = (field, value) => {
    setEditorDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            [field]: value,
          }
        : currentDraft,
    )
  }

  const handleEditorCancel = () => {
    setEditorDraft(null)
  }

  const handleEditorSubmit = async (event) => {
    event.preventDefault()

    if (!editorDraft) {
      return
    }

    const validation = getEditorValidation(editorDraft)
    if (!validation.isValid) {
      return
    }

    if (
      editorDraft.mode !== 'create' &&
      editorDraft.originalDayOfWeek === editorDraft.dayOfWeek &&
      editorDraft.originalStartTime === editorDraft.startTime &&
      editorDraft.originalEndTime === editorDraft.endTime
    ) {
      setEditorDraft(null)
      return
    }

    let wasSaved = false

    if (editorDraft.mode === 'create') {
      wasSaved = await onCreateScheduleEntry({
        customerId: editorDraft.customerId,
        dayOfWeek: editorDraft.dayOfWeek,
        startTime: editorDraft.startTime,
        endTime: editorDraft.endTime,
      })
    } else {
      wasSaved = await onMoveScheduleEntry({
        entryId: editorDraft.entryId,
        dayOfWeek: editorDraft.dayOfWeek,
        startTime: editorDraft.startTime,
        endTime: editorDraft.endTime,
      })
    }

    if (wasSaved) {
      setEditorDraft(null)
    }
  }

  const handleDeleteScheduleEntry = (entryId) => {
    if (editorDraft?.entryId === entryId) {
      setEditorDraft(null)
    }

    void onDeleteScheduleEntry(entryId)
  }

  return (
    <section className="planning-workspace-layout">
      <section
        id="dienstplan-widget"
        className="panel dashboard-widget schedule-widget"
        aria-label="Dienstplan"
      >
        <div className="widget-topline">
          <div>
            <h2>Dienstplan</h2>
            <p className="widget-note">
              {scheduleDateRangeLabel || 'Bitte eine gültige Kalenderwoche wählen.'}
            </p>
          </div>
          <div className="widget-topline-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={selectedEmployeeId === null || isSavingSchedule}
              onClick={onCopyPreviousWeek}
            >
              {isSavingSchedule ? 'Speichert...' : 'Vorwoche übernehmen'}
            </button>
            <button
              type="button"
              className="secondary-button widget-print-button"
              onClick={() => printSection('dienstplan-widget')}
            >
              Drucken
            </button>
            <span className="widget-count-pill widget-count-pill-accent">
              {String(scheduledAssignmentsCount).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="schedule-meta-row">
          <div className="schedule-meta-chip">
            <span>Mitarbeiter</span>
            <strong>{selectedEmployeeLabel}</strong>
          </div>
          <div className="schedule-meta-chip schedule-meta-chip-week">
            <span>Woche</span>
            <strong>{dashboardWeekLabel}</strong>
            <div className="schedule-week-controls">
              <label className="schedule-week-field" htmlFor="calendar-week">
                <span>KW</span>
                <input
                  id="calendar-week"
                  type="number"
                  min="1"
                  max="53"
                  inputMode="numeric"
                  value={calendarWeek}
                  onChange={(event) => onCalendarWeekChange(Number(event.target.value) || 0)}
                />
              </label>
              <label className="schedule-week-field" htmlFor="year">
                <span>Jahr</span>
                <input
                  id="year"
                  type="number"
                  min="2020"
                  inputMode="numeric"
                  value={year}
                  onChange={(event) => onYearChange(Number(event.target.value) || 0)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={`planner-board${interaction?.dragActivated ? ' planner-board-interacting' : ''}`}>
          <div className="planner-scroll-area" ref={scrollAreaRef}>
            <div className="planner-grid-layout" ref={boardRef}>
              {weekdays.map((day) => {
                const dayEntries = entriesByDay[day] ?? []

                return (
                  <div
                    key={`${day}-header`}
                    className={`planner-day-header-cell${
                      previewPlacement?.dayOfWeek === day ? ' planner-day-header-cell-preview' : ''
                    }`}
                  >
                    <span>{day}</span>
                    <strong>{String(dayEntries.length).padStart(2, '0')}</strong>
                  </div>
                )
              })}

              {weekdays.map((day) => {
                const dayEntries = entriesByDay[day] ?? []
                const dayEditor = editorDraft?.dayOfWeek === day ? editorDraft : null
                const isPreviewDay = previewPlacement?.dayOfWeek === day

                return (
                  <section
                    key={day}
                    className={`planner-day-column${isPreviewDay ? ' planner-day-column-preview' : ''}`}
                    aria-label={day}
                  >
                    {isPreviewDay ? (
                      <div
                        className="planner-day-drop-hint"
                        style={{
                          backgroundColor: activePreviewCustomer?.color ?? '#2563eb',
                          color: getReadableTextColor(activePreviewCustomer?.color ?? '#2563eb'),
                        }}
                      >
                        <strong>{activePreviewCustomer?.name ?? 'Auftrag'}</strong>
                        <span>Hier ablegen und Zeit von/bis eintragen.</span>
                      </div>
                    ) : null}

                    {dayEditor ? (
                      <form className="planner-time-editor" onSubmit={handleEditorSubmit}>
                        <div className="planner-time-editor-topline">
                          <div>
                            <span className="planner-time-editor-kicker">{dayEditor.dayOfWeek}</span>
                            <strong className="planner-time-editor-title">
                              {activeEditorCustomer?.name ?? 'Einsatz'}
                            </strong>
                          </div>
                          <span className="planner-entry-chip">
                            {dayEditor.mode === 'create'
                              ? 'Neu'
                              : dayEditor.mode === 'move'
                                ? 'Verschieben'
                                : 'Bearbeiten'}
                          </span>
                        </div>

                        {activeEditorCustomer?.address ? (
                          <span className="planner-time-editor-day">
                            {activeEditorCustomer.address}
                          </span>
                        ) : null}

                        <div className="planner-time-editor-fields">
                          <label className="planner-time-editor-field">
                            <span>Von</span>
                            <input
                              type="time"
                              step="60"
                              value={dayEditor.startTime}
                              onChange={(event) =>
                                handleEditorFieldChange('startTime', event.target.value)
                              }
                            />
                          </label>
                          <label className="planner-time-editor-field">
                            <span>Bis</span>
                            <input
                              type="time"
                              step="60"
                              value={dayEditor.endTime}
                              onChange={(event) =>
                                handleEditorFieldChange('endTime', event.target.value)
                              }
                            />
                          </label>
                        </div>

                        {editorValidation?.message ? (
                          <p
                            className={`planner-time-editor-note${
                              editorValidation.tone === 'invalid'
                                ? ' planner-time-editor-note-invalid'
                                : ''
                            }${
                              editorValidation.tone === 'valid'
                                ? ' planner-time-editor-note-valid'
                                : ''
                            }`}
                          >
                            {editorValidation.message}
                          </p>
                        ) : null}

                        <div className="planner-time-editor-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={handleEditorCancel}
                          >
                            Abbrechen
                          </button>
                          <button
                            type="submit"
                            className="action-button"
                            disabled={!editorValidation?.isValid || isSavingSchedule}
                          >
                            {isSavingSchedule ? 'Speichert...' : 'Speichern'}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {dayEntries.length > 0 ? (
                      dayEntries.map((entry) => {
                        const customer = customersById[entry.customer_id]
                        const startTime = getScheduleEntryStartTime(entry)
                        const endTime = getScheduleEntryEndTime(entry)
                        const durationLabel = formatDurationLabel(startTime, endTime)
                        const timeRangeLabel = getScheduleTimeRangeLabel(startTime, endTime)
                        const isMovingEntry =
                          interaction?.mode === 'move' && interaction.entryId === entry.id
                        const isEditingEntry = editorDraft?.entryId === entry.id

                        return (
                          <article
                            key={entry.id}
                            className={`planner-entry-card${
                              isMovingEntry || isEditingEntry ? ' planner-entry-card-moving' : ''
                            }`}
                            style={{
                              backgroundColor: customer?.color ?? '#334155',
                              color: getReadableTextColor(customer?.color ?? '#334155'),
                            }}
                            title={`${customer?.name ?? `Kunde #${entry.customer_id}`} · ${timeRangeLabel}${
                              customer?.address ? ` · ${customer.address}` : ''
                            }`}
                            onPointerDown={(event) => handleEntryPointerDown(entry, event)}
                          >
                            <div className="planner-entry-topline">
                              {durationLabel ? (
                                <span className="planner-entry-chip">{durationLabel}</span>
                              ) : null}
                              <span className="planner-entry-time">{timeRangeLabel}</span>
                            </div>
                            <strong className="planner-entry-name">
                              {customer?.name ?? `Kunde #${entry.customer_id}`}
                            </strong>
                            {customer?.address ? (
                              <span className="planner-entry-address">{customer.address}</span>
                            ) : null}
                            <div className="planner-entry-actions">
                              <button
                                type="button"
                                className="planner-entry-edit"
                                aria-label="Zeit bearbeiten"
                                disabled={isSavingSchedule}
                                onClick={() => openEditorForEntry(entry)}
                              >
                                Zeit
                              </button>
                              <button
                                type="button"
                                className="planner-entry-delete"
                                aria-label="Einsatz entfernen"
                                disabled={isSavingSchedule}
                                onClick={() => handleDeleteScheduleEntry(entry.id)}
                              >
                                ×
                              </button>
                            </div>
                          </article>
                        )
                      })
                    ) : !dayEditor && !isPreviewDay ? (
                      <p className="planner-day-empty">Auftrag hier ablegen.</p>
                    ) : null}
                  </section>
                )
              })}
            </div>
          </div>

          {selectedEmployeeId === null ? (
            <div className="planner-overlay-message">
              <strong>Mitarbeiter auswählen</strong>
              <span>Danach lassen sich Kunden direkt auf einen Wochentag ziehen.</span>
            </div>
          ) : null}

          {interaction?.dragActivated ? (
            <div
              className="planner-drag-ghost"
              style={{
                transform: `translate(${pointerPosition.x + 18}px, ${pointerPosition.y + 18}px)`,
                backgroundColor: activePreviewCustomer?.color ?? '#2563eb',
                color: getReadableTextColor(activePreviewCustomer?.color ?? '#2563eb'),
              }}
            >
              <strong>{activePreviewCustomer?.name ?? 'Einsatz'}</strong>
              <span>
                {interaction.mode === 'move'
                  ? 'Auftrag auf Wochentag verschieben'
                  : 'Kunde auf Wochentag einplanen'}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="planning-workspace-sidebar">
        {sidebarContent}

        <section
          id="kunden-widget"
          className="panel dashboard-widget customer-widget"
          aria-label="Kunden"
        >
          <div className="widget-topline">
            <div>
              <h2>Kunden</h2>
            </div>
            <div className="widget-topline-actions">
              <button
                type="button"
                className="icon-button customer-widget-add-button"
                aria-label="Kunden zum Widget hinzufügen"
                disabled={!canAddCustomersToWidget}
                onClick={() => setIsCustomerPickerOpen((currentValue) => !currentValue)}
              >
                +
              </button>
              <span className="widget-count-pill">
                {String(widgetCustomers.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          {isCustomerPickerVisible ? (
            <section className="customer-picker-panel" aria-label="Kunden zum Widget hinzufügen">
              <p className="customer-picker-title">Kunden zum Widget hinzufügen</p>
              <div className="customer-picker-list">
                {customersAvailableForWidget.map((customer) => (
                  <article
                    key={customer.id}
                    className="customer-picker-card"
                    style={{
                      backgroundColor: customer.color,
                      color: getReadableTextColor(customer.color),
                    }}
                  >
                    <div className="customer-picker-content">
                      <strong>{customer.name}</strong>
                      {customer.address ? (
                        <span className="customer-picker-meta">{customer.address}</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="customer-picker-add"
                      aria-label={`${customer.name} zum Widget hinzufügen`}
                      onClick={() => onAddCustomerToWidget(customer.id)}
                    >
                      +
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="customer-list">
            {widgetCustomers.length > 0 ? (
              widgetCustomers.map((customer) => (
                <article
                  key={customer.id}
                  className={`customer-card${
                    interaction?.mode === 'create' && interaction.customerId === customer.id
                      ? ' customer-card-active'
                      : ''
                  }${!isPlannerInteractive ? ' customer-card-disabled' : ''}`}
                  style={{
                    backgroundColor: customer.color,
                    color: getReadableTextColor(customer.color),
                  }}
                  onPointerDown={(event) => handleCustomerPointerDown(customer, event)}
                >
                  <div className="customer-card-content">
                    <span>{customer.name}</span>
                    {customer.address ? (
                      <span className="customer-card-meta">{customer.address}</span>
                    ) : null}
                  </div>
                  <div className="customer-card-actions">
                    <button
                      type="button"
                      className="customer-card-remove"
                      aria-label={`${customer.name} aus dem Widget entfernen`}
                      onClick={() => onRemoveCustomerFromWidget(customer.id)}
                    >
                      ×
                    </button>
                    <span className="customer-card-action">Einplanen</span>
                  </div>
                </article>
              ))
            ) : customers.length > 0 ? (
              <p className="empty-state customer-widget-empty">
                Kunden liegen noch nicht im Widget. Füge sie oben rechts über + hinzu.
              </p>
            ) : (
              <p className="empty-state">Keine Kunden vorhanden.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

export default PlanningWorkspace
