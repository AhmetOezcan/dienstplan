import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { printSection } from '../utils/printSection'
import {
  getDurationHoursBetweenTimes,
  getScheduleTimeRangeLabel,
} from '../utils/scheduleTime'
import {
  getDisplayTimeRangeForShift,
  getScheduleEntryEndTime as getScheduleEntryEndTimeValue,
  getScheduleEntryStartTime as getScheduleEntryStartTimeValue,
  getShiftTimelineBounds,
  getTimeValueFromMinutes,
} from '../utils/scheduleShift'

const AUTO_SCROLL_EDGE = 72
const AUTO_SCROLL_STEP = 22
const WINDOW_AUTO_SCROLL_EDGE = 72
const WINDOW_AUTO_SCROLL_STEP = 18
const DRAG_ACTIVATION_DISTANCE = 6
const TIMELINE_INTERVAL_MINUTES = 60
const TIMELINE_MIN_DURATION_MINUTES = 60

function getTimelineMetrics(viewportWidth) {
  const normalizedViewportWidth =
    typeof viewportWidth === 'number' && viewportWidth > 0 ? viewportWidth : 1440

  if (normalizedViewportWidth <= 640) {
    return {
      hourHeight: 40,
      timeAxisWidth: 68,
      dayMinWidth: 126,
      maxHeight: 660,
      headerHeight: 48,
      entryInset: 3,
      columnPadding: 10,
      edgePadding: 0,
    }
  }

  if (normalizedViewportWidth <= 900) {
    return {
      hourHeight: 44,
      timeAxisWidth: 72,
      dayMinWidth: 136,
      maxHeight: 740,
      headerHeight: 52,
      entryInset: 3,
      columnPadding: 12,
      edgePadding: 0,
    }
  }

  if (normalizedViewportWidth <= 1280) {
    return {
      hourHeight: 48,
      timeAxisWidth: 76,
      dayMinWidth: 142,
      maxHeight: 800,
      headerHeight: 54,
      entryInset: 4,
      columnPadding: 12,
      edgePadding: 0,
    }
  }

  return {
    hourHeight: 52,
    timeAxisWidth: 80,
    dayMinWidth: 146,
    maxHeight: 860,
    headerHeight: 56,
    entryInset: 4,
    columnPadding: 12,
    edgePadding: 0,
  }
}

function getScheduleEntryDay(entry) {
  return entry.planner_day_of_week ?? entry.day_of_week ?? entry.day ?? ''
}

function getScheduleEntryStartTime(entry) {
  return getScheduleEntryStartTimeValue(entry)
}

