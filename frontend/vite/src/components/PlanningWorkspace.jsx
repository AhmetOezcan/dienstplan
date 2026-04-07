import { useEffect, useEffectEvent, useRef, useState } from 'react'

const DEFAULT_PLANNER_ROW_HEIGHT = 48
const MIN_PLANNER_ROW_HEIGHT = 28
const MIN_PLANNER_VISIBLE_HEIGHT = 360
const PLANNER_HEADER_HEIGHT = 58
const PLANNER_VIEWPORT_MARGIN = 24
const AUTO_SCROLL_EDGE = 72
const AUTO_SCROLL_STEP = 22

function getPlannerRowHeight(availableHeight, rowCount) {
  return clamp(
    Math.floor((availableHeight - PLANNER_HEADER_HEIGHT) / rowCount),
    MIN_PLANNER_ROW_HEIGHT,
    DEFAULT_PLANNER_ROW_HEIGHT,
  )
}

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
  return brightness > 170 ? '#15211f' : '#ffffff'
}

function isSamePreview(left, right) {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return (
    left.kind === right.kind &&
    left.dayOfWeek === right.dayOfWeek &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime &&
    left.valid === right.valid
  )
}

function formatDurationLabel(startTime, endTime, getTimeIndex) {
  const duration = getTimeIndex(endTime) - getTimeIndex(startTime)

  if (duration <= 0) {
    return ''
  }

  if (duration === 1) {
    return '1 Std.'
  }

  return `${duration} Std.`
}

