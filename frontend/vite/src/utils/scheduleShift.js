import { MINUTES_PER_DAY, getNormalizedTimeRange, getTimeValueInMinutes } from './scheduleTime'

export const SCHEDULE_SHIFT_TYPES = {
  DAY: 'day',
  NIGHT: 'night',
}

export const DAY_SHIFT_START_MINUTES = 6 * 60
export const DAY_SHIFT_END_MINUTES = 21 * 60
export const NIGHT_SHIFT_START_MINUTES = 19 * 60
export const NIGHT_SHIFT_END_MINUTES = 9 * 60

export function normalizeScheduleShiftType(value) {
  return value === SCHEDULE_SHIFT_TYPES.NIGHT ? SCHEDULE_SHIFT_TYPES.NIGHT : SCHEDULE_SHIFT_TYPES.DAY
}

export function getScheduleEntryShiftType(entry) {
  return normalizeScheduleShiftType(entry?.shift_type)
}

export function getScheduleEntryStartTime(entry) {
  if (entry?.time) {
    return entry.time
  }

  return entry?.start_time?.slice(0, 5) ?? ''
}

export function getScheduleEntryEndTime(entry) {
  return entry?.end_time?.slice(0, 5) ?? ''
}

function parseIsoDate(dateValue) {
  if (typeof dateValue !== 'string') {
    return null
  }

  const [yearValue, monthValue, dayValue] = dateValue.split('-')
  const year = Number.parseInt(yearValue ?? '', 10)
  const month = Number.parseInt(monthValue ?? '', 10)
  const day = Number.parseInt(dayValue ?? '', 10)

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null
  }

  return new Date(Date.UTC(year, month - 1, day))
}

function formatIsoDate(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysToIsoDate(dateValue, dayCount) {
  const date = parseIsoDate(dateValue)
  if (!date || !Number.isInteger(dayCount)) {
    return ''
  }

  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + dayCount)
  return formatIsoDate(nextDate)
}

export function getShiftTimelineBounds(shiftType) {
  const normalizedShiftType = normalizeScheduleShiftType(shiftType)

  if (normalizedShiftType === SCHEDULE_SHIFT_TYPES.NIGHT) {
    return {
      startMinutes: NIGHT_SHIFT_START_MINUTES,
      endMinutes: NIGHT_SHIFT_END_MINUTES + MINUTES_PER_DAY,
    }
  }

  return {
    startMinutes: DAY_SHIFT_START_MINUTES,
    endMinutes: DAY_SHIFT_END_MINUTES,
  }
}

export function getTimeValueFromMinutes(minutes) {
  const normalizedMinutes = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours = Math.floor(normalizedMinutes / 60)
  const remainingMinutes = normalizedMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`
}

export function getShiftAnchorIsoDate(dateValue, startTime, shiftType) {
  const normalizedShiftType = normalizeScheduleShiftType(shiftType)
  if (normalizedShiftType !== SCHEDULE_SHIFT_TYPES.NIGHT) {
    return dateValue
  }

  const startMinutes = getTimeValueInMinutes(startTime)
  if (startMinutes === null || startMinutes >= NIGHT_SHIFT_START_MINUTES) {
    return dateValue
  }

  return addDaysToIsoDate(dateValue, -1)
}

export function getShiftActualIsoDate(anchorDateValue, startTime, shiftType) {
  const normalizedShiftType = normalizeScheduleShiftType(shiftType)
  if (normalizedShiftType !== SCHEDULE_SHIFT_TYPES.NIGHT) {
    return anchorDateValue
  }

  const startMinutes = getTimeValueInMinutes(startTime)
  if (startMinutes === null || startMinutes >= NIGHT_SHIFT_START_MINUTES) {
    return anchorDateValue
  }

  return addDaysToIsoDate(anchorDateValue, 1)
}

export function getPlannerDayOfWeekForEntry(entry, weekdays) {
  const entryDate = entry?.date ?? ''
  const startTime = getScheduleEntryStartTime(entry)
  const anchorDate = getShiftAnchorIsoDate(entryDate, startTime, getScheduleEntryShiftType(entry))
  const anchorDateObject = parseIsoDate(anchorDate)

  if (!anchorDateObject || !Array.isArray(weekdays) || weekdays.length === 0) {
    return entry?.day_of_week ?? entry?.day ?? ''
  }

  const weekdayIndex = (anchorDateObject.getUTCDay() + 6) % 7
  return weekdays[weekdayIndex] ?? ''
}

export function getDisplayTimeRangeForShift(startTime, endTime, shiftType) {
  const normalizedTimeRange = getNormalizedTimeRange(startTime, endTime)

  if (!normalizedTimeRange) {
    return null
  }

  const timelineBounds = getShiftTimelineBounds(shiftType)
  let startMinutes = normalizedTimeRange.startMinutes
  let endMinutes = normalizedTimeRange.endMinutes

  if (
    timelineBounds.endMinutes > MINUTES_PER_DAY &&
    normalizedTimeRange.startMinutes < timelineBounds.startMinutes
  ) {
    startMinutes += MINUTES_PER_DAY
    endMinutes += MINUTES_PER_DAY
  }

  return {
    startMinutes,
    endMinutes,
  }
}

export function getScheduleIntervalBoundsFromDate(dateValue, startTime, endTime) {
  const date = parseIsoDate(dateValue)
  const normalizedTimeRange = getNormalizedTimeRange(startTime, endTime)

  if (!date || !normalizedTimeRange) {
    return null
  }

  const startOfDayMinutes = date.getTime() / 60000

  return {
    start: startOfDayMinutes + normalizedTimeRange.startMinutes,
    end: startOfDayMinutes + normalizedTimeRange.endMinutes,
  }
}
