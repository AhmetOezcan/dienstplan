import { useEffect, useRef, useState } from 'react'
import './App.css'
import LandingPage from './components/LandingPage'
import PlanningWorkspace from './components/PlanningWorkspace'
import WeeklyOverviewWidget from './components/WeeklyOverviewWidget'
import {
  getDurationHoursBetweenTimes,
  getNormalizedTimeRange,
  isHalfHourTimeRange,
} from './utils/scheduleTime'
import {
  DAY_SHIFT_END_MINUTES,
  DAY_SHIFT_START_MINUTES,
  NIGHT_SHIFT_END_MINUTES,
  NIGHT_SHIFT_START_MINUTES,
  SCHEDULE_SHIFT_TYPES,
  getPlannerDayOfWeekForEntry,
  getScheduleEntryEndTime as getScheduleEntryEndTimeValue,
  getScheduleEntryShiftType as getScheduleEntryShiftTypeValue,
  getScheduleEntryStartTime as getScheduleEntryStartTimeValue,
  getScheduleIntervalBoundsFromDate,
  getShiftActualIsoDate,
  getShiftAnchorIsoDate,
  normalizeScheduleShiftType,
} from './utils/scheduleShift'
import { buildFeedbackPublicUrl, buildFeedbackQrCodeUrl } from './utils/feedbackPublic'

const weekdays = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
]
const weekdayNumberByName = Object.fromEntries(weekdays.map((day, index) => [day, index + 1]))
const CUSTOMER_COLOR_OPTIONS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#b91c1c',
  '#c2410c',
  '#b45309',
  '#a16207',
  '#4d7c0f',
  '#15803d',
  '#047857',
  '#0f766e',
  '#0e7490',
  '#0369a1',
  '#2563eb',
  '#4338ca',
  '#6d28d9',
  '#7e22ce',
  '#a21caf',
  '#be185d',
  '#be123c',
  '#7f1d1d',
  '#9a3412',
  '#92400e',
  '#713f12',
  '#365314',
  '#166534',
  '#065f46',
  '#115e59',
  '#155e75',
  '#1e40af',
  '#312e81',
  '#581c87',
  '#701a75',
  '#831843',
  '#334155',
  '#64748b',
]
const LOCAL_API_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

function normalizeApiBaseUrl(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().replace(/\/+$/, '')
}

function getDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  return LOCAL_API_HOSTNAMES.has(window.location.hostname) ? 'http://localhost:8000' : '/api'
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) || getDefaultApiBaseUrl()
const AUTH_STORAGE_KEY = 'dienstplan_auth_session'
const CUSTOMER_WIDGET_STORAGE_KEY_PREFIX = 'dienstplan_customer_widget_ids'

function createEmptyAuthSession() {
  return {
    accessToken: '',
    user: null,
    account: null,
    membershipRole: '',
  }
}

function getStoredAuthSession() {
  if (typeof window === 'undefined') {
    return createEmptyAuthSession()
  }

  try {
    const storedValue = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!storedValue) {
      return createEmptyAuthSession()
    }

    const parsedValue = JSON.parse(storedValue)

    if (
      typeof parsedValue?.accessToken !== 'string' ||
      !parsedValue?.user ||
      typeof parsedValue.user.id !== 'number'
    ) {
      return createEmptyAuthSession()
    }

    return {
      accessToken: parsedValue.accessToken,
      user: parsedValue.user,
      account:
        parsedValue?.account && typeof parsedValue.account.id === 'number' ? parsedValue.account : null,
      membershipRole:
        typeof parsedValue?.membershipRole === 'string' ? parsedValue.membershipRole : '',
    }
  } catch {
    return createEmptyAuthSession()
  }
}

function persistAuthSession(session) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

function clearStoredAuthSession() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

function getCustomerWidgetStorageKey(accountId, userId) {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return null
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    return null
  }

  return `${CUSTOMER_WIDGET_STORAGE_KEY_PREFIX}_${accountId}_${userId}`
}

function normalizeCustomerWidgetCustomerIds(customerIds) {
  if (!Array.isArray(customerIds)) {
    return []
  }

  return [...new Set(customerIds.filter((customerId) => Number.isInteger(customerId) && customerId > 0))]
}

function getStoredCustomerWidgetCustomerIdsByKey(storageKey) {
  if (typeof window === 'undefined' || !storageKey) {
    return []
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey)
    if (!storedValue) {
      return []
    }

    return normalizeCustomerWidgetCustomerIds(JSON.parse(storedValue))
  } catch {
    return []
  }
}

function persistCustomerWidgetCustomerIdsByKey(storageKey, customerIds) {
  if (typeof window === 'undefined' || !storageKey) {
    return
  }

  const normalizedCustomerIds = normalizeCustomerWidgetCustomerIds(customerIds)

  if (normalizedCustomerIds.length === 0) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(normalizedCustomerIds))
}

function createInitialLoginForm() {
  return {
    email: '',
    password: '',
  }
}

function createInitialSetupForm(fullName = '') {
  return {
    fullName: fullName ?? '',
    newPassword: '',
    confirmPassword: '',
  }
}

function createInitialEmployeeForm() {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    notes: '',
  }
}

function createInitialCustomerForm() {
  return {
    name: '',
    address: '',
    notes: '',
  }
}

function getRandomCustomerColor(customers) {
  const unusedColors = CUSTOMER_COLOR_OPTIONS.filter(
    (color) => !customers.some((customer) => customer.color === color),
  )
  const availableColors = unusedColors.length > 0 ? unusedColors : CUSTOMER_COLOR_OPTIONS
  const randomIndex = Math.floor(Math.random() * availableColors.length)
  return availableColors[randomIndex]
}

function formatShortDate(date) {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = date.toLocaleString('de-AT', {
    month: 'long',
    timeZone: 'UTC',
  })
  return `${day}. ${month}`
}

function formatIsoDate(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getIsoCalendarWeekState(date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const isoDayNumber = utcDate.getUTCDay() || 7

  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - isoDayNumber)

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const dayOfYear = Math.floor((utcDate - yearStart) / 86400000) + 1

  return {
    year: utcDate.getUTCFullYear(),
    calendarWeek: Math.ceil(dayOfYear / 7),
  }
}

function getCurrentCalendarWeekState() {
  return getIsoCalendarWeekState(new Date())
}

function getPreviousCalendarWeekState(year, calendarWeek) {
  const weekStart = getStartDateOfIsoWeek(year, calendarWeek)
  if (!weekStart) {
    return null
  }

  const previousWeekDate = new Date(weekStart)
  previousWeekDate.setUTCDate(previousWeekDate.getUTCDate() - 7)
  return getIsoCalendarWeekState(previousWeekDate)
}

function formatCurrentDateLabel(date) {
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function getGreetingName(name) {
  if (typeof name !== 'string') {
    return ''
  }

  const trimmedName = name.trim()

  if (!trimmedName) {
    return ''
  }

  return trimmedName.split(/\s+/)[0] ?? trimmedName
}

const INITIAL_CALENDAR_STATE = getCurrentCalendarWeekState()
const APP_NAME = 'Ordo Cloud'
const PRIMARY_DASHBOARD_NAV_ITEMS = [
  { section: 'schedule', label: 'Dienstplan' },
  { section: 'employees', label: 'Mitarbeiter' },
  { section: 'customers', label: 'Kunden' },
]
const LEGAL_DROPDOWN_ITEMS = [
  { section: 'legal-imprint', label: 'Impressum' },
  { section: 'legal-privacy', label: 'Datenschutz' },
  { section: 'legal-cookies', label: 'Cookies' },
]
const SCHEDULE_PLANNER_CONFIGS = [
  {
    plannerId: 'dienstplan-widget',
    plannerTitle: 'Dienstplan',
    shiftType: SCHEDULE_SHIFT_TYPES.DAY,
    timelineStartMinutes: DAY_SHIFT_START_MINUTES,
    timelineEndMinutes: DAY_SHIFT_END_MINUTES,
  },
  {
    plannerId: 'nachtdienst-widget',
    plannerTitle: 'Nachtdienst',
    shiftType: SCHEDULE_SHIFT_TYPES.NIGHT,
    timelineStartMinutes: NIGHT_SHIFT_START_MINUTES,
    timelineEndMinutes: NIGHT_SHIFT_END_MINUTES,
  },
]

function isLegalDashboardSection(section) {
  return LEGAL_DROPDOWN_ITEMS.some((item) => item.section === section)
}

function getStartDateOfIsoWeek(year, calendarWeek) {
  if (!Number.isInteger(year) || !Number.isInteger(calendarWeek) || calendarWeek < 1 || calendarWeek > 53) {
    return null
  }

  const januaryFourth = new Date(Date.UTC(year, 0, 4))
  const januaryFourthDay = januaryFourth.getUTCDay() || 7
  const mondayOfFirstWeek = new Date(januaryFourth)
  mondayOfFirstWeek.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + 1)

  const weekStart = new Date(mondayOfFirstWeek)
  weekStart.setUTCDate(mondayOfFirstWeek.getUTCDate() + (calendarWeek - 1) * 7)

  return weekStart
}

function getIsoDateForWeekday(year, calendarWeek, day) {
  const weekStart = getStartDateOfIsoWeek(year, calendarWeek)
  const weekdayNumber = weekdayNumberByName[day]

  if (!weekStart || !weekdayNumber) {
    return ''
  }

  const targetDate = new Date(weekStart)
  targetDate.setUTCDate(weekStart.getUTCDate() + weekdayNumber - 1)

  return formatIsoDate(targetDate)
}