function PlanningWorkspace({
  availableCustomers,
  calendarWeek,
  customerForm,
  customers,
  customersById,
  dashboardWeekLabel,
  getTimeIndex,
  isCustomerFormOpen,
  isSavingCustomer,
  isSavingSchedule,
  onCalendarWeekChange,
  onCreateScheduleEntry,
  onCustomerFieldChange,
  onCustomerSubmit,
  onDeleteScheduleEntry,
  onMoveScheduleEntry,
  onResetCustomerForm,
  onResizeScheduleEntry,
  onToggleCustomerForm,
  onYearChange,
  scheduleDateRangeLabel,
  scheduleEntries,
  selectedEmployeeId,
  selectedEmployeeLabel,
  timeOptions,
  timeSlots,
  weekdays,
  year,
}) {
  const [interaction, setInteraction] = useState(null)
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 })
  const [previewPlacement, setPreviewPlacement] = useState(null)
  const [plannerMetrics, setPlannerMetrics] = useState(() => {
    const initialVisibleHeight = 620
    const initialRowHeight = getPlannerRowHeight(initialVisibleHeight, timeSlots.length)

    return {
      rowHeight: initialRowHeight,
      visibleHeight: initialVisibleHeight,
    }
  })
  const scrollAreaRef = useRef(null)
  const plannerBoardRef = useRef(null)
  const boardRef = useRef(null)

  const scheduledAssignmentsCount = scheduleEntries.length
  const isPlannerInteractive = selectedEmployeeId !== null && !isSavingSchedule
  const activePreviewCustomer =
    interaction?.customerId !== undefined ? customersById[interaction.customerId] ?? null : null
  const plannerRowHeight = plannerMetrics.rowHeight
  const plannerVisibleHeight = plannerMetrics.visibleHeight

  const hasScheduleConflict = ({ dayOfWeek, startTime, endTime, ignoreEntryId = null }) => {
    const startIndex = getTimeIndex(startTime)
    const endIndex = getTimeIndex(endTime)

    if (startIndex < 0 || endIndex <= startIndex) {
      return true
    }

    return scheduleEntries.some((entry) => {
      if (entry.id === ignoreEntryId || getScheduleEntryDay(entry) !== dayOfWeek) {
        return false
      }

      const entryStartIndex = getTimeIndex(getScheduleEntryStartTime(entry))
      const entryEndIndex = getTimeIndex(getScheduleEntryEndTime(entry))

      return startIndex < entryEndIndex && entryStartIndex < endIndex
    })
  }

  const getMaximumResizeEndIndex = (entryId, dayOfWeek, startIndex) => {
    const nextStartIndex = scheduleEntries
      .filter((entry) => entry.id !== entryId && getScheduleEntryDay(entry) === dayOfWeek)
      .map((entry) => getTimeIndex(getScheduleEntryStartTime(entry)))
      .filter((timeIndex) => timeIndex > startIndex)
      .sort((left, right) => left - right)[0]

    return nextStartIndex ?? timeOptions.length - 1
  }

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

  const getPlacementPreviewFromPointer = (clientX, clientY, activeInteraction) => {
    const boardElement = boardRef.current
    const scrollElement = scrollAreaRef.current

    if (!boardElement || !scrollElement || !activeInteraction) {
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
    const contentY = clientY - boardRect.top + scrollElement.scrollTop
    const dayWidth = boardElement.scrollWidth / weekdays.length
    const dayIndex = clamp(Math.floor(contentX / dayWidth), 0, weekdays.length - 1)
    const slotIndex = clamp(Math.floor(contentY / plannerRowHeight), 0, timeSlots.length - 1)
    const dayOfWeek = weekdays[dayIndex]
    const startTime = timeSlots[slotIndex]
    const endTime = timeOptions[slotIndex + activeInteraction.span]

    if (!endTime) {
      return {
        kind: 'placement',
        dayOfWeek,
        startTime,
        endTime: '',
        valid: false,
      }
    }

    const ignoreEntryId = activeInteraction.mode === 'move' ? activeInteraction.entryId : null

    return {
      kind: 'placement',
      dayOfWeek,
      startTime,
      endTime,
      valid: !hasScheduleConflict({ dayOfWeek, startTime, endTime, ignoreEntryId }),
    }
  }

  const getResizePreviewFromPointer = (clientY, activeInteraction) => {
    const boardElement = boardRef.current
    const scrollElement = scrollAreaRef.current

    if (!boardElement || !scrollElement || !activeInteraction) {
      return null
    }

    const boardRect = boardElement.getBoundingClientRect()
    const contentY = clientY - boardRect.top + scrollElement.scrollTop
    const startIndex = getTimeIndex(activeInteraction.startTime)
    const maximumEndIndex = getMaximumResizeEndIndex(
      activeInteraction.entryId,
      activeInteraction.dayOfWeek,
      startIndex,
    )
    const endIndex = clamp(
      Math.floor(contentY / plannerRowHeight) + 1,
      startIndex + 1,
      maximumEndIndex,
    )

    return {
      kind: 'resize',
      dayOfWeek: activeInteraction.dayOfWeek,
      startTime: activeInteraction.startTime,
      endTime: timeOptions[endIndex] ?? activeInteraction.originalEndTime,
      valid: true,
    }
  }

  const updatePlannerMetrics = useEffectEvent(() => {
    const plannerBoardElement = plannerBoardRef.current

    if (!plannerBoardElement) {
      return
    }

    const availableHeight = Math.floor(
      window.innerHeight - plannerBoardElement.getBoundingClientRect().top - PLANNER_VIEWPORT_MARGIN,
    )

    if (!Number.isFinite(availableHeight)) {
      return
    }

    const nextRowHeight = getPlannerRowHeight(availableHeight, timeSlots.length)
    const contentHeight = PLANNER_HEADER_HEIGHT + nextRowHeight * timeSlots.length
    const nextVisibleHeight = clamp(
      availableHeight,
      MIN_PLANNER_VISIBLE_HEIGHT,
      contentHeight,
    )

    setPlannerMetrics((currentMetrics) => {
      if (
        currentMetrics.rowHeight === nextRowHeight &&
        currentMetrics.visibleHeight === nextVisibleHeight
      ) {
        return currentMetrics
      }

      return {
        rowHeight: nextRowHeight,
        visibleHeight: nextVisibleHeight,
      }
    })
  })

  useEffect(() => {
    updatePlannerMetrics()

    const handleResize = () => {
      updatePlannerMetrics()
    }

    window.addEventListener('resize', handleResize)

    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            updatePlannerMetrics()
          })
        : null

    if (resizeObserver && plannerBoardRef.current?.parentElement) {
      resizeObserver.observe(plannerBoardRef.current.parentElement)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
    }
  }, [timeSlots.length])

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

    maybeAutoScroll(event.clientX, event.clientY)

    const nextPreview =
      interaction.mode === 'resize'
        ? getResizePreviewFromPointer(event.clientY, interaction)
        : getPlacementPreviewFromPointer(event.clientX, event.clientY, interaction)

    setPreviewPlacement((currentPreview) =>
      isSamePreview(currentPreview, nextPreview) ? currentPreview : nextPreview,
    )
  })

  const handlePointerUp = useEffectEvent(() => {
    const activeInteraction = interaction
    const finalPreview = previewPlacement

    setInteraction(null)
    setPreviewPlacement(null)

    if (!activeInteraction || !finalPreview?.valid || isSavingSchedule) {
      return
    }

    if (activeInteraction.mode === 'create') {
      void onCreateScheduleEntry({
        customerId: activeInteraction.customerId,
        dayOfWeek: finalPreview.dayOfWeek,
        startTime: finalPreview.startTime,
        endTime: finalPreview.endTime,
      })
      return
    }

    if (activeInteraction.mode === 'move') {
      if (
        activeInteraction.originalDayOfWeek === finalPreview.dayOfWeek &&
        activeInteraction.originalStartTime === finalPreview.startTime
      ) {
        return
      }

      void onMoveScheduleEntry({
        entryId: activeInteraction.entryId,
        dayOfWeek: finalPreview.dayOfWeek,
        startTime: finalPreview.startTime,
        endTime: finalPreview.endTime,
      })
      return
    }

    if (finalPreview.endTime !== activeInteraction.originalEndTime) {
      void onResizeScheduleEntry({
        entryId: activeInteraction.entryId,
        endTime: finalPreview.endTime,
      })
    }
  })

  useEffect(() => {
    if (!interaction) {
      return undefined
    }

    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = interaction.mode === 'resize' ? 'ns-resize' : 'grabbing'

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
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    if (!isPlannerInteractive) {
      return
    }

    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setInteraction({
      mode: 'create',
      customerId: customer.id,
      span: 1,
    })
    setPreviewPlacement(null)
  }

  const handleEntryPointerDown = (entry, event) => {
    if (event.button !== 0 || isSavingSchedule || event.target.closest('button')) {
      return
    }

    const startTime = getScheduleEntryStartTime(entry)
    const endTime = getScheduleEntryEndTime(entry)
    const span = Math.max(getTimeIndex(endTime) - getTimeIndex(startTime), 1)

    if (span < 1) {
      return
    }

    event.preventDefault()

    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setInteraction({
      mode: 'move',
      entryId: entry.id,
      customerId: entry.customer_id,
      span,
      originalDayOfWeek: getScheduleEntryDay(entry),
      originalStartTime: startTime,
    })
    setPreviewPlacement({
      kind: 'placement',
      dayOfWeek: getScheduleEntryDay(entry),
      startTime,
      endTime,
      valid: true,
    })
  }

  const handleResizePointerDown = (entry, event) => {
    if (event.button !== 0 || isSavingSchedule) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const startTime = getScheduleEntryStartTime(entry)
    const endTime = getScheduleEntryEndTime(entry)

    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setInteraction({
      mode: 'resize',
      entryId: entry.id,
      customerId: entry.customer_id,
      dayOfWeek: getScheduleEntryDay(entry),
      startTime,
      originalEndTime: endTime,
    })
    setPreviewPlacement({
      kind: 'resize',
      dayOfWeek: getScheduleEntryDay(entry),
      startTime,
      endTime,
      valid: true,
    })
  }

  return (
    <>
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
          <span className="widget-count-pill widget-count-pill-accent">
            {String(scheduledAssignmentsCount).padStart(2, '0')}
          </span>
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

        <div
          ref={plannerBoardRef}
          className={`planner-board${interaction ? ' planner-board-interacting' : ''}`}
          style={{
            '--planner-row-height': `${plannerRowHeight}px`,
            '--planner-row-count': String(timeSlots.length),
            '--planner-visible-height': `${plannerVisibleHeight}px`,
          }}
        >
          <div className="planner-scroll-area" ref={scrollAreaRef}>
            <div className="planner-grid-layout">
              <div className="planner-time-header">Zeit</div>
              <div className="planner-day-header-grid">
                {weekdays.map((day) => (
                  <div key={day} className="planner-day-header-cell">
                    <span>{day}</span>
                  </div>
                ))}
              </div>

              <div className="planner-time-rail">
                {timeSlots.map((time) => (
                  <div key={time} className="planner-time-cell">
                    <span>{time}</span>
                  </div>
                ))}
              </div>

              <div className="planner-day-grid" ref={boardRef}>
                {weekdays.map((day) => {
                  const previewBelongsToDay = previewPlacement?.dayOfWeek === day
                  const previewStartIndex =
                    previewBelongsToDay && previewPlacement
                      ? getTimeIndex(previewPlacement.startTime)
                      : -1
                  const previewEndIndex =
                    previewBelongsToDay && previewPlacement
                      ? getTimeIndex(previewPlacement.endTime)
                      : -1
                  const previewSpan =
                    previewStartIndex >= 0 && previewEndIndex > previewStartIndex
                      ? previewEndIndex - previewStartIndex
                      : 1

                  return (
                    <section key={day} className="planner-day-column" aria-label={day}>
                      <div className="planner-day-slots" aria-hidden="true">
                        {timeSlots.map((time) => (
                          <div key={`${day}-${time}`} className="planner-slot" />
                        ))}
                      </div>

                      {previewBelongsToDay ? (
                        <article
                          className={`planner-preview-card${
                            previewPlacement?.valid === false ? ' planner-preview-card-invalid' : ''
                          }`}
                          style={{
                            '--entry-start': String(previewStartIndex),
                            '--entry-span': String(previewSpan),
                            backgroundColor: activePreviewCustomer?.color ?? '#0f766e',
                            color: getReadableTextColor(activePreviewCustomer?.color ?? '#0f766e'),
                          }}
                        >
                          <span className="planner-entry-chip">
                            {interaction?.mode === 'resize' ? 'Resize' : 'Vorschau'}
                          </span>
                          <strong className="planner-entry-name">
                            {activePreviewCustomer?.name ?? 'Einsatz'}
                          </strong>
                          <span className="planner-entry-time">
                            {previewPlacement.startTime} - {previewPlacement.endTime}
                          </span>
                        </article>
                      ) : null}

                      {scheduleEntries
                        .filter((entry) => getScheduleEntryDay(entry) === day)
                        .map((entry) => {
                          const customer = customersById[entry.customer_id]
                          const startTime = getScheduleEntryStartTime(entry)
                          const endTime = getScheduleEntryEndTime(entry)
                          const startIndex = getTimeIndex(startTime)
                          const endIndex = getTimeIndex(endTime)
                          const span = Math.max(endIndex - startIndex, 1)
                          const isCompactEntry = span === 1
                          const showDurationChip = span > 2
                          const isMovingEntry =
                            interaction?.mode === 'move' && interaction.entryId === entry.id
                          const isResizingEntry =
                            interaction?.mode === 'resize' && interaction.entryId === entry.id

                          return (
                            <article
                              key={entry.id}
                              className={`planner-entry-card${
                                isMovingEntry ? ' planner-entry-card-moving' : ''
                              }${isResizingEntry ? ' planner-entry-card-resizing' : ''}${
                                isCompactEntry ? ' planner-entry-card-compact' : ''
                              }`}
                              style={{
                                '--entry-start': String(startIndex),
                                '--entry-span': String(span),
                                backgroundColor: customer?.color ?? '#334155',
                                color: getReadableTextColor(customer?.color ?? '#334155'),
                              }}
                              title={`${customer?.name ?? `Kunde #${entry.customer_id}`} · ${startTime} - ${endTime}${
                                customer?.address ? ` · ${customer.address}` : ''
                              }`}
                              onPointerDown={(event) => handleEntryPointerDown(entry, event)}
                            >
                              {showDurationChip ? (
                                <div className="planner-entry-topline">
                                  <span className="planner-entry-chip">
                                    {formatDurationLabel(startTime, endTime, getTimeIndex)}
                                  </span>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                className="planner-entry-delete"
                                aria-label="Einsatz entfernen"
                                disabled={isSavingSchedule}
                                onClick={() => onDeleteScheduleEntry(entry.id)}
                              >
                                ×
                              </button>
                              <strong className="planner-entry-name">
                                {customer?.name ?? `Kunde #${entry.customer_id}`}
                              </strong>
                              {customer?.address && !isCompactEntry ? (
                                <span className="planner-entry-address">{customer.address}</span>
                              ) : null}
                              <button
                                type="button"
                                className="planner-entry-resize-handle"
                                aria-label="Einsatzdauer anpassen"
                                onPointerDown={(event) => handleResizePointerDown(entry, event)}
                              >
                                <span aria-hidden="true">↕</span>
                              </button>
                            </article>
                          )
                        })}
                    </section>
                  )
                })}
              </div>
            </div>
          </div>

          {selectedEmployeeId === null ? (
            <div className="planner-overlay-message">
              <strong>Mitarbeiter auswählen</strong>
              <span>Danach lassen sich Kunden direkt in die Woche ziehen.</span>
            </div>
          ) : null}

          {interaction ? (
            <div
              className="planner-drag-ghost"
              style={{
                transform: `translate(${pointerPosition.x + 18}px, ${pointerPosition.y + 18}px)`,
                backgroundColor: activePreviewCustomer?.color ?? '#0f766e',
                color: getReadableTextColor(activePreviewCustomer?.color ?? '#0f766e'),
              }}
            >
              <strong>{activePreviewCustomer?.name ?? 'Einsatz'}</strong>
              <span>
                {interaction.mode === 'resize'
                  ? 'Größe anpassen'
                  : interaction.mode === 'move'
                    ? 'Einsatz verschieben'
                    : 'Kunde einplanen'}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section
        id="kunden-widget"
        className="panel dashboard-widget customer-widget"
        aria-label="Kunden"
      >
        <div className="widget-topline">
          <div>
            <h2>Kunden</h2>
            <p className="widget-note">Offene Kunden für {dashboardWeekLabel}.</p>
          </div>
          <div className="widget-topline-actions">
            <span className="widget-count-pill">
              {String(availableCustomers.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Kundenformular öffnen"
              disabled={isSavingCustomer}
              onClick={() => onToggleCustomerForm((currentValue) => !currentValue)}
            >
              {isCustomerFormOpen ? '−' : '+'}
            </button>
          </div>
        </div>

        <div className="customer-panel-hint">
          <span>Drag & drop</span>
          <strong>Per Maus oder Touch in den Plan ziehen</strong>
        </div>

        <div className="customer-list">
          {availableCustomers.length > 0 ? (
            availableCustomers.map((customer) => (
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
                <span className="customer-card-action">Einplanen</span>
              </article>
            ))
          ) : customers.length > 0 && selectedEmployeeId !== null ? (
            <p className="empty-state">
              Alle Kunden für {selectedEmployeeLabel} in {dashboardWeekLabel} sind bereits
              eingeplant.
            </p>
          ) : selectedEmployeeId === null ? (
            <p className="empty-state">Wähle zuerst einen Mitarbeiter zum Planen aus.</p>
          ) : (
            <p className="empty-state">Keine Kunden vorhanden.</p>
          )}
        </div>

        {isCustomerFormOpen ? (
          <form className="form-card" onSubmit={onCustomerSubmit}>
            <div className="form-field">
              <label htmlFor="customer-name">Kundenname</label>
              <input
                id="customer-name"
                type="text"
                value={customerForm.name}
                onChange={(event) => onCustomerFieldChange('name', event.target.value)}
                placeholder="Reinigung Maier"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="customer-address">Adresse</label>
              <input
                id="customer-address"
                type="text"
                value={customerForm.address}
                onChange={(event) => onCustomerFieldChange('address', event.target.value)}
                placeholder="Wiener Straße 1"
              />
            </div>
            <div className="form-field">
              <label htmlFor="customer-notes">Notizen</label>
              <textarea
                id="customer-notes"
                value={customerForm.notes}
                onChange={(event) => onCustomerFieldChange('notes', event.target.value)}
                placeholder="Zugang, Schlüssel, Besonderheiten"
              />
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="action-button form-button"
                disabled={isSavingCustomer}
              >
                {isSavingCustomer ? 'Speichert...' : 'Speichern'}
              </button>
              <button
                type="button"
                className="secondary-button form-button"
                disabled={isSavingCustomer}
                onClick={onResetCustomerForm}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </>
  )
}

export default PlanningWorkspace
