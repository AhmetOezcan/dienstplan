export const MINUTES_PER_DAY = 24 * 60

export function getTimeValueInMinutes(timeValue) {
  if (typeof timeValue !== 'string') {
    return null
  }

  const [hoursValue, minutesValue] = timeValue.split(':')
  const hours = Number.parseInt(hoursValue ?? '', 10)
  const minutes = Number.parseInt(minutesValue ?? '', 10)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return hours * 60 + minutes
}

export function getNormalizedTimeRange(startTime, endTime) {
  const startMinutes = getTimeValueInMinutes(startTime)
  const endMinutes = getTimeValueInMinutes(endTime)

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return null
  }

  return {
    startMinutes,
    endMinutes: endMinutes <= startMinutes ? endMinutes + MINUTES_PER_DAY : endMinutes,
    isOvernight: endMinutes <= startMinutes,
  }
}

export function isWholeHourTimeValue(timeValue) {
  const minutes = getTimeValueInMinutes(timeValue)

  return minutes !== null && minutes % 60 === 0
}

export function isWholeHourTimeRange(startTime, endTime) {
  const normalizedTimeRange = getNormalizedTimeRange(startTime, endTime)

  if (!normalizedTimeRange) {
    return false
  }

  return isWholeHourTimeValue(startTime) && isWholeHourTimeValue(endTime)
}

export function isHalfHourTimeValue(timeValue) {
  const minutes = getTimeValueInMinutes(timeValue)

  return minutes !== null && minutes % 30 === 0
}

export function isHalfHourTimeRange(startTime, endTime) {
  const normalizedTimeRange = getNormalizedTimeRange(startTime, endTime)

  if (!normalizedTimeRange) {
    return false
  }

  return isHalfHourTimeValue(startTime) && isHalfHourTimeValue(endTime)
}

export function getDurationHoursBetweenTimes(startTime, endTime) {
  const normalizedTimeRange = getNormalizedTimeRange(startTime, endTime)

  if (!normalizedTimeRange) {
    return 0
  }

  return (normalizedTimeRange.endMinutes - normalizedTimeRange.startMinutes) / 60
}

export function getScheduleIntervalBounds(dayOfWeek, startTime, endTime, weekdayNumberByName) {
  const weekdayNumber = weekdayNumberByName?.[dayOfWeek]
  const normalizedTimeRange = getNormalizedTimeRange(startTime, endTime)

  if (!weekdayNumber || !normalizedTimeRange) {
    return null
  }

  const dayOffset = (weekdayNumber - 1) * MINUTES_PER_DAY

  return {
    start: dayOffset + normalizedTimeRange.startMinutes,
    end: dayOffset + normalizedTimeRange.endMinutes,
    isOvernight: normalizedTimeRange.isOvernight,
  }
}

export function getScheduleTimeRangeLabel(startTime, endTime) {
  const normalizedTimeRange = getNormalizedTimeRange(startTime, endTime)

  if (!normalizedTimeRange) {
    return startTime && endTime ? `${startTime} - ${endTime}` : ''
  }

  return normalizedTimeRange.isOvernight
    ? `${startTime} - ${endTime} (+1)`
    : `${startTime} - ${endTime}`
}