function getScheduleEntryEndTime(entry) {
  return getScheduleEntryEndTimeValue(entry)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function roundMinutesDownToInterval(minutes) {
  return Math.floor(minutes / TIMELINE_INTERVAL_MINUTES) * TIMELINE_INTERVAL_MINUTES
}

function roundMinutesUpToInterval(minutes) {
  return Math.ceil(minutes / TIMELINE_INTERVAL_MINUTES) * TIMELINE_INTERVAL_MINUTES
}

function getClampedStartMinutes(minutes, timelineStartMinutes, timelineEndMinutes) {
  return clamp(
    roundMinutesDownToInterval(minutes),
    timelineStartMinutes,
    timelineEndMinutes - TIMELINE_MIN_DURATION_MINUTES,
  )
}

function getPixelsFromDuration(minutes, hourHeight) {
  return (minutes / 60) * hourHeight
}

function getPixelsFromMinutes(minutes, timelineStartMinutes, hourHeight, edgePadding = 0) {
  return edgePadding + getPixelsFromDuration(minutes - timelineStartMinutes, hourHeight)
}

function getMinutesFromOffsetPixels(pixels, hourHeight) {
  return (pixels / hourHeight) * 60
}

function getMinutesFromPixels(pixels, timelineStartMinutes, hourHeight, edgePadding = 0) {
  return (
    timelineStartMinutes +
    getMinutesFromOffsetPixels(Math.max(pixels - edgePadding, 0), hourHeight)
  )
}

function buildTimelineHourMarkers(timelineStartMinutes, timelineEndMinutes) {
  const timelineVisibleDurationMinutes = timelineEndMinutes - timelineStartMinutes

  return Array.from(
    { length: timelineVisibleDurationMinutes / 60 + 1 },
    (_, index) => timelineStartMinutes + index * 60,
  )
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

  return (
    left.mode === right.mode &&
    left.dayOfWeek === right.dayOfWeek &&
    left.startMinutes === right.startMinutes &&
    left.endMinutes === right.endMinutes &&
    left.customerId === right.customerId &&
    left.entryId === right.entryId &&
    left.isValid === right.isValid
  )
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

function formatAssignmentCount(count) {
  return count === 1 ? '1 Einsatz' : `${count} Einsätze`
}

function getDragGhostLabel(mode, hasPreview) {
  if (mode === 'move') {
    return hasPreview ? 'Loslassen zum Verschieben' : 'Einsatz auf neue Zeit ziehen'
  }

  if (mode === 'resize') {
    return 'Unten ziehen, um die Dauer anzupassen'
  }

  return hasPreview ? 'Loslassen zum Einplanen' : 'In den Plan ziehen'
}

function getPreviewStatusLabel(mode) {
  if (mode === 'move') {
    return 'Verschieben'
  }

  if (mode === 'resize') {
    return 'Dauer'
  }

  return 'Neu'
}

function getPreviewActionLabel(mode) {
  if (mode === 'move') {
    return 'Loslassen zum Verschieben'
  }

  if (mode === 'resize') {
    return 'Loslassen zum Speichern'
  }

  return 'Loslassen zum Einplanen'
}

function getEntryLayout(
  startTime,
  endTime,
  shiftType,
  timelineStartMinutes,
  timelineEndMinutes,
  hourHeight,
  edgePadding,
) {
  const normalizedTimeRange = getDisplayTimeRangeForShift(startTime, endTime, shiftType)

  if (!normalizedTimeRange) {
    return null
  }

  const visibleStartMinutes = Math.max(normalizedTimeRange.startMinutes, timelineStartMinutes)
  const visibleEndMinutes = Math.min(normalizedTimeRange.endMinutes, timelineEndMinutes)
  const visibleDurationMinutes = Math.max(visibleEndMinutes - visibleStartMinutes, 0)

  return {
    startMinutes: normalizedTimeRange.startMinutes,
    endMinutes: normalizedTimeRange.endMinutes,
    visibleStartMinutes,
    visibleEndMinutes,
    visibleDurationMinutes,
    top: getPixelsFromMinutes(visibleStartMinutes, timelineStartMinutes, hourHeight, edgePadding),
    height: getPixelsFromDuration(visibleDurationMinutes, hourHeight),
    isTruncated:
      normalizedTimeRange.startMinutes < timelineStartMinutes ||
      normalizedTimeRange.endMinutes > timelineEndMinutes,
  }
}

function PlanningWorkspace({
  calendarWeek,
  customersAvailableForWidget,
  customers,
  customersById,
  dashboardWeekLabel,
  isSavingSchedule,
  hasScheduleConflict: checkScheduleConflict,
  onAddCustomerToWidget,
  onCalendarWeekChange,
  onCopyPreviousWeek,
  onCreateScheduleEntry,
  onDeleteScheduleEntry,
  onMoveScheduleEntry,
  onRemoveCustomerFromWidget,
  onYearChange,
  plannerId,
  plannerTitle,
  plannerViewSwitcher,
  scheduleDateRangeLabel,
  scheduleEntries,
  selectedEmployeeId,
  selectedEmployeeLabel,
  sidebarContent,
  shiftType,
  timelineEndMinutes,
  timelineStartMinutes,
  widgetCustomers,
  weekdays,
  year,
}) {
  const [interaction, setInteraction] = useState(null)
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false)
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 })
  const [previewPlacement, setPreviewPlacement] = useState(null)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  )
  const scrollAreaRef = useRef(null)
  const boardRef = useRef(null)
  const dragPointerRef = useRef({ x: 0, y: 0 })
  const autoScrollFrameRef = useRef(0)

  const scheduledAssignmentsCount = scheduleEntries.length
  const isPlannerInteractive = selectedEmployeeId !== null && !isSavingSchedule
  const activePreviewCustomer =
    previewPlacement?.customerId !== undefined
      ? customersById[previewPlacement.customerId] ?? null
      : interaction?.customerId !== undefined
        ? customersById[interaction.customerId] ?? null
        : null
  const canAddCustomersToWidget = customersAvailableForWidget.length > 0
  const isCustomerPickerVisible = isCustomerPickerOpen && canAddCustomersToWidget
  const fallbackTimelineBounds = getShiftTimelineBounds(shiftType)
  const resolvedTimelineStartMinutes =
    typeof timelineStartMinutes === 'number'
      ? timelineStartMinutes
      : fallbackTimelineBounds.startMinutes
  const rawTimelineEndMinutes =
    typeof timelineEndMinutes === 'number'
      ? timelineEndMinutes
      : fallbackTimelineBounds.endMinutes
  const resolvedTimelineEndMinutes =
    rawTimelineEndMinutes <= resolvedTimelineStartMinutes
      ? rawTimelineEndMinutes + 24 * 60
      : rawTimelineEndMinutes
  const timelineVisibleDurationMinutes =
    resolvedTimelineEndMinutes - resolvedTimelineStartMinutes
  const timelineHourMarkers = buildTimelineHourMarkers(
    resolvedTimelineStartMinutes,
    resolvedTimelineEndMinutes,
  )
  const entriesByDay = Object.fromEntries(
    weekdays.map((day) => [day, scheduleEntries.filter((entry) => getScheduleEntryDay(entry) === day)]),
  )
  const timelineMetrics = getTimelineMetrics(viewportWidth)
  const boardShellStyle = {
    '--planner-hour-height': `${timelineMetrics.hourHeight}px`,
    '--planner-board-height': `${getPixelsFromDuration(
      timelineVisibleDurationMinutes,
      timelineMetrics.hourHeight,
    ) + timelineMetrics.edgePadding * 2}px`,
    '--planner-time-axis-width': `${timelineMetrics.timeAxisWidth}px`,
    '--planner-entry-inset': `${timelineMetrics.entryInset}px`,
    '--planner-column-padding': `${timelineMetrics.columnPadding}px`,
    '--planner-header-height': `${timelineMetrics.headerHeight}px`,
    '--planner-max-height': `${timelineMetrics.maxHeight}px`,
    '--planner-edge-padding': `${timelineMetrics.edgePadding}px`,
    minWidth: `${timelineMetrics.timeAxisWidth + weekdays.length * timelineMetrics.dayMinWidth}px`,
  }
  const dayTrackStyle = {
    gridTemplateColumns: `repeat(${weekdays.length}, minmax(${timelineMetrics.dayMinWidth}px, 1fr))`,
  }
  const plannerRangeLabel = `${getTimeValueFromMinutes(
    resolvedTimelineStartMinutes,
  )}-${getTimeValueFromMinutes(resolvedTimelineEndMinutes)} Uhr`

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleWindowResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleWindowResize)
    return () => {
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [])

  const getAutoScrollDelta = (scrollElement, clientX, clientY) => {
    const scrollRect = scrollElement.getBoundingClientRect()
    let leftDelta = 0
    let topDelta = 0

    if (clientX < scrollRect.left + AUTO_SCROLL_EDGE && scrollElement.scrollLeft > 0) {
      leftDelta = -AUTO_SCROLL_STEP
    } else if (
      clientX > scrollRect.right - AUTO_SCROLL_EDGE &&
      scrollElement.scrollLeft < scrollElement.scrollWidth - scrollElement.clientWidth
    ) {
      leftDelta = AUTO_SCROLL_STEP
    }

    if (clientY < scrollRect.top + AUTO_SCROLL_EDGE && scrollElement.scrollTop > 0) {
      topDelta = -AUTO_SCROLL_STEP
    } else if (
      clientY > scrollRect.bottom - AUTO_SCROLL_EDGE &&
      scrollElement.scrollTop < scrollElement.scrollHeight - scrollElement.clientHeight
    ) {
      topDelta = AUTO_SCROLL_STEP
    }

    return {
      leftDelta,
      topDelta,
    }
  }

  const getWindowAutoScrollDelta = (clientY) => {
    if (typeof window === 'undefined') {
      return 0
    }

    const documentHeight = document.documentElement.scrollHeight
    const canScrollUp = window.scrollY > 0
    const canScrollDown = window.scrollY + window.innerHeight < documentHeight

    if (clientY < WINDOW_AUTO_SCROLL_EDGE && canScrollUp) {
      return -WINDOW_AUTO_SCROLL_STEP
    }

    if (clientY > window.innerHeight - WINDOW_AUTO_SCROLL_EDGE && canScrollDown) {
      return WINDOW_AUTO_SCROLL_STEP
    }

    return 0
  }

  const stopAutoScroll = useEffectEvent(() => {
    if (autoScrollFrameRef.current) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = 0
    }
  })

  const getPlacementPreviewFromPointer = (clientX, clientY) => {
    const boardElement = boardRef.current

    if (!boardElement) {
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

    const contentX = clientX - boardRect.left
    const contentY = clientY - boardRect.top
    const dayWidth = boardRect.width / weekdays.length
    const dayIndex = clamp(Math.floor(contentX / dayWidth), 0, weekdays.length - 1)

    return {
      dayOfWeek: weekdays[dayIndex],
      rawMinutes: clamp(
        getMinutesFromPixels(
          contentY,
          resolvedTimelineStartMinutes,
          timelineMetrics.hourHeight,
          timelineMetrics.edgePadding,
        ),
        resolvedTimelineStartMinutes,
        resolvedTimelineEndMinutes,
      ),
    }
  }

  const buildCreatePreview = (placement, currentInteraction) => {
    if (!placement) {
      return null
    }

    const startMinutes = getClampedStartMinutes(
      placement.rawMinutes,
      resolvedTimelineStartMinutes,
      resolvedTimelineEndMinutes,
    )
    const endMinutes = Math.min(
      startMinutes + TIMELINE_MIN_DURATION_MINUTES,
      resolvedTimelineEndMinutes,
    )
    const startTime = getTimeValueFromMinutes(startMinutes)
    const endTime = getTimeValueFromMinutes(endMinutes)

    return {
      mode: 'create',
      customerId: currentInteraction.customerId,
      dayOfWeek: placement.dayOfWeek,
      startMinutes,
      endMinutes,
      startTime,
      endTime,
      isValid: !checkScheduleConflict({
        dayOfWeek: placement.dayOfWeek,
        startTime,
        endTime,
        shiftType,
      }),
    }
  }

  const buildMovePreview = (placement, currentInteraction) => {
    if (!placement) {
      return null
    }

    const maxStartMinutes = Math.max(
      resolvedTimelineStartMinutes,
      Math.min(
        resolvedTimelineEndMinutes - TIMELINE_MIN_DURATION_MINUTES,
        resolvedTimelineEndMinutes - currentInteraction.durationMinutes,
      ),
    )
    const startMinutes = clamp(
      roundMinutesDownToInterval(placement.rawMinutes - currentInteraction.pointerOffsetMinutes),
      resolvedTimelineStartMinutes,
      maxStartMinutes,
    )
    const endMinutes = startMinutes + currentInteraction.durationMinutes
    const startTime = getTimeValueFromMinutes(startMinutes)
    const endTime = getTimeValueFromMinutes(endMinutes)

    return {
      mode: 'move',
      entryId: currentInteraction.entryId,
      customerId: currentInteraction.customerId,
      dayOfWeek: placement.dayOfWeek,
      startMinutes,
      endMinutes,
      startTime,
      endTime,
      isValid: !checkScheduleConflict({
        dayOfWeek: placement.dayOfWeek,
        startTime,
        endTime,
        ignoreEntryId: currentInteraction.entryId,
        shiftType,
      }),
    }
  }

  const buildResizePreview = (placement, currentInteraction) => {
    if (!placement) {
      return null
    }

    const endMinutes = clamp(
      Math.max(
        roundMinutesUpToInterval(placement.rawMinutes),
        currentInteraction.startMinutes + TIMELINE_MIN_DURATION_MINUTES,
      ),
      currentInteraction.startMinutes + TIMELINE_MIN_DURATION_MINUTES,
      resolvedTimelineEndMinutes,
    )
    const startTime = getTimeValueFromMinutes(currentInteraction.startMinutes)
    const endTime = getTimeValueFromMinutes(endMinutes)

    return {
      mode: 'resize',
      entryId: currentInteraction.entryId,
      customerId: currentInteraction.customerId,
      dayOfWeek: currentInteraction.dayOfWeek,
      startMinutes: currentInteraction.startMinutes,
      endMinutes,
      startTime,
      endTime,
      isValid: !checkScheduleConflict({
        dayOfWeek: currentInteraction.dayOfWeek,
        startTime,
        endTime,
        ignoreEntryId: currentInteraction.entryId,
        shiftType,
      }),
    }
  }

  const syncPreviewPlacement = useEffectEvent((clientX, clientY, interactionOverride = interaction) => {
    if (!interactionOverride?.dragActivated) {
      setPreviewPlacement(null)
      return
    }

    const placement = getPlacementPreviewFromPointer(clientX, clientY)
    let nextPreview = null

    if (interactionOverride.mode === 'create') {
      nextPreview = buildCreatePreview(placement, interactionOverride)
    } else if (interactionOverride.mode === 'move') {
      nextPreview = buildMovePreview(placement, interactionOverride)
    } else if (interactionOverride.mode === 'resize') {
      nextPreview = buildResizePreview(placement, interactionOverride)
    }

    setPreviewPlacement((currentPreview) =>
      isSamePreview(currentPreview, nextPreview) ? currentPreview : nextPreview,
    )
  })

  const runAutoScroll = useEffectEvent(function continueAutoScroll() {
    autoScrollFrameRef.current = 0

    if (!interaction?.dragActivated) {
      return
    }

    const scrollElement = scrollAreaRef.current
    if (!scrollElement) {
      return
    }

    const { x, y } = dragPointerRef.current
    const { leftDelta, topDelta } = getAutoScrollDelta(scrollElement, x, y)
    const windowTopDelta = topDelta === 0 ? getWindowAutoScrollDelta(y) : 0

    if (leftDelta === 0 && topDelta === 0 && windowTopDelta === 0) {
      return
    }

    scrollElement.scrollBy({
      left: leftDelta,
      top: topDelta,
    })

    if (windowTopDelta !== 0) {
      window.scrollBy({
        top: windowTopDelta,
      })
    }

    syncPreviewPlacement(x, y)
    autoScrollFrameRef.current = window.requestAnimationFrame(continueAutoScroll)
  })

  const maybeAutoScroll = useEffectEvent((clientX, clientY) => {
    dragPointerRef.current = {
      x: clientX,
      y: clientY,
    }

    const scrollElement = scrollAreaRef.current
    if (!scrollElement) {
      return
    }

    const { leftDelta, topDelta } = getAutoScrollDelta(scrollElement, clientX, clientY)
    const windowTopDelta = topDelta === 0 ? getWindowAutoScrollDelta(clientY) : 0

    if (leftDelta === 0 && topDelta === 0 && windowTopDelta === 0) {
      stopAutoScroll()
      return
    }

    if (!autoScrollFrameRef.current) {
      autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
    }
  })

  const handlePointerMove = useEffectEvent((event) => {
    if (!interaction) {
      return
    }

    dragPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
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

    let resolvedInteraction = interaction

    if (!interaction.dragActivated) {
      resolvedInteraction = {
        ...interaction,
        dragActivated: true,
      }

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
    syncPreviewPlacement(event.clientX, event.clientY, resolvedInteraction)
  })

  const handlePointerUp = useEffectEvent(() => {
    const activeInteraction = interaction
    const finalPreview = previewPlacement

    stopAutoScroll()
    setInteraction(null)
    setPreviewPlacement(null)

    if (!activeInteraction?.dragActivated || !finalPreview || isSavingSchedule) {
      return
    }

    if (activeInteraction.mode === 'create') {
      void (async () => {
        const wasCreated = await onCreateScheduleEntry({
          customerId: activeInteraction.customerId,
          dayOfWeek: finalPreview.dayOfWeek,
          startTime: finalPreview.startTime,
          endTime: finalPreview.endTime,
          shiftType,
        })

        if (wasCreated) {
          onRemoveCustomerFromWidget(activeInteraction.customerId)
        }
      })()
      return
    }

    if (
      activeInteraction.originalDayOfWeek === finalPreview.dayOfWeek &&
      activeInteraction.originalStartTime === finalPreview.startTime &&
      activeInteraction.originalEndTime === finalPreview.endTime
    ) {
      return
    }

    void onMoveScheduleEntry({
      entryId: activeInteraction.entryId,
      dayOfWeek: finalPreview.dayOfWeek,
      startTime: finalPreview.startTime,
      endTime: finalPreview.endTime,
      shiftType,
    })
  })

  useEffect(() => {
    if (!interaction) {
      return undefined
    }

    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor =
      interaction.mode === 'resize' ? 'ns-resize' : interaction.dragActivated ? 'grabbing' : 'default'

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      stopAutoScroll()
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

    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    dragPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
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

    const startTime = getScheduleEntryStartTime(entry)
    const endTime = getScheduleEntryEndTime(entry)
    const entryLayout = getEntryLayout(
      startTime,
      endTime,
      shiftType,
      resolvedTimelineStartMinutes,
      resolvedTimelineEndMinutes,
      timelineMetrics.hourHeight,
      timelineMetrics.edgePadding,
    )

    if (!entryLayout) {
      return
    }

    event.preventDefault()

    const entryRect = event.currentTarget.getBoundingClientRect()
    const pointerOffsetMinutes = clamp(
      getMinutesFromOffsetPixels(event.clientY - entryRect.top, timelineMetrics.hourHeight) +
        Math.max(entryLayout.visibleStartMinutes - entryLayout.startMinutes, 0),
      0,
      entryLayout.endMinutes - entryLayout.startMinutes,
    )

    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    dragPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    setInteraction({
      mode: 'move',
      entryId: entry.id,
      customerId: entry.customer_id,
      originalDayOfWeek: getScheduleEntryDay(entry),
      originalStartTime: startTime,
      originalEndTime: endTime,
      durationMinutes: roundMinutesUpToInterval(entryLayout.endMinutes - entryLayout.startMinutes),
      pointerOffsetMinutes,
      originX: event.clientX,
      originY: event.clientY,
      dragActivated: false,
    })
    setPreviewPlacement(null)
  }

  const handleResizePointerDown = (entry, event) => {
    if (event.button !== 0 || isSavingSchedule) {
      return
    }

    const startTime = getScheduleEntryStartTime(entry)
    const endTime = getScheduleEntryEndTime(entry)
    const entryLayout = getEntryLayout(
      startTime,
      endTime,
      shiftType,
      resolvedTimelineStartMinutes,
      resolvedTimelineEndMinutes,
      timelineMetrics.hourHeight,
      timelineMetrics.edgePadding,
    )

    if (!entryLayout) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    setPointerPosition({
      x: event.clientX,
      y: event.clientY,
    })
    dragPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    setInteraction({
      mode: 'resize',
      entryId: entry.id,
      customerId: entry.customer_id,
      dayOfWeek: getScheduleEntryDay(entry),
      startMinutes: entryLayout.startMinutes,
      originalDayOfWeek: getScheduleEntryDay(entry),
      originalStartTime: startTime,
      originalEndTime: endTime,
      originX: event.clientX,
      originY: event.clientY,
      dragActivated: true,
    })
    setPreviewPlacement({
      mode: 'resize',
      entryId: entry.id,
      customerId: entry.customer_id,
      dayOfWeek: getScheduleEntryDay(entry),
      startMinutes: entryLayout.startMinutes,
      endMinutes: entryLayout.endMinutes,
      startTime,
      endTime,
      isValid: true,
    })
  }

  const handleDeleteScheduleEntry = (entryId) => {
    void onDeleteScheduleEntry(entryId)
  }

  const livePreviewTimeRangeLabel = previewPlacement
    ? getScheduleTimeRangeLabel(previewPlacement.startTime, previewPlacement.endTime)
    : ''
  const livePreviewDurationLabel = previewPlacement
    ? formatDurationLabel(previewPlacement.startTime, previewPlacement.endTime)
    : ''
  const livePreviewMetaLabel = previewPlacement
    ? [previewPlacement.dayOfWeek, livePreviewTimeRangeLabel].filter(Boolean).join(' · ')
    : ''
  const livePreviewHintLabel = previewPlacement
    ? previewPlacement.isValid
      ? [livePreviewDurationLabel, getPreviewActionLabel(previewPlacement.mode)].filter(Boolean).join(' · ')
      : 'Zeitfenster bereits belegt'
    : interaction
      ? getDragGhostLabel(interaction.mode, false)
      : ''

  return (
    <section className="planning-workspace-layout" data-planner-layout={plannerId}>
      <section
        id={plannerId}
        className={`panel dashboard-widget schedule-widget${
          shiftType === 'night' ? ' schedule-widget-night' : ''
        }`}
        aria-label={plannerTitle}
      >
        <div className="widget-topline">
          <div>
            <h2>{plannerTitle}</h2>
            <p className="widget-note">
              {scheduleDateRangeLabel || 'Bitte eine gültige Kalenderwoche wählen.'}
            </p>
          </div>
          <div className="widget-topline-actions">
            {plannerViewSwitcher}
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
              onClick={() =>
                printSection(plannerId, {
                  pageStyle: '@page { size: A4 landscape; margin: 6mm; }',
                })
              }
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
          <div className="schedule-meta-chip">
            <span>Zeitraum</span>
            <strong>{plannerRangeLabel}</strong>
          </div>
          <div className="schedule-meta-chip schedule-meta-chip-week">
            <span>Woche</span>
            <strong>{dashboardWeekLabel}</strong>
            <div className="schedule-week-controls">
              <label className="schedule-week-field" htmlFor={`calendar-week-${plannerId}`}>
                <span>KW</span>
                <input
                  id={`calendar-week-${plannerId}`}
                  type="number"
                  min="1"
                  max="53"
                  inputMode="numeric"
                  value={calendarWeek}
                  onChange={(event) => onCalendarWeekChange(Number(event.target.value) || 0)}
                />
              </label>
              <label className="schedule-week-field" htmlFor={`year-${plannerId}`}>
                <span>Jahr</span>
                <input
                  id={`year-${plannerId}`}
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
          className={`planner-board${interaction?.dragActivated ? ' planner-board-interacting' : ''}`}
          style={boardShellStyle}
        >
          <div className="planner-scroll-area" ref={scrollAreaRef}>
            <div className="planner-grid-shell" style={boardShellStyle}>
              <div className="planner-grid-header">
                <div className="planner-corner-cell">
                  <span>Uhrzeit</span>
                </div>

                <div className="planner-day-header-track" style={dayTrackStyle}>
                  {weekdays.map((day) => (
                    <div
                      key={`${day}-header`}
                      className={`planner-day-header-cell${
                        previewPlacement?.dayOfWeek === day ? ' planner-day-header-cell-preview' : ''
                      }`}
                    >
                      <span>{day}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="planner-grid-body">
                <div className="planner-time-axis" aria-hidden="true">
                  {timelineHourMarkers.slice(0, -1).map((minutes) => (
                    <div
                      key={`timeline-hour-${minutes}`}
                      className="planner-time-axis-label"
                      style={{
                        top: `${
                          getPixelsFromMinutes(
                            minutes,
                            resolvedTimelineStartMinutes,
                            timelineMetrics.hourHeight,
                            timelineMetrics.edgePadding,
                          ) +
                          getPixelsFromDuration(60, timelineMetrics.hourHeight) / 2
                        }px`,
                      }}
                    >
                      <span>{getTimeValueFromMinutes(minutes)}</span>
                    </div>
                  ))}
                </div>

                <div className="planner-day-columns" ref={boardRef} style={dayTrackStyle}>
                  {weekdays.map((day) => {
                    const dayEntries = entriesByDay[day] ?? []
                    const dayPreview = previewPlacement?.dayOfWeek === day ? previewPlacement : null
                    const dayPreviewTop = dayPreview
                      ? getPixelsFromMinutes(
                          dayPreview.startMinutes,
                          resolvedTimelineStartMinutes,
                          timelineMetrics.hourHeight,
                          timelineMetrics.edgePadding,
                        )
                      : 0
                    const dayPreviewEndTop = dayPreview
                      ? getPixelsFromMinutes(
                          Math.min(dayPreview.endMinutes, resolvedTimelineEndMinutes),
                          resolvedTimelineStartMinutes,
                          timelineMetrics.hourHeight,
                          timelineMetrics.edgePadding,
                        )
                      : 0
                    const dayPreviewHeight = dayPreview
                      ? getPixelsFromDuration(
                        Math.max(
                            Math.min(dayPreview.endMinutes, resolvedTimelineEndMinutes) -
                              dayPreview.startMinutes,
                            0,
                          ),
                          timelineMetrics.hourHeight,
                        )
                      : 0

                    return (
                      <section
                        key={day}
                        className={`planner-day-column${
                          dayPreview ? ' planner-day-column-preview' : ''
                        }`}
                        aria-label={day}
                      >
                        <div className="planner-day-column-surface">
                          {dayEntries.map((entry) => {
                            const customer = customersById[entry.customer_id]
                            const startTime = getScheduleEntryStartTime(entry)
                            const endTime = getScheduleEntryEndTime(entry)
                            const entryLayout = getEntryLayout(
                              startTime,
                              endTime,
                              shiftType,
                              resolvedTimelineStartMinutes,
                              resolvedTimelineEndMinutes,
                              timelineMetrics.hourHeight,
                              timelineMetrics.edgePadding,
                            )

                            if (!entryLayout || entryLayout.height <= 0) {
                              return null
                            }

                            const durationLabel = formatDurationLabel(startTime, endTime)
                            const timeRangeLabel = getScheduleTimeRangeLabel(startTime, endTime)
                            const isMovingEntry =
                              interaction?.mode === 'move' && interaction.entryId === entry.id
                            const isResizingEntry =
                              interaction?.mode === 'resize' && interaction.entryId === entry.id
                            const isCompactEntry = entryLayout.visibleDurationMinutes <= 45
                            const isShortEntry = entryLayout.visibleDurationMinutes <= 60

                            return (
                              <article
                                key={entry.id}
                                className={`planner-entry-card${
                                  isMovingEntry || isResizingEntry ? ' planner-entry-card-moving' : ''
                                }${isCompactEntry ? ' planner-entry-card-compact' : ''}${
                                  isShortEntry ? ' planner-entry-card-short' : ''
                                }`}
                                style={{
                                  top: `${entryLayout.top}px`,
                                  height: `${entryLayout.height}px`,
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
                                  ) : (
                                    <span className="planner-entry-chip">Einsatz</span>
                                  )}
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

                                <strong className="planner-entry-name">
                                  {customer?.name ?? `Kunde #${entry.customer_id}`}
                                </strong>
                                <span className="planner-entry-time">{timeRangeLabel}</span>
                                {!isCompactEntry && customer?.address ? (
                                  <span className="planner-entry-address">{customer.address}</span>
                                ) : null}
                                {entryLayout.isTruncated ? (
                                  <span className="planner-entry-overflow-note">
                                    außerhalb {plannerRangeLabel}
                                  </span>
                                ) : null}

                                <button
                                  type="button"
                                  className="planner-entry-resize-handle"
                                  aria-label="Einsatzdauer ziehen"
                                  onPointerDown={(event) => handleResizePointerDown(entry, event)}
                                >
                                  <span />
                                </button>
                              </article>
                            )
                          })}

                          {dayPreview ? (
                            <>
                              <div
                                className={`planner-preview-guide${
                                  dayPreview.isValid ? '' : ' planner-preview-guide-invalid'
                                }`}
                                style={{
                                  top: `${dayPreviewTop}px`,
                                }}
                              />
                              <div
                                className={`planner-preview-guide${
                                  dayPreview.isValid ? '' : ' planner-preview-guide-invalid'
                                }`}
                                style={{
                                  top: `${dayPreviewEndTop}px`,
                                }}
                              />
                              <article
                                className={`planner-entry-preview${
                                  dayPreview.isValid ? '' : ' planner-entry-preview-invalid'
                                }`}
                                style={{
                                  top: `${dayPreviewTop}px`,
                                  height: `${dayPreviewHeight}px`,
                                  backgroundColor: activePreviewCustomer?.color ?? '#2563eb',
                                  color: getReadableTextColor(activePreviewCustomer?.color ?? '#2563eb'),
                                }}
                              >
                                <div className="planner-entry-topline">
                                  <span className="planner-entry-chip">
                                    {getPreviewStatusLabel(dayPreview.mode)}
                                  </span>
                                  <span className="planner-entry-time">
                                    {getScheduleTimeRangeLabel(dayPreview.startTime, dayPreview.endTime)}
                                  </span>
                                </div>
                                <strong className="planner-entry-name">
                                  {activePreviewCustomer?.name ?? 'Einsatz'}
                                </strong>
                                {activePreviewCustomer?.address ? (
                                  <span className="planner-entry-address">
                                    {activePreviewCustomer.address}
                                  </span>
                                ) : null}
                                <span className="planner-entry-preview-note">
                                  {dayPreview.isValid
                                    ? `${formatDurationLabel(dayPreview.startTime, dayPreview.endTime)} geplant`
                                    : 'Zeitfenster bereits belegt'}
                                </span>
                              </article>
                            </>
                          ) : null}

                        </div>
                      </section>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {selectedEmployeeId === null ? (
            <div className="planner-overlay-message">
              <strong>Mitarbeiter auswählen</strong>
              <span>Danach Kunden in die Zeitleiste ziehen und die Dauer nach unten aufziehen.</span>
            </div>
          ) : null}

          {interaction?.dragActivated ? (
            <div
              className={`planner-live-panel${
                previewPlacement?.isValid === false ? ' planner-live-panel-invalid' : ''
              }`}
            >
              <strong>{activePreviewCustomer?.name ?? 'Einsatz'}</strong>
              <span>{livePreviewMetaLabel || 'Über den Wochenplan ziehen'}</span>
              <span>{livePreviewHintLabel}</span>
            </div>
          ) : null}

          {interaction?.dragActivated && !previewPlacement ? (
            <div
              className="planner-drag-ghost"
              style={{
                transform: `translate(${pointerPosition.x + 18}px, ${pointerPosition.y + 18}px)`,
                backgroundColor: activePreviewCustomer?.color ?? '#2563eb',
                color: getReadableTextColor(activePreviewCustomer?.color ?? '#2563eb'),
              }}
            >
              <strong>{activePreviewCustomer?.name ?? 'Einsatz'}</strong>
              <span>{getDragGhostLabel(interaction.mode, Boolean(previewPlacement))}</span>
            </div>
          ) : null}
        </div>

        <div className="planner-print-sheet" aria-hidden="true">
          <header className="planner-print-header">
            <strong className="planner-print-title">{plannerTitle}</strong>
            <div className="planner-print-meta">
              <span>
                <strong>Mitarbeiter</strong> {selectedEmployeeLabel}
              </span>
              <span>
                <strong>Woche</strong> {dashboardWeekLabel}
              </span>
              <span>
                <strong>Datum</strong> {scheduleDateRangeLabel || '-'}
              </span>
              <span>
                <strong>Einsätze</strong> {String(scheduledAssignmentsCount).padStart(2, '0')}
              </span>
            </div>
          </header>

          {selectedEmployeeId !== null ? (
            <table className="planner-print-table">
              <colgroup>
                <col className="planner-print-col-employee" />
                {weekdays.map((day) => (
                  <col key={`planner-print-col-${day}`} className="planner-print-col-day" />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th scope="col">Mitarbeiter</th>
                  {weekdays.map((day) => {
                    const dayEntries = entriesByDay[day] ?? []

                    return (
                      <th key={`planner-print-head-${day}`} scope="col">
                        <div className="planner-print-day-heading">
                          <span className="planner-print-day-label">{day}</span>
                          <span className="planner-print-day-count">
                            {String(dayEntries.length).padStart(2, '0')} geplant
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                <tr>
                  <th scope="row" className="planner-print-employee-cell">
                    <strong>{selectedEmployeeLabel}</strong>
                    <span>{formatAssignmentCount(scheduledAssignmentsCount)} in dieser Woche</span>
                  </th>

                  {weekdays.map((day) => {
                    const dayEntries = entriesByDay[day] ?? []

                    return (
                      <td key={`planner-print-cell-${day}`} className="planner-print-cell">
                        {dayEntries.length > 0 ? (
                          <div className="planner-print-assignment-list">
                            {dayEntries.map((entry) => {
                              const customer = customersById[entry.customer_id]
                              const startTime = getScheduleEntryStartTime(entry)
                              const endTime = getScheduleEntryEndTime(entry)
                              const timeRangeLabel = getScheduleTimeRangeLabel(startTime, endTime)

                              return (
                                <article
                                  key={`planner-print-entry-${entry.id}`}
                                  className="planner-print-assignment"
                                  style={{
                                    '--planner-print-accent': customer?.color ?? '#334155',
                                  }}
                                >
                                  <span className="planner-print-assignment-time">
                                    {timeRangeLabel}
                                  </span>
                                  <strong>{customer?.name ?? `Kunde #${entry.customer_id}`}</strong>
                                  {customer?.address ? <span>{customer.address}</span> : null}
                                </article>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="planner-print-empty">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="planner-print-placeholder">
              <strong>Kein Mitarbeiter ausgewählt</strong>
              <span>Für den Ausdruck zuerst einen Mitarbeiter wählen.</span>
            </div>
          )}
        </div>
      </section>

      <div className="planning-workspace-sidebar">
        {sidebarContent}

        <section
          id={`${plannerId}-kunden-widget`}
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
                    <span className="customer-card-action">In Plan ziehen</span>
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