function isIsoDateInCalendarWeek(dateValue, year, calendarWeek) {
  if (typeof dateValue !== 'string') {
    return false
  }

  const weekStart = getStartDateOfIsoWeek(year, calendarWeek)
  if (!weekStart) {
    return false
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  return dateValue >= formatIsoDate(weekStart) && dateValue <= formatIsoDate(weekEnd)
}

function isScheduleEntryInCalendarWeek(entry, year, calendarWeek) {
  return isIsoDateInCalendarWeek(getScheduleEntryAnchorDate(entry), year, calendarWeek)
}

function getScheduleDateForPlannerPlacement(year, calendarWeek, dayOfWeek, startTime, shiftType) {
  const anchorDate = getIsoDateForWeekday(year, calendarWeek, dayOfWeek)

  if (!anchorDate) {
    return ''
  }

  return getShiftActualIsoDate(anchorDate, startTime, shiftType)
}

function getCalendarWeekDateRangeLabel(year, calendarWeek) {
  const weekStart = getStartDateOfIsoWeek(year, calendarWeek)
  if (!weekStart) {
    return ''
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  return `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`
}

async function apiRequest(path, options = {}) {
  const { accessToken, headers, ...fetchOptions } = options
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: requestHeaders,
  })

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? payload.detail
        : `API request failed with status ${response.status}`

    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return payload
}

function getEmployeeDisplayName(employee) {
  if (!employee) {
    return ''
  }

  if (employee.name) {
    return employee.name
  }

  return [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim()
}

function getScheduleEntryDate(entry) {
  return entry.date ?? ''
}

function getScheduleEntryShiftType(entry) {
  return getScheduleEntryShiftTypeValue(entry)
}

function getScheduleEntryStartTime(entry) {
  return getScheduleEntryStartTimeValue(entry)
}

function getScheduleEntryEndTime(entry) {
  return getScheduleEntryEndTimeValue(entry)
}

function getScheduleEntryAnchorDate(entry) {
  return getShiftAnchorIsoDate(
    getScheduleEntryDate(entry),
    getScheduleEntryStartTime(entry),
    getScheduleEntryShiftType(entry),
  )
}

function sortEmployees(items) {
  return [...items].sort((left, right) =>
    getEmployeeDisplayName(left).localeCompare(getEmployeeDisplayName(right), 'de'),
  )
}

function sortCustomers(items) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, 'de'))
}

function sortScheduleEntries(items) {
  return [...items].sort((left, right) => {
    const dateDiff = getScheduleEntryDate(left).localeCompare(getScheduleEntryDate(right), 'de')
    if (dateDiff !== 0) {
      return dateDiff
    }

    return getScheduleEntryStartTime(left).localeCompare(getScheduleEntryStartTime(right), 'de')
  })
}

function getScheduleEntryDurationHours(entry) {
  return getDurationHoursBetweenTimes(getScheduleEntryStartTime(entry), getScheduleEntryEndTime(entry))
}

const HOURS_CHART_BAR_COLORS = [
  '#ff1a12',
  '#3198df',
  '#aacd85',
  '#ffe390',
  '#e67be8',
  '#f4b56a',
  '#7fc5ef',
  '#84c2a0',
]

function formatHourValue(hours) {
  const normalizedHours = Math.round(hours * 10) / 10
  return new Intl.NumberFormat('de-AT', {
    minimumFractionDigits: Number.isInteger(normalizedHours) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(normalizedHours)
}

function formatHourCount(hours) {
  return `${formatHourValue(hours)} Std.`
}

function getHoursChartScale() {
  const chartMaximum = 40
  const tickStep = 10

  return {
    chartMaximum,
    yAxisTickValues: Array.from({ length: chartMaximum / tickStep + 1 }, (_, index) => index * tickStep)
      .reverse(),
  }
}

function getCompactEmployeeLabel(label) {
  if (typeof label !== 'string') {
    return ''
  }

  const trimmedLabel = label.trim()
  if (!trimmedLabel) {
    return ''
  }

  const firstSegment = trimmedLabel.split(/\s+/)[0] ?? trimmedLabel
  return firstSegment.length > 7 ? `${firstSegment.slice(0, 6)}…` : firstSegment
}

function formatFeedbackTimestamp(timestampValue) {
  if (typeof timestampValue !== 'string' || !timestampValue) {
    return ''
  }

  const timestamp = new Date(timestampValue)
  if (Number.isNaN(timestamp.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function getFeedbackQrFileName(accountName) {
  if (typeof accountName !== 'string' || !accountName.trim()) {
    return 'feedback-qr-code.png'
  }

  const normalizedAccountName = accountName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${normalizedAccountName || 'feedback'}-qr-code.png`
}

function WeeklyHoursWidget({
  dashboardWeekLabel,
  employees,
  scheduleEntries,
  selectedEmployeeId,
}) {
  const hoursByEmployeeId = {}
  const assignmentsByEmployeeId = {}

  scheduleEntries.forEach((entry) => {
    const durationHours = getScheduleEntryDurationHours(entry)
    const employeeId = entry.employee_id

    hoursByEmployeeId[employeeId] = (hoursByEmployeeId[employeeId] ?? 0) + durationHours
    assignmentsByEmployeeId[employeeId] = (assignmentsByEmployeeId[employeeId] ?? 0) + 1
  })

  const chartItems = employees
    .map((employee) => {
      const totalHours = hoursByEmployeeId[employee.id] ?? 0
      const assignmentCount = assignmentsByEmployeeId[employee.id] ?? 0

      return {
        employeeId: employee.id,
        label: getEmployeeDisplayName(employee),
        totalHours,
        assignmentCount,
      }
    })

  const totalHours = chartItems.reduce((sum, item) => sum + item.totalHours, 0)
  const { chartMaximum, yAxisTickValues } = getHoursChartScale()
  const hasScheduledEntries = scheduleEntries.length > 0

  return (
    <section
      id="wochenstunden-widget"
      className="panel dashboard-widget hours-widget"
      aria-label="Arbeitsstunden der Woche"
      style={{
        '--hours-chart-item-count': String(chartItems.length),
      }}
    >
      <div className="widget-topline">
        <div>
          <h2>Wochenstunden</h2>
          <p className="widget-note">Arbeitsstunden aller Mitarbeiter in {dashboardWeekLabel}.</p>
        </div>
        <span className="widget-count-pill widget-count-pill-accent">
          {formatHourCount(totalHours)}
        </span>
      </div>

      {employees.length === 0 ? (
        <p className="empty-state">Keine Mitarbeiter vorhanden.</p>
      ) : !hasScheduledEntries ? (
        <p className="empty-state">Für diese Kalenderwoche sind noch keine Einsätze geplant.</p>
      ) : (
        <div className="hours-chart-shell">
          <span className="hours-chart-axis-title" aria-hidden="true">
            Std.
          </span>
          <div className="hours-chart-layout">
            <div className="hours-chart-y-axis" aria-hidden="true">
              {yAxisTickValues.map((tickValue) => (
                <span key={tickValue}>{formatHourValue(tickValue)}</span>
              ))}
            </div>

            <div className="hours-chart-scroll">
              <div className="hours-chart-stage">
                <div className="hours-chart-grid-lines" aria-hidden="true">
                  {yAxisTickValues.map((tickValue) => (
                    <span key={`grid-${tickValue}`} className="hours-chart-grid-line" />
                  ))}
                </div>

                <div
                  className="hours-chart-bars"
                  role="list"
                  aria-label={`Arbeitsstunden in ${dashboardWeekLabel}`}
                >
                  {chartItems.map((item, index) => {
                    const barHeight =
                      chartMaximum > 0
                        ? `${Math.min(item.totalHours / chartMaximum, 1) * 100}%`
                        : '0%'
                    const barColor =
                      HOURS_CHART_BAR_COLORS[index % HOURS_CHART_BAR_COLORS.length]
                    const compactLabel = getCompactEmployeeLabel(item.label)
                    const assignmentLabel =
                      item.assignmentCount === 1 ? '1 Einsatz' : `${item.assignmentCount} Einsätze`

                    return (
                      <article
                        key={item.employeeId}
                        className={`hours-chart-item${
                          selectedEmployeeId === item.employeeId ? ' hours-chart-item-active' : ''
                        }`}
                        role="listitem"
                        aria-label={`${item.label}: ${formatHourCount(item.totalHours)}, ${assignmentLabel}`}
                        title={`${item.label} · ${formatHourCount(item.totalHours)} · ${assignmentLabel}`}
                      >
                        <span className="hours-chart-bar-value">{formatHourValue(item.totalHours)}</span>
                        <div className="hours-chart-bar-slot" aria-hidden="true">
                          <div
                            className="hours-chart-bar-fill"
                            style={{
                              height: barHeight,
                              '--hours-chart-bar-color': barColor,
                            }}
                          />
                        </div>
                        <strong className="hours-chart-bar-label">{compactLabel}</strong>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function FeedbackWidget({
  feedbackEntries,
  feedbackSettings,
}) {
  const feedbackPublicUrl = buildFeedbackPublicUrl(feedbackSettings?.feedback_public_token)
  const feedbackQrCodeUrl = buildFeedbackQrCodeUrl(feedbackPublicUrl, {
    format: 'png',
    size: 480,
  })
  const recentFeedbackEntries = feedbackEntries.slice(0, 6)
  const feedbackQrFileName = getFeedbackQrFileName(feedbackSettings?.account_name)

  const handleDownloadQrCode = async () => {
    if (!feedbackQrCodeUrl || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    try {
      const response = await fetch(feedbackQrCodeUrl)
      if (!response.ok) {
        throw new Error('QR code download failed')
      }

      const qrCodeBlob = await response.blob()
      const objectUrl = window.URL.createObjectURL(qrCodeBlob)
      const downloadLink = document.createElement('a')
      downloadLink.href = objectUrl
      downloadLink.download = feedbackQrFileName
      document.body.append(downloadLink)
      downloadLink.click()
      downloadLink.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(feedbackQrCodeUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <section
      id="feedback-widget"
      className="panel dashboard-widget feedback-widget"
      aria-label="Kundenfeedback"
    >
      <div className="widget-topline">
        <div>
          <h2>Feedback</h2>
          <p className="widget-note">
            Allgemeines Kundenfeedback für {feedbackSettings?.account_name ?? 'den aktiven Account'}.
          </p>
        </div>
        <div className="widget-topline-actions">
          <button
            type="button"
            className="secondary-button widget-print-button"
            disabled={!feedbackPublicUrl || !feedbackQrCodeUrl}
            aria-label="QR-Code als PNG herunterladen"
            title="QR-Code als PNG herunterladen"
            onClick={() => void handleDownloadQrCode()}
          >
            <svg
              className="widget-print-button-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm9-2h2v2h-2v-2Zm3 0h4v2h-4v-2Zm-3 3h2v2h-2v-2Zm3 0h2v2h-2v-2Zm3 0h1v4h-4v-2h3v-2Zm-8 3h2v1h-2v-1Zm3 0h4v1h-4v-1Zm-3-9h2v2h-2v-2Zm3 0h1v1h-1v-1Zm2 0h3v2h-3v-2Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <span className="widget-count-pill widget-count-pill-accent">
            {String(feedbackEntries.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      <section className="feedback-widget-card feedback-widget-list-card">
        <div className="feedback-widget-card-header">
          <h3>Letzte Rückmeldungen</h3>
          <span className="widget-note">Direkt aus dem öffentlichen Formular</span>
        </div>

        {recentFeedbackEntries.length > 0 ? (
          <div className="feedback-entry-list">
            {recentFeedbackEntries.map((feedbackEntry) => (
              <article key={feedbackEntry.id} className="feedback-entry-card">
                <div className="feedback-entry-topline">
                  <strong>{feedbackEntry.author_name || 'Anonym'}</strong>
                  <span>{formatFeedbackTimestamp(feedbackEntry.created_at)}</span>
                </div>
                <p>{feedbackEntry.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Noch keine Rückmeldungen vorhanden.</p>
        )}
      </section>
    </section>
  )
}

function EmployeeManagementSection({
  employees,
  employeeForm,
  isSavingEmployee,
  onBackToSchedule,
  onDeleteEmployee,
  onEmployeeFieldChange,
  onEmployeeSubmit,
  onResetEmployeeForm,
  onSelectEmployee,
  pendingEmployeeDeleteId,
  selectedEmployeeId,
}) {
  return (
    <section className="panel management-panel" aria-label="Mitarbeiter verwalten">
      <div className="management-panel-header">
        <div>
          <p className="eyebrow">Mitarbeiter</p>
          <h2>Mitarbeiter verwalten</h2>
          <p className="panel-note">Neue Mitarbeiter werden ausschließlich hier angelegt.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onBackToSchedule}>
          Zum Dienstplan
        </button>
      </div>

      <div className="management-panel-grid">
        <section className="management-card">
          <div className="management-card-header">
            <h3>Bestehende Mitarbeiter</h3>
            <span className="widget-count-pill">{String(employees.length).padStart(2, '0')}</span>
          </div>

          <div className="management-list">
            {employees.length > 0 ? (
              employees.map((employee) => (
                <article key={employee.id} className="management-list-row">
                  <button
                    type="button"
                    className={`management-list-item management-list-select${
                      selectedEmployeeId === employee.id ? ' management-list-item-active' : ''
                    }`}
                    disabled={isSavingEmployee}
                    onClick={() => onSelectEmployee(employee.id)}
                  >
                    <strong>{getEmployeeDisplayName(employee)}</strong>
                    {employee.phone ? (
                      <span className="management-list-meta">{employee.phone}</span>
                    ) : null}
                    {employee.notes ? (
                      <span className="management-list-meta">{employee.notes}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="management-list-delete"
                    disabled={isSavingEmployee}
                    onClick={() => onDeleteEmployee(employee)}
                  >
                    {pendingEmployeeDeleteId === employee.id ? 'Löscht...' : 'Löschen'}
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-state">Keine Mitarbeiter vorhanden.</p>
            )}
          </div>
        </section>

        <section className="management-card">
          <div className="management-card-header">
            <h3>Neuen Mitarbeiter anlegen</h3>
          </div>

          <form className="management-form" onSubmit={onEmployeeSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="employee-phone">Telefon</label>
                <input
                  id="employee-phone"
                  type="text"
                  value={employeeForm.phone}
                  onChange={(event) => onEmployeeFieldChange('phone', event.target.value)}
                  placeholder="+43 ..."
                />
              </div>
              <div className="form-field">
                <label htmlFor="employee-first-name">Vorname</label>
                <input
                  id="employee-first-name"
                  type="text"
                  value={employeeForm.firstName}
                  onChange={(event) => onEmployeeFieldChange('firstName', event.target.value)}
                  placeholder="Ahmet"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="employee-last-name">Nachname</label>
                <input
                  id="employee-last-name"
                  type="text"
                  value={employeeForm.lastName}
                  onChange={(event) => onEmployeeFieldChange('lastName', event.target.value)}
                  placeholder="Özcan"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="employee-notes">Notizen</label>
              <textarea
                id="employee-notes"
                value={employeeForm.notes}
                onChange={(event) => onEmployeeFieldChange('notes', event.target.value)}
                placeholder="Interne Hinweise"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="action-button form-button" disabled={isSavingEmployee}>
                {isSavingEmployee ? 'Wird verarbeitet...' : 'Speichern'}
              </button>
              <button
                type="button"
                className="secondary-button form-button"
                disabled={isSavingEmployee}
                onClick={onResetEmployeeForm}
              >
                Formular leeren
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}

function CustomerManagementSection({
  customerForm,
  customers,
  isSavingCustomer,
  onBackToSchedule,
  onCustomerFieldChange,
  onDeleteCustomer,
  onCustomerSubmit,
  onResetCustomerForm,
  pendingCustomerDeleteId,
}) {
  return (
    <section className="panel management-panel" aria-label="Kunden verwalten">
      <div className="management-panel-header">
        <div>
          <p className="eyebrow">Kunden</p>
          <h2>Kunden verwalten</h2>
          <p className="panel-note">Neue Kunden werden ausschließlich hier angelegt.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onBackToSchedule}>
          Zum Dienstplan
        </button>
      </div>

      <div className="management-panel-grid">
        <section className="management-card">
          <div className="management-card-header">
            <h3>Bestehende Kunden</h3>
            <span className="widget-count-pill">{String(customers.length).padStart(2, '0')}</span>
          </div>

          <div className="management-list">
            {customers.length > 0 ? (
              customers.map((customer) => (
                <article key={customer.id} className="management-list-row">
                  <div className="management-list-item management-list-item-static">
                    <span
                      className="management-color-dot"
                      aria-hidden="true"
                      style={{ backgroundColor: customer.color }}
                    />
                    <div className="management-list-content">
                      <strong>{customer.name}</strong>
                      {customer.address ? (
                        <span className="management-list-meta">{customer.address}</span>
                      ) : null}
                      {customer.notes ? (
                        <span className="management-list-meta">{customer.notes}</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="management-list-delete"
                    disabled={isSavingCustomer}
                    onClick={() => onDeleteCustomer(customer)}
                  >
                    {pendingCustomerDeleteId === customer.id ? 'Löscht...' : 'Löschen'}
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-state">Keine Kunden vorhanden.</p>
            )}
          </div>
        </section>

        <section className="management-card">
          <div className="management-card-header">
            <h3>Neuen Kunden anlegen</h3>
          </div>

          <form className="management-form" onSubmit={onCustomerSubmit}>
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
              <button type="submit" className="action-button form-button" disabled={isSavingCustomer}>
                {isSavingCustomer ? 'Wird verarbeitet...' : 'Speichern'}
              </button>
              <button
                type="button"
                className="secondary-button form-button"
                disabled={isSavingCustomer}
                onClick={onResetCustomerForm}
              >
                Formular leeren
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}

function LegalSection({ activeSection, onBackToSchedule }) {
  const imprintProviderName = 'Ahmet Özcan e. U.'
  const imprintAddressLineOne = 'Josef-Ressel-Straße 20'
  const imprintAddressLineTwo = '5020 Salzburg, Österreich'
  const imprintEmail = 'ahmetzcan1@outlook.com'
  const imprintPhone = '+436602274556'

  const legalPageContentBySection = {
    'legal-imprint': {
      title: 'Impressum',
      intro: 'Anbieterkennzeichnung für Ordo Cloud.',
      cards: [
        {
          title: 'Anbieter',
          lines: [
            imprintProviderName,
            imprintAddressLineOne,
            imprintAddressLineTwo,
          ],
        },
        {
          title: 'Kontakt',
          lines: [`E-Mail: ${imprintEmail}`, `Telefon: ${imprintPhone}`],
        },
        {
          title: 'Vertretung und Blattlinie',
          lines: [
            `Vertretungsbefugte Person: ${imprintProviderName}`,
            'Tätigkeitsbereich: Cloud-Software für Dienst- und Einsatzplanung',
            'Blattlinie: Informationen und Funktionen rund um Ordo Cloud',
          ],
        },
      ],
    },
    'legal-privacy': {
      title: 'Datenschutz',
      intro:
        'Diese Datenschutzerklärung beschreibt den im Quellcode und im aktuellen Deployment erkennbaren Stand von Ordo Cloud.',
      cards: [
        {
          title: 'Verantwortlicher',
          lines: [
            `${imprintProviderName} ist Verantwortlicher für die Verarbeitung personenbezogener Daten in Ordo Cloud.`,
            imprintAddressLineOne,
            imprintAddressLineTwo,
            `E-Mail: ${imprintEmail}`,
            `Telefon: ${imprintPhone}`,
          ],
        },
        {
          title: 'Verarbeitete Daten',
          bullets: [
            'Kontodaten wie E-Mail-Adresse, Name, Account-Zuordnung und Rolleninformationen',
            'Anmeldedaten wie Passwort-Hash, Authentifizierungs-Token sowie Daten zu fehlgeschlagenen Login-Versuchen einschließlich IP-Adresse und Zeitstempeln zur Absicherung des Zugangs',
            'Mitarbeiterdaten wie Vorname, Nachname, Telefonnummer und Notizen',
            'Kundendaten wie Name, Adresse, Farbcodierung und Notizen',
            'Planungsdaten wie Mitarbeiter- und Kundenbezug, Datum, Start- und Endzeit, optionale Notizen sowie Ersteller- und Änderungszeitpunkte',
            'Technische Nutzungsdaten im Browser, insbesondere die gespeicherte Anmeldung und die Auswahl im Kunden-Widget im Local Storage',
          ],
        },
        {
          title: 'Zwecke und Rechtsgrundlagen',
          bullets: [
            'Bereitstellung der Anwendung, Nutzeranmeldung und Kontoverwaltung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO',
            'Organisation von Dienstplanung, Mitarbeiterverwaltung und Kundenverwaltung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO',
            'IT-Sicherheit, Missbrauchsabwehr und Begrenzung fehlgeschlagener Logins auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO',
            'Erfüllung gesetzlicher Aufbewahrungs- und Nachweispflichten, soweit einschlägig, auf Grundlage von Art. 6 Abs. 1 lit. c DSGVO',
          ],
        },
        {
          title: 'Empfänger und Speicherfristen',
          bullets: [
            'Das Frontend wird nach aktueller Deployment-Konfiguration über Vercel ausgeliefert; API-Anfragen werden an eine Railway-Instanz weitergeleitet.',
            'Eine Weitergabe an technische Dienstleister erfolgt nur, soweit dies für Hosting, Auslieferung der Website, Betrieb der API, Datenbankbetrieb oder gesetzliche Verpflichtungen erforderlich ist.',
            'Kontodaten, Mitarbeiterdaten, Kundendaten und Planungsdaten bleiben grundsätzlich gespeichert, solange sie für den Betrieb der Anwendung, die Vertragsdurchführung oder berechtigte Nachweisinteressen benötigt werden.',
            'Daten zur Abwehr von Login-Missbrauch werden nach aktuellem Code regelmäßig bereinigt; veraltete Einträge werden spätestens nach 24 Stunden gelöscht.',
            'Im Browser gespeicherte Daten bleiben bestehen, bis ein Logout erfolgt, der Local Storage gelöscht wird oder neue Daten die bisherigen Einträge ersetzen.',
          ],
        },
        {
          title: 'Betroffenenrechte',
          bullets: [
            'Sie haben insbesondere das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer personenbezogenen Daten.',
            'Soweit die gesetzlichen Voraussetzungen vorliegen, besteht außerdem ein Recht auf Datenübertragbarkeit sowie ein Widerspruchsrecht gegen Verarbeitungen auf Grundlage berechtigter Interessen.',
            `Zur Ausübung Ihrer Rechte genügt eine formlose Nachricht an ${imprintEmail}.`,
            'Beschwerde bei der Österreichischen Datenschutzbehörde, Barichgasse 40-42, 1030 Wien',
          ],
        },
      ],
    },
    'legal-cookies': {
      title: 'Cookies und Endgerätespeicher',
      intro:
        'Aktueller Frontend-Stand: Im sichtbaren Code sind keine Analyse- oder Marketing-Cookies eingebunden. Vor Produktion trotzdem das echte Deployment inklusive Dritttools prüfen.',
      cards: [
        {
          title: 'Derzeitiger Stand',
          bullets: [
            'Die App speichert die Anmeldung aktuell im Browser-Local-Storage.',
            'Technisch nicht notwendige Tracking-, Marketing- oder Werbe-Cookies sind im Frontend derzeit nicht hinterlegt.',
          ],
        },
        {
          title: 'Wann Einwilligung nötig wird',
          bullets: [
            'Sobald Analyse-, Marketing- oder Retargeting-Dienste eingebunden werden',
            'Sobald Drittinhalte wie Karten, Videos, Social Plugins oder reCAPTCHA ohne echte technische Erforderlichkeit eingesetzt werden',
            'Dann muss die Zustimmung vor Aktivierung eingeholt und der Widerruf leicht möglich sein',
          ],
        },
        {
          title: 'Was dokumentiert werden sollte',
          bullets: [
            'Welche Technologien auf dem Endgerät gespeichert oder ausgelesen werden',
            'Zu welchem Zweck dies geschieht und wie lange die Daten bestehen bleiben',
            'Wie Nutzer ihre Auswahl später wieder ändern oder widerrufen können',
          ],
        },
      ],
      footnote:
        'AGB oder Nutzungsbedingungen können sinnvoll sein, sind aber nicht automatisch derselbe Pflichtblock wie Impressum oder Datenschutz.',
    },
  }

  const pageContent = legalPageContentBySection[activeSection]

  if (!pageContent) {
    return null
  }

  return (
    <section className="dashboard-page-stack">
      <section className="panel management-panel legal-panel" aria-label={pageContent.title}>
        <div className="management-panel-header">
          <div>
            <p className="eyebrow">Rechtliches</p>
            <h2>{pageContent.title}</h2>
            <p className="panel-note">{pageContent.intro}</p>
          </div>
          <button type="button" className="secondary-button" onClick={onBackToSchedule}>
            Zum Dienstplan
          </button>
        </div>

        <div className="legal-grid">
          {pageContent.cards.map((card) => (
            <section key={card.title} className="management-card legal-card">
              <div className="management-card-header">
                <h3>{card.title}</h3>
              </div>

              {card.lines ? (
                <div className="legal-copy">
                  {card.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}

              {card.bullets ? (
                <ul className="legal-list">
                  {card.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {pageContent.footnote ? (
          <p className="panel-note legal-footnote">{pageContent.footnote}</p>
        ) : null}
      </section>
    </section>
  )
}

function App() {
  const initialAuthSession = getStoredAuthSession()
  const initialCustomerWidgetStorageKey = getCustomerWidgetStorageKey(
    initialAuthSession.account?.id ?? null,
    initialAuthSession.user?.id ?? null,
  )
  const [authSession, setAuthSession] = useState(initialAuthSession)
  const [showLanding, setShowLanding] = useState(!initialAuthSession.accessToken)
  const [loginForm, setLoginForm] = useState(createInitialLoginForm)
  const [setupForm, setSetupForm] = useState(() =>
    createInitialSetupForm(initialAuthSession.user?.full_name ?? ''),
  )
  const [employees, setEmployees] = useState([])
  const [customers, setCustomers] = useState([])
  const [feedbackEntries, setFeedbackEntries] = useState([])
  const [feedbackSettings, setFeedbackSettings] = useState(null)
  const [scheduleEntries, setScheduleEntries] = useState([])
  const [activeDashboardSection, setActiveDashboardSection] = useState('schedule')
  const [isLegalMenuOpen, setIsLegalMenuOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [customerWidgetState, setCustomerWidgetState] = useState(() => ({
    storageKey: initialCustomerWidgetStorageKey,
    customerIds: getStoredCustomerWidgetCustomerIdsByKey(initialCustomerWidgetStorageKey),
  }))
  const [employeeForm, setEmployeeForm] = useState(createInitialEmployeeForm)
  const [customerForm, setCustomerForm] = useState(createInitialCustomerForm)
  const [year, setYear] = useState(INITIAL_CALENDAR_STATE.year)
  const [calendarWeek, setCalendarWeek] = useState(INITIAL_CALENDAR_STATE.calendarWeek)
  const [selectedSchedulePlannerShiftType, setSelectedSchedulePlannerShiftType] = useState(
    SCHEDULE_SHIFT_TYPES.DAY,
  )
  const [isLoading, setIsLoading] = useState(Boolean(initialAuthSession.accessToken))
  const [loadError, setLoadError] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isCompletingSetup, setIsCompletingSetup] = useState(false)
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [pendingEmployeeDeleteId, setPendingEmployeeDeleteId] = useState(null)
  const [pendingCustomerDeleteId, setPendingCustomerDeleteId] = useState(null)
  const headerMenuRef = useRef(null)

  const authToken = authSession.accessToken
  const currentUser = authSession.user
  const currentAccount = authSession.account
  const currentMembershipRole = authSession.membershipRole
  const isAuthenticated = Boolean(authToken && currentUser)
  const requiresInitialSetup = Boolean(authToken && currentUser?.must_complete_setup)
  const currentUserDisplayName =
    typeof currentUser?.full_name === 'string' && currentUser.full_name.trim()
      ? currentUser.full_name.trim()
      : currentUser?.email ?? ''
  const greetingName = getGreetingName(currentUserDisplayName) || 'zurück'
  const currentDateLabel = formatCurrentDateLabel(new Date())
  const customerWidgetCustomerIds = customerWidgetState.customerIds

  const setCustomerWidgetCustomerIds = (valueOrUpdater) => {
    setCustomerWidgetState((currentWidgetState) => {
      const nextCustomerIds =
        typeof valueOrUpdater === 'function'
          ? valueOrUpdater(currentWidgetState.customerIds)
          : valueOrUpdater

      return {
        ...currentWidgetState,
        customerIds: normalizeCustomerWidgetCustomerIds(nextCustomerIds),
      }
    })
  }

  useEffect(() => {
    if (!isAuthenticated || requiresInitialSetup) {
      setEmployees([])
      setCustomers([])
      setFeedbackEntries([])
      setFeedbackSettings(null)
      setScheduleEntries([])
      setActiveDashboardSection('schedule')
      setIsLegalMenuOpen(false)
      setSelectedEmployeeId(null)
      setLoadError('')
      setIsLoading(false)
      return
    }

    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const [
          loadedEmployees,
          loadedCustomers,
          loadedFeedbackEntries,
          loadedFeedbackSettings,
          loadedScheduleEntries,
        ] = await Promise.all([
          apiRequest('/employees', {
            signal: abortController.signal,
            accessToken: authToken,
          }),
          apiRequest('/customers', {
            signal: abortController.signal,
            accessToken: authToken,
          }),
          apiRequest('/feedback_entries', {
            signal: abortController.signal,
            accessToken: authToken,
          }),
          apiRequest('/feedback_entries/settings', {
            signal: abortController.signal,
            accessToken: authToken,
          }),
          apiRequest('/schedule_entries', {
            signal: abortController.signal,
            accessToken: authToken,
          }),
        ])

        const sortedEmployees = sortEmployees(loadedEmployees)
        const sortedCustomers = sortCustomers(loadedCustomers)

        setEmployees(sortedEmployees)
        setCustomers(sortedCustomers)
        setFeedbackEntries(loadedFeedbackEntries)
        setFeedbackSettings(loadedFeedbackSettings)
        setScheduleEntries(sortScheduleEntries(loadedScheduleEntries))
        setSelectedEmployeeId((currentEmployeeId) => {
          if (
            currentEmployeeId !== null &&
            sortedEmployees.some((employee) => employee.id === currentEmployeeId)
          ) {
            return currentEmployeeId
          }

          return sortedEmployees[0]?.id ?? null
        })
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }

        if (error.status === 401 || error.status === 403) {
          clearStoredAuthSession()
          setAuthSession(createEmptyAuthSession())
          setEmployees([])
          setCustomers([])
          setFeedbackEntries([])
          setFeedbackSettings(null)
          setScheduleEntries([])
          setActiveDashboardSection('schedule')
          setIsLegalMenuOpen(false)
          setSelectedEmployeeId(null)
          setLoadError('')
          setAuthError('Sitzung abgelaufen. Bitte erneut anmelden.')
          return
        }

        setLoadError(error.message || 'Daten konnten nicht vom Backend geladen werden.')
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      abortController.abort()
    }
  }, [authToken, isAuthenticated, requiresInitialSetup])

  useEffect(() => {
    if (!isLegalMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (!headerMenuRef.current?.contains(event.target)) {
        setIsLegalMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsLegalMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLegalMenuOpen])

  useEffect(() => {
    const nextStorageKey =
      isAuthenticated && !requiresInitialSetup
        ? getCustomerWidgetStorageKey(currentAccount?.id ?? null, currentUser?.id ?? null)
        : null

    setCustomerWidgetState((currentWidgetState) => {
      if (currentWidgetState.storageKey === nextStorageKey) {
        return currentWidgetState
      }

      return {
        storageKey: nextStorageKey,
        customerIds: getStoredCustomerWidgetCustomerIdsByKey(nextStorageKey),
      }
    })
  }, [currentAccount?.id, currentUser?.id, isAuthenticated, requiresInitialSetup])

  useEffect(() => {
    persistCustomerWidgetCustomerIdsByKey(
      customerWidgetState.storageKey,
      customerWidgetState.customerIds,
    )
  }, [customerWidgetState])

  useEffect(() => {
    if (isLoading) {
      return
    }

    const validCustomerIds = new Set(customers.map((customer) => customer.id))

    setCustomerWidgetCustomerIds((currentCustomerIds) =>
      currentCustomerIds.filter((customerId) => validCustomerIds.has(customerId)),
    )
  }, [customers, isLoading])

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null
  const selectedEmployeeLabel = selectedEmployee
    ? getEmployeeDisplayName(selectedEmployee)
    : 'Kein Mitarbeiter ausgewählt'
  const scheduleDateRangeLabel = getCalendarWeekDateRangeLabel(year, calendarWeek)
  const customersById = Object.fromEntries(customers.map((customer) => [customer.id, customer]))
  const customerWidgetIdSet = new Set(customerWidgetCustomerIds)
  const widgetCustomers = customerWidgetCustomerIds
    .map((customerId) => customersById[customerId] ?? null)
    .filter(Boolean)
  const customersAvailableForWidget = customers.filter(
    (customer) => !customerWidgetIdSet.has(customer.id),
  )
  const scheduleEntriesForSelectedWeek = scheduleEntries.filter((entry) =>
    isScheduleEntryInCalendarWeek(entry, year, calendarWeek),
  )
  const scheduleEntriesForCurrentView =
    selectedEmployeeId === null
      ? []
      : scheduleEntriesForSelectedWeek.filter((entry) => entry.employee_id === selectedEmployeeId)
  const scheduleEntriesForCurrentViewByShiftType = {
    [SCHEDULE_SHIFT_TYPES.DAY]: scheduleEntriesForCurrentView
      .filter((entry) => getScheduleEntryShiftType(entry) === SCHEDULE_SHIFT_TYPES.DAY)
      .map((entry) => ({
        ...entry,
        planner_day_of_week: getPlannerDayOfWeekForEntry(entry, weekdays),
      })),
    [SCHEDULE_SHIFT_TYPES.NIGHT]: scheduleEntriesForCurrentView
      .filter((entry) => getScheduleEntryShiftType(entry) === SCHEDULE_SHIFT_TYPES.NIGHT)
      .map((entry) => ({
        ...entry,
        planner_day_of_week: getPlannerDayOfWeekForEntry(entry, weekdays),
      })),
  }
  const dashboardWeekLabel = `KW ${calendarWeek}/${year}`
  const activePlannerConfig =
    SCHEDULE_PLANNER_CONFIGS.find(
      (plannerConfig) => plannerConfig.shiftType === selectedSchedulePlannerShiftType,
    ) ?? SCHEDULE_PLANNER_CONFIGS[0]
  const schedulePlannerViewSwitcher = (
    <div className="schedule-shift-toggle" aria-label="Dienstplanansicht">
      {SCHEDULE_PLANNER_CONFIGS.map((plannerConfig) => {
        const isActivePlanner = plannerConfig.shiftType === activePlannerConfig.shiftType
        const toggleLabel =
          plannerConfig.shiftType === SCHEDULE_SHIFT_TYPES.DAY ? '☀ Tag' : '☾ Nacht'

        return (
          <button
            key={`planner-toggle-${plannerConfig.shiftType}`}
            type="button"
            className={`schedule-shift-toggle-button${
              isActivePlanner ? ' schedule-shift-toggle-button-active' : ''
            }`}
            aria-pressed={isActivePlanner}
            onClick={() => setSelectedSchedulePlannerShiftType(plannerConfig.shiftType)}
          >
            {toggleLabel}
          </button>
        )
      })}
    </div>
  )

  const resetAuthenticatedApp = (message = '') => {
    clearStoredAuthSession()
    setAuthSession(createEmptyAuthSession())
    setSetupForm(createInitialSetupForm())
    setEmployees([])
    setCustomers([])
    setFeedbackEntries([])
    setFeedbackSettings(null)
    setCustomerWidgetCustomerIds([])
    setScheduleEntries([])
    setActiveDashboardSection('schedule')
    setIsLegalMenuOpen(false)
    setSelectedEmployeeId(null)
    setLoadError('')
    setAuthError(message)
    setIsLoading(false)
    setIsCompletingSetup(false)
    setPendingEmployeeDeleteId(null)
    setPendingCustomerDeleteId(null)
    setShowLanding(true)
  }

  const resetEmployeeForm = () => {
    setEmployeeForm(createInitialEmployeeForm())
  }

  const resetCustomerForm = () => {
    setCustomerForm(createInitialCustomerForm())
  }

  const handleLoginSubmit = async (event) => {
    event.preventDefault()

    const email = loginForm.email.trim()
    const password = loginForm.password

    if (!email || !password || isLoggingIn) {
      return
    }

    setIsLoggingIn(true)
    setAuthError('')

    try {
      const loginResponse = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      const nextSession = {
        accessToken: loginResponse.access_token,
        user: loginResponse.user,
        account: loginResponse.account ?? null,
        membershipRole: loginResponse.membership_role ?? '',
      }

      persistAuthSession(nextSession)
      setAuthSession(nextSession)
      setSetupForm(createInitialSetupForm(loginResponse.user.full_name ?? ''))
      setLoginForm({
        email: loginResponse.user.email,
        password: '',
      })
      setLoadError('')
    } catch (error) {
      setAuthError(error.message || 'Anmeldung fehlgeschlagen.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleCompleteSetupSubmit = async (event) => {
    event.preventDefault()

    const fullName = setupForm.fullName.trim()
    const newPassword = setupForm.newPassword
    const confirmPassword = setupForm.confirmPassword

    if (!authToken || !currentUser || isCompletingSetup) {
      return
    }

    if (!fullName) {
      setAuthError('Bitte gib deinen Namen ein.')
      return
    }

    if (newPassword.length < 8) {
      setAuthError('Das neue Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }

    if (newPassword !== confirmPassword) {
      setAuthError('Die neuen Passwörter stimmen nicht überein.')
      return
    }

    setIsCompletingSetup(true)
    setAuthError('')

    try {
      const setupResponse = await apiRequest('/auth/complete-setup', {
        method: 'POST',
        accessToken: authToken,
        body: JSON.stringify({
          full_name: fullName,
          new_password: newPassword,
        }),
      })

      const nextSession = {
        ...authSession,
        user: setupResponse.user,
      }

      persistAuthSession(nextSession)
      setAuthSession(nextSession)
      setSetupForm(createInitialSetupForm(setupResponse.user.full_name ?? ''))
      setLoadError('')
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setAuthError(error.message || 'Erstlogin konnte nicht abgeschlossen werden.')
    } finally {
      setIsCompletingSetup(false)
    }
  }

  const handleLogout = () => {
    resetAuthenticatedApp('')
  }

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault()

    const firstName = employeeForm.firstName.trim()
    const lastName = employeeForm.lastName.trim()
    const phone = employeeForm.phone.trim()
    const notes = employeeForm.notes.trim()

    if (isSavingEmployee) {
      return
    }

    if (!firstName) {
      setLoadError('Vorname für den Mitarbeiter fehlt.')
      return
    }

    setPendingEmployeeDeleteId(null)
    setIsSavingEmployee(true)

    try {
      const createdEmployee = await apiRequest('/employees', {
        method: 'POST',
        accessToken: authToken,
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          notes: notes || null,
        }),
      })

      setEmployees((currentEmployees) => sortEmployees([...currentEmployees, createdEmployee]))
      setSelectedEmployeeId(createdEmployee.id)
      setLoadError('')
      resetEmployeeForm()
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setLoadError(error.message || 'Mitarbeiter konnte nicht gespeichert werden.')
    } finally {
      setIsSavingEmployee(false)
    }
  }

  const handleEmployeeDelete = async (employee) => {
    if (!employee || isSavingEmployee) {
      return
    }

    const employeeLabel = getEmployeeDisplayName(employee) || `Mitarbeiter #${employee.id}`
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`${employeeLabel} wirklich löschen?`)
    ) {
      return
    }

    setPendingEmployeeDeleteId(employee.id)
    setIsSavingEmployee(true)

    try {
      await apiRequest(`/employees/${employee.id}`, {
        method: 'DELETE',
        accessToken: authToken,
      })

      setEmployees((currentEmployees) =>
        currentEmployees.filter((currentEmployee) => currentEmployee.id !== employee.id),
      )
      setSelectedEmployeeId((currentEmployeeId) => {
        if (currentEmployeeId !== employee.id) {
          return currentEmployeeId
        }

        return employees.find((currentEmployee) => currentEmployee.id !== employee.id)?.id ?? null
      })
      setLoadError('')
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setLoadError(error.message || 'Mitarbeiter konnte nicht gelöscht werden.')
    } finally {
      setPendingEmployeeDeleteId(null)
      setIsSavingEmployee(false)
    }
  }

  const handleCustomerSubmit = async (event) => {
    event.preventDefault()

    const customerName = customerForm.name.trim()
    const address = customerForm.address.trim()
    const notes = customerForm.notes.trim()
    const customerColor = getRandomCustomerColor(customers)

    if (!customerName || isSavingCustomer) {
      return
    }

    setPendingCustomerDeleteId(null)
    setIsSavingCustomer(true)

    try {
      const createdCustomer = await apiRequest('/customers', {
        method: 'POST',
        accessToken: authToken,
        body: JSON.stringify({
          name: customerName,
          color: customerColor,
          address: address || null,
          notes: notes || null,
        }),
      })

      setCustomers((currentCustomers) => sortCustomers([...currentCustomers, createdCustomer]))
      setLoadError('')
      resetCustomerForm()
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setLoadError(error.message || 'Kunde konnte nicht gespeichert werden.')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  const handleCustomerDelete = async (customer) => {
    if (!customer || isSavingCustomer) {
      return
    }

    const customerLabel = customer.name || `Kunde #${customer.id}`
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`${customerLabel} wirklich löschen?`)
    ) {
      return
    }

    setPendingCustomerDeleteId(customer.id)
    setIsSavingCustomer(true)

    try {
      await apiRequest(`/customers/${customer.id}`, {
        method: 'DELETE',
        accessToken: authToken,
      })

      setCustomers((currentCustomers) =>
        currentCustomers.filter((currentCustomer) => currentCustomer.id !== customer.id),
      )
      setLoadError('')
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setLoadError(error.message || 'Kunde konnte nicht gelöscht werden.')
    } finally {
      setPendingCustomerDeleteId(null)
      setIsSavingCustomer(false)
    }
  }

  const handleCustomerFormFieldChange = (field, value) => {
    setCustomerForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const handleEmployeeFormFieldChange = (field, value) => {
    setEmployeeForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  const addCustomerToWidget = (customerId) => {
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return
    }

    if (!customersById[customerId]) {
      return
    }

    setCustomerWidgetCustomerIds((currentCustomerIds) => {
      if (currentCustomerIds.includes(customerId)) {
        return currentCustomerIds
      }

      return [...currentCustomerIds, customerId]
    })
  }

  const removeCustomerFromWidget = (customerId) => {
    setCustomerWidgetCustomerIds((currentCustomerIds) =>
      currentCustomerIds.filter((currentCustomerId) => currentCustomerId !== customerId),
    )
  }

  const hasScheduleConflict = ({
    dayOfWeek,
    startTime,
    endTime,
    ignoreEntryId = null,
    shiftType = SCHEDULE_SHIFT_TYPES.DAY,
  }) => {
    const normalizedShiftType = normalizeScheduleShiftType(shiftType)
    const scheduleDate = getScheduleDateForPlannerPlacement(
      year,
      calendarWeek,
      dayOfWeek,
      startTime,
      normalizedShiftType,
    )
    const candidateInterval = getScheduleIntervalBoundsFromDate(
      scheduleDate,
      startTime,
      endTime,
    )

    if (!candidateInterval) {
      return true
    }

    return scheduleEntriesForCurrentView.some((entry) => {
      if (
        entry.id === ignoreEntryId ||
        getScheduleEntryShiftType(entry) !== normalizedShiftType
      ) {
        return false
      }

      const entryInterval = getScheduleIntervalBoundsFromDate(
        getScheduleEntryDate(entry),
        getScheduleEntryStartTime(entry),
        getScheduleEntryEndTime(entry),
      )

      if (!entryInterval) {
        return false
      }

      return candidateInterval.start < entryInterval.end && entryInterval.start < candidateInterval.end
    })
  }

  const createScheduleEntry = async ({
    customerId,
    dayOfWeek,
    startTime,
    endTime,
    shiftType = SCHEDULE_SHIFT_TYPES.DAY,
  }) => {
    if (isSavingSchedule) {
      return false
    }

    if (selectedEmployeeId === null) {
      setLoadError('Bitte zuerst einen Mitarbeiter auswählen.')
      return false
    }

    if (!Number.isInteger(customerId) || customerId <= 0 || !endTime) {
      setLoadError('Dieser Kunde konnte nicht eingeplant werden.')
      return false
    }

    if (!getNormalizedTimeRange(startTime, endTime)) {
      setLoadError(
        'Bitte gültige Uhrzeiten eingeben. Für Einsätze über Mitternacht darf die Bis-Uhrzeit früher sein.',
      )
      return false
    }

    if (!isHalfHourTimeRange(startTime, endTime)) {
      setLoadError('Es sind nur 30-Minuten-Schritte erlaubt.')
      return false
    }

    const normalizedShiftType = normalizeScheduleShiftType(shiftType)

    if (hasScheduleConflict({ dayOfWeek, startTime, endTime, shiftType: normalizedShiftType })) {
      setLoadError('Dieses Zeitfenster ist bereits belegt.')
      return false
    }

    setIsSavingSchedule(true)

    try {
      const scheduleDate = getScheduleDateForPlannerPlacement(
        year,
        calendarWeek,
        dayOfWeek,
        startTime,
        normalizedShiftType,
      )
      if (!scheduleDate) {
        throw new Error('Für die ausgewählte Kalenderwoche konnte kein gültiges Datum ermittelt werden.')
      }

      const createdScheduleEntry = await apiRequest('/schedule_entries', {
        method: 'POST',
        accessToken: authToken,
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          customer_id: customerId,
          date: scheduleDate,
          shift_type: normalizedShiftType,
          start_time: startTime,
          end_time: endTime,
          notes: null,
        }),
      })

      setScheduleEntries((currentEntries) =>
        sortScheduleEntries([...currentEntries, createdScheduleEntry]),
      )
      setLoadError('')
      return true
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return false
      }

      setLoadError(error.message || 'Einsatz konnte nicht gespeichert werden.')
      return false
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const updateScheduleEntry = async (entryId, updates, fallbackMessage) => {
    if (isSavingSchedule) {
      return false
    }

    setIsSavingSchedule(true)

    try {
      const updatedScheduleEntry = await apiRequest(`/schedule_entries/${entryId}`, {
        method: 'PATCH',
        accessToken: authToken,
        body: JSON.stringify(updates),
      })

      setScheduleEntries((currentEntries) =>
        sortScheduleEntries(
          currentEntries.map((entry) => (entry.id === entryId ? updatedScheduleEntry : entry)),
        ),
      )
      setLoadError('')
      return true
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return false
      }

      setLoadError(error.message || fallbackMessage)
      return false
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const moveScheduleEntry = async ({
    entryId,
    dayOfWeek,
    startTime,
    endTime,
    shiftType = SCHEDULE_SHIFT_TYPES.DAY,
  }) => {
    const entry = scheduleEntriesForCurrentView.find((currentEntry) => currentEntry.id === entryId)

    if (!entry) {
      setLoadError('Dieser Einsatz konnte nicht gefunden werden.')
      return false
    }

    if (!getNormalizedTimeRange(startTime, endTime)) {
      setLoadError(
        'Bitte gültige Uhrzeiten eingeben. Für Einsätze über Mitternacht darf die Bis-Uhrzeit früher sein.',
      )
      return false
    }

    if (!isHalfHourTimeRange(startTime, endTime)) {
      setLoadError('Es sind nur 30-Minuten-Schritte erlaubt.')
      return false
    }

    const normalizedShiftType = normalizeScheduleShiftType(shiftType)

    if (
      hasScheduleConflict({
        dayOfWeek,
        startTime,
        endTime,
        ignoreEntryId: entryId,
        shiftType: normalizedShiftType,
      })
    ) {
      setLoadError('Dieses Zeitfenster ist bereits belegt.')
      return false
    }

    const scheduleDate = getScheduleDateForPlannerPlacement(
      year,
      calendarWeek,
      dayOfWeek,
      startTime,
      normalizedShiftType,
    )
    if (!scheduleDate) {
      setLoadError('Für die ausgewählte Kalenderwoche konnte kein gültiges Datum ermittelt werden.')
      return false
    }

    return await updateScheduleEntry(
      entryId,
      {
        date: scheduleDate,
        shift_type: normalizedShiftType,
        start_time: startTime,
        end_time: endTime,
      },
      'Einsatz konnte nicht verschoben werden.',
    )
  }

  const copyPreviousWeekScheduleEntries = async (shiftType = SCHEDULE_SHIFT_TYPES.DAY) => {
    if (isSavingSchedule) {
      return
    }

    if (selectedEmployeeId === null) {
      setLoadError('Bitte zuerst einen Mitarbeiter auswählen.')
      return
    }

    const previousWeekState = getPreviousCalendarWeekState(year, calendarWeek)
    if (!previousWeekState) {
      setLoadError('Die Vorwoche konnte nicht ermittelt werden.')
      return
    }

    const normalizedShiftType = normalizeScheduleShiftType(shiftType)
    const currentShiftEntries =
      scheduleEntriesForCurrentViewByShiftType[normalizedShiftType] ?? []
    const previousWeekEntries = scheduleEntries.filter(
      (entry) =>
        entry.employee_id === selectedEmployeeId &&
        getScheduleEntryShiftType(entry) === normalizedShiftType &&
        isScheduleEntryInCalendarWeek(
          entry,
          previousWeekState.year,
          previousWeekState.calendarWeek,
        ),
    )

    if (previousWeekEntries.length === 0) {
      setLoadError(
        `In KW ${previousWeekState.calendarWeek}/${previousWeekState.year} sind keine Einsätze für ${selectedEmployeeLabel}.`,
      )
      return
    }

    const shouldReplaceExisting = currentShiftEntries.length > 0
    if (
      shouldReplaceExisting &&
      typeof window !== 'undefined' &&
      !window.confirm(
        `KW ${calendarWeek}/${year} enthält bereits ${currentShiftEntries.length} Einsätze für ${selectedEmployeeLabel}. Soll die Woche mit KW ${previousWeekState.calendarWeek}/${previousWeekState.year} überschrieben werden?`,
      )
    ) {
      return
    }

    const targetWeekEntryIds = new Set(currentShiftEntries.map((entry) => entry.id))

    setIsSavingSchedule(true)

    try {
      const copiedEntries = await apiRequest('/schedule_entries/actions/copy_previous_week', {
        method: 'POST',
        accessToken: authToken,
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          year,
          calendar_week: calendarWeek,
          shift_type: normalizedShiftType,
          replace_existing: shouldReplaceExisting,
        }),
      })

      setScheduleEntries((currentEntries) =>
        sortScheduleEntries([
          ...currentEntries.filter((entry) => !targetWeekEntryIds.has(entry.id)),
          ...copiedEntries,
        ]),
      )
      setLoadError('')
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setLoadError(error.message || 'Vorwoche konnte nicht übernommen werden.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const deleteScheduleEntry = async (entryId) => {
    if (isSavingSchedule) {
      return
    }

    const entryToDelete = scheduleEntries.find((entry) => entry.id === entryId) ?? null

    setIsSavingSchedule(true)

    try {
      await apiRequest(`/schedule_entries/${entryId}`, {
        method: 'DELETE',
        accessToken: authToken,
      })

      setScheduleEntries((currentEntries) =>
        currentEntries.filter((entry) => entry.id !== entryId),
      )

      if (entryToDelete?.customer_id) {
        addCustomerToWidget(entryToDelete.customer_id)
      }

      setLoadError('')
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setLoadError(error.message || 'Einsatz konnte nicht gelöscht werden.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const isScheduleSectionActive = activeDashboardSection === 'schedule'
  const isEmployeeManagementActive = activeDashboardSection === 'employees'
  const isCustomerManagementActive = activeDashboardSection === 'customers'
  const isLegalSectionActive = isLegalDashboardSection(activeDashboardSection)

  const navigateToDashboardSection = (section) => {
    setActiveDashboardSection(section)
    setIsLegalMenuOpen(false)
  }

  if (!isAuthenticated && showLanding) {
    return <LandingPage onLogin={() => setShowLanding(false)} />
  }

  if (!isAuthenticated) {
    return (
      <main className="app auth-app">
        <header className="page-header">
          <div>
            <img src="/logo_oc.png" alt="Ordo Cloud" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: '0.5rem' }} />
            <p className="eyebrow">{APP_NAME}</p>
            <h1>Dienstplanung für Teams</h1>
          </div>
        </header>
        {authError ? <p className="status-message status-error">{authError}</p> : null}
        <section className="panel auth-panel">
          <div className="auth-panel-header">
            <h2>Login</h2>
            <p className="panel-note">
            </p>
          </div>
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <div className="form-field">
              <label htmlFor="login-email">E-Mail</label>
              <input
                id="login-email"
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((currentForm) => ({
                    ...currentForm,
                    email: event.target.value,
                  }))
                }
                placeholder="name@firma.at"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="login-password">Passwort</label>
              <input
                id="login-password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((currentForm) => ({
                    ...currentForm,
                    password: event.target.value,
                  }))
                }
                placeholder="Passwort"
                required
              />
            </div>
            <div className="form-actions auth-actions">
              <button type="submit" className="action-button form-button" disabled={isLoggingIn}>
                {isLoggingIn ? 'Prüft...' : 'Anmelden'}
              </button>
            </div>
          </form>
        </section>
      </main>
    )
  }

  if (requiresInitialSetup) {
    return (
      <main className="app auth-app">
        <header className="page-header page-header-row">
          <div>
            <img src="/logo_oc.png" alt="Ordo Cloud" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: '0.5rem' }} />
            <p className="eyebrow">{APP_NAME}</p>
            <h1>Dienstplanung für Teams</h1>
          </div>
          <button type="button" className="secondary-button header-button" onClick={handleLogout}>
            Logout
          </button>
        </header>
        {authError ? <p className="status-message status-error">{authError}</p> : null}
        <section className="panel auth-panel">
          <div className="auth-panel-header">
            <h2>Erstlogin abschließen</h2>
            <p className="panel-note">
              Bevor du den Dienstplan nutzt, hinterlege deinen Namen und setze dein persönliches
              Passwort. Dieser Schritt erscheint nur einmal.
            </p>
          </div>
          <div className="session-pill auth-session-pill">
            <span className="session-label">Benutzerkonto</span>
            <strong>{currentUser.email}</strong>
            {currentAccount ? (
              <span className="session-meta">Account: {currentAccount.name}</span>
            ) : null}
            <span className="session-meta">Rolle: {currentMembershipRole}</span>
          </div>
          <form className="auth-form" onSubmit={handleCompleteSetupSubmit}>
            <div className="form-field">
              <label htmlFor="setup-full-name">Name</label>
              <input
                id="setup-full-name"
                type="text"
                value={setupForm.fullName}
                onChange={(event) =>
                  setSetupForm((currentForm) => ({
                    ...currentForm,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Vor- und Nachname"
                autoComplete="name"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="setup-new-password">Neues Passwort</label>
              <input
                id="setup-new-password"
                type="password"
                value={setupForm.newPassword}
                onChange={(event) =>
                  setSetupForm((currentForm) => ({
                    ...currentForm,
                    newPassword: event.target.value,
                  }))
                }
                placeholder="Mindestens 8 Zeichen"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="setup-confirm-password">Neues Passwort wiederholen</label>
              <input
                id="setup-confirm-password"
                type="password"
                value={setupForm.confirmPassword}
                onChange={(event) =>
                  setSetupForm((currentForm) => ({
                    ...currentForm,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Passwort wiederholen"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="form-actions auth-actions">
              <button
                type="submit"
                className="action-button form-button"
                disabled={isCompletingSetup}
              >
                {isCompletingSetup ? 'Speichert...' : 'Erstlogin abschließen'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleLogout}
                disabled={isCompletingSetup}
              >
                Logout
              </button>
            </div>
          </form>
        </section>
      </main>
    )
  }

  const employeeSelectionWidget = (
    <section id="mitarbeiter-widget" className="panel dashboard-widget employee-widget" aria-label="Mitarbeiter">
      <div className="widget-topline">
        <div>
          <h2>Mitarbeiter</h2>
        </div>
        <div className="widget-topline-actions">
          <span className="widget-count-pill">{String(employees.length).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="employee-bar">
        {employees.length > 0 ? (
          employees.map((employee) => (
            <button
              key={employee.id}
              type="button"
              className={`employee-button${
                selectedEmployeeId === employee.id ? ' employee-button-active' : ''
              }`}
              aria-pressed={selectedEmployeeId === employee.id}
              onClick={() => setSelectedEmployeeId(employee.id)}
            >
              {getEmployeeDisplayName(employee)}
            </button>
          ))
        ) : (
          <p className="empty-state">Keine Mitarbeiter vorhanden.</p>
        )}
      </div>
    </section>
  )

  return (
    <main className="app dashboard-app">
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div className="dashboard-brand">
            <img src="/logo_oc.png" alt="Ordo Cloud" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <span className="dashboard-brand-kicker">Dienstplanung</span>
            <strong className="dashboard-brand-name">{APP_NAME}</strong>
            <span className="dashboard-brand-note">
              {currentAccount ? `${currentAccount.name} · ${dashboardWeekLabel}` : 'Cloud-Planung für Teams'}
            </span>
          </div>

          <div className="dashboard-header-controls">
            <nav className="dashboard-header-nav" aria-label="Hauptnavigation">
              {PRIMARY_DASHBOARD_NAV_ITEMS.map((item) => (
                <button
                  key={item.section}
                  type="button"
                  className={`dashboard-nav-button${
                    activeDashboardSection === item.section ? ' dashboard-nav-button-active' : ''
                  }`}
                  aria-pressed={activeDashboardSection === item.section}
                  onClick={() => navigateToDashboardSection(item.section)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div
              ref={headerMenuRef}
              className={`dashboard-legal-menu${isLegalMenuOpen ? ' dashboard-legal-menu-open' : ''}`}
            >
              <button
                type="button"
                className={`dashboard-legal-trigger${
                  isLegalSectionActive ? ' dashboard-legal-trigger-active' : ''
                }`}
                aria-expanded={isLegalMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsLegalMenuOpen((currentValue) => !currentValue)}
              >
                <span>Rechtliches</span>
                <span className="dashboard-menu-caret" aria-hidden="true">
                  ▾
                </span>
              </button>

              <div
                className={`dashboard-legal-dropdown${isLegalMenuOpen ? ' dashboard-legal-dropdown-open' : ''}`}
                role="menu"
                aria-label="Rechtliches"
                aria-hidden={!isLegalMenuOpen}
              >
                <p className="dashboard-legal-copy">
                  Basissatz für Österreich/EU. AGB nur dann ergänzen, wenn ihr sie wirklich nutzt.
                </p>

                {LEGAL_DROPDOWN_ITEMS.map((item) => (
                  <button
                    key={item.section}
                    type="button"
                    role="menuitem"
                    tabIndex={isLegalMenuOpen ? 0 : -1}
                    className={`dashboard-submenu-item${
                      activeDashboardSection === item.section ? ' dashboard-submenu-item-active' : ''
                    }`}
                    onClick={() => navigateToDashboardSection(item.section)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-user-actions">
              <div className="dashboard-user-meta">
                <span className="dashboard-user-label">{currentUserDisplayName}</span>
                <span className="dashboard-user-account">
                  {currentAccount ? currentAccount.name : 'Aktiver Account'}
                  {currentMembershipRole ? ` · ${currentMembershipRole}` : ''}
                </span>
              </div>
              <button type="button" className="dashboard-logout" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="dashboard-intro">
          <div className="dashboard-intro-row">
            <div>
              <h1>Hallo, {greetingName}!</h1>
              <p className="dashboard-date">{currentDateLabel}</p>
            </div>
          </div>
        </section>

        {isLoading ? <p className="status-message">Daten werden geladen...</p> : null}
        {loadError ? <p className="status-message status-error">{loadError}</p> : null}

        {isScheduleSectionActive ? (
          <section className="dashboard-widget-grid">
            <PlanningWorkspace
              key={`${selectedEmployeeId ?? 'none'}-${year}-${calendarWeek}-${activePlannerConfig.shiftType}`}
              calendarWeek={calendarWeek}
              customersAvailableForWidget={customersAvailableForWidget}
              customers={customers}
              customersById={customersById}
              dashboardWeekLabel={dashboardWeekLabel}
              hasScheduleConflict={hasScheduleConflict}
              isSavingSchedule={isSavingSchedule}
              onAddCustomerToWidget={addCustomerToWidget}
              onCalendarWeekChange={setCalendarWeek}
              onCopyPreviousWeek={() => copyPreviousWeekScheduleEntries(activePlannerConfig.shiftType)}
              onCreateScheduleEntry={createScheduleEntry}
              onDeleteScheduleEntry={deleteScheduleEntry}
              onMoveScheduleEntry={moveScheduleEntry}
              onRemoveCustomerFromWidget={removeCustomerFromWidget}
              onYearChange={setYear}
              plannerId={activePlannerConfig.plannerId}
              plannerTitle={activePlannerConfig.plannerTitle}
              plannerViewSwitcher={schedulePlannerViewSwitcher}
              scheduleDateRangeLabel={scheduleDateRangeLabel}
              scheduleEntries={
                scheduleEntriesForCurrentViewByShiftType[activePlannerConfig.shiftType] ?? []
              }
              selectedEmployeeId={selectedEmployeeId}
              selectedEmployeeLabel={selectedEmployeeLabel}
              shiftType={activePlannerConfig.shiftType}
              sidebarContent={employeeSelectionWidget}
              timelineEndMinutes={activePlannerConfig.timelineEndMinutes}
              timelineStartMinutes={activePlannerConfig.timelineStartMinutes}
              widgetCustomers={widgetCustomers}
              weekdays={weekdays}
              year={year}
            />

            <WeeklyOverviewWidget
              calendarWeek={calendarWeek}
              customersById={customersById}
              dashboardWeekLabel={dashboardWeekLabel}
              employees={employees}
              scheduleDateRangeLabel={scheduleDateRangeLabel}
              scheduleEntries={scheduleEntriesForSelectedWeek}
              selectedEmployeeId={selectedEmployeeId}
              weekdays={weekdays}
              year={year}
            />

            <div className="dashboard-analytics-row">
              <WeeklyHoursWidget
                dashboardWeekLabel={dashboardWeekLabel}
                employees={employees}
                scheduleEntries={scheduleEntriesForSelectedWeek}
                selectedEmployeeId={selectedEmployeeId}
              />

              <FeedbackWidget
                feedbackEntries={feedbackEntries}
                feedbackSettings={feedbackSettings}
              />
            </div>
          </section>
        ) : null}

        {isEmployeeManagementActive ? (
          <section className="dashboard-page-stack">
            <EmployeeManagementSection
              employees={employees}
              employeeForm={employeeForm}
              isSavingEmployee={isSavingEmployee}
              onBackToSchedule={() => navigateToDashboardSection('schedule')}
              onDeleteEmployee={handleEmployeeDelete}
              onEmployeeFieldChange={handleEmployeeFormFieldChange}
              onEmployeeSubmit={handleEmployeeSubmit}
              onResetEmployeeForm={resetEmployeeForm}
              onSelectEmployee={setSelectedEmployeeId}
              pendingEmployeeDeleteId={pendingEmployeeDeleteId}
              selectedEmployeeId={selectedEmployeeId}
            />
          </section>
        ) : null}

        {isCustomerManagementActive ? (
          <section className="dashboard-page-stack">
            <CustomerManagementSection
              customerForm={customerForm}
              customers={customers}
              isSavingCustomer={isSavingCustomer}
              onBackToSchedule={() => navigateToDashboardSection('schedule')}
              onCustomerFieldChange={handleCustomerFormFieldChange}
              onDeleteCustomer={handleCustomerDelete}
              onCustomerSubmit={handleCustomerSubmit}
              onResetCustomerForm={resetCustomerForm}
              pendingCustomerDeleteId={pendingCustomerDeleteId}
            />
          </section>
        ) : null}

        {isLegalSectionActive ? (
          <LegalSection
            activeSection={activeDashboardSection}
            onBackToSchedule={() => navigateToDashboardSection('schedule')}
          />
        ) : null}
      </section>
    </main>
  )
}

export default App
