import { useEffect, useRef, useState } from 'react'
import './App.css'

const weekdays = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
]

const timeSlots = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
]

const timeOptions = [...timeSlots, '18:00']
const weekdayNumberByName = Object.fromEntries(weekdays.map((day, index) => [day, index + 1]))
const timeIndexByValue = Object.fromEntries(timeOptions.map((time, index) => [time, index]))
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
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const AUTH_STORAGE_KEY = 'dienstplan_auth_session'
const SCHEDULE_ROW_HEIGHT = 72

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

function createInitialLoginForm() {
  return {
    email: '',
    password: '',
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

function getScheduleEntryDay(entry) {
  return entry.day_of_week ?? entry.day ?? ''
}

function getScheduleEntryDate(entry) {
  return entry.date ?? ''
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

function getCellKey(day, time) {
  return `${day}__${time}`
}

function getTimeIndex(time) {
  return timeIndexByValue[time] ?? -1
}

function App() {
  const initialAuthSession = getStoredAuthSession()
  const [authSession, setAuthSession] = useState(initialAuthSession)
  const [loginForm, setLoginForm] = useState(createInitialLoginForm)
  const [employees, setEmployees] = useState([])
  const [customers, setCustomers] = useState([])
  const [scheduleEntries, setScheduleEntries] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false)
  const [employeeForm, setEmployeeForm] = useState(createInitialEmployeeForm)
  const [customerForm, setCustomerForm] = useState(createInitialCustomerForm)
  const [year, setYear] = useState(2026)
  const [calendarWeek, setCalendarWeek] = useState(14)
  const [isLoading, setIsLoading] = useState(Boolean(initialAuthSession.accessToken))
  const [loadError, setLoadError] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [draggedCustomerId, setDraggedCustomerId] = useState(null)
  const [activeDropCellKey, setActiveDropCellKey] = useState('')
  const [resizeState, setResizeState] = useState(null)
  const resizeStateRef = useRef(null)
  const scheduleEntriesForCurrentViewRef = useRef([])

  const authToken = authSession.accessToken
  const currentUser = authSession.user
  const currentAccount = authSession.account
  const currentMembershipRole = authSession.membershipRole
  const isAuthenticated = Boolean(authToken && currentUser)

  useEffect(() => {
    resizeStateRef.current = resizeState
  }, [resizeState])

  useEffect(() => {
    setDraggedCustomerId(null)
    setActiveDropCellKey('')
    setResizeState(null)
  }, [selectedEmployeeId, year, calendarWeek])

  useEffect(() => {
    if (!isAuthenticated) {
      setEmployees([])
      setCustomers([])
      setScheduleEntries([])
      setSelectedEmployeeId(null)
      setIsEmployeeFormOpen(false)
      setIsLoading(false)
      return
    }

    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const [loadedEmployees, loadedCustomers, loadedScheduleEntries] = await Promise.all([
          apiRequest('/employees', {
            signal: abortController.signal,
            accessToken: authToken,
          }),
          apiRequest('/customers', {
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
          setScheduleEntries([])
          setSelectedEmployeeId(null)
          setIsEmployeeFormOpen(false)
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
  }, [authToken, isAuthenticated])

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null
  const selectedEmployeeLabel = selectedEmployee
    ? getEmployeeDisplayName(selectedEmployee)
    : 'Kein Mitarbeiter ausgewählt'
  const scheduleDateRangeLabel = getCalendarWeekDateRangeLabel(year, calendarWeek)
  const customersById = Object.fromEntries(customers.map((customer) => [customer.id, customer]))
  const scheduleEntriesForCurrentView =
    selectedEmployeeId === null
      ? []
      : scheduleEntries.filter(
          (entry) =>
            isIsoDateInCalendarWeek(getScheduleEntryDate(entry), year, calendarWeek) &&
            entry.employee_id === selectedEmployeeId,
        )
  const scheduledCustomerIds = new Set(
    scheduleEntriesForCurrentView.map((entry) => entry.customer_id),
  )
  const availableCustomers =
    selectedEmployeeId === null
      ? customers
      : customers.filter((customer) => !scheduledCustomerIds.has(customer.id))
  scheduleEntriesForCurrentViewRef.current = scheduleEntriesForCurrentView
  const scheduleEntriesByStartCell = new Map()
  const coveredScheduleCellKeys = new Set()

  for (const entry of scheduleEntriesForCurrentView) {
    const day = getScheduleEntryDay(entry)
    const startTime = getScheduleEntryStartTime(entry)
    const endTime =
      resizeState?.entryId === entry.id ? resizeState.previewEndTime : getScheduleEntryEndTime(entry)
    const startIndex = getTimeIndex(startTime)
    const endIndex = getTimeIndex(endTime)

    if (startIndex < 0 || endIndex <= startIndex) {
      continue
    }

    scheduleEntriesByStartCell.set(getCellKey(day, startTime), entry)

    for (let slotIndex = startIndex + 1; slotIndex < endIndex; slotIndex += 1) {
      const coveredTime = timeOptions[slotIndex]
      if (timeSlots.includes(coveredTime)) {
        coveredScheduleCellKeys.add(getCellKey(day, coveredTime))
      }
    }
  }

  const resetAuthenticatedApp = (message = '') => {
    clearStoredAuthSession()
    setAuthSession(createEmptyAuthSession())
    setEmployees([])
    setCustomers([])
    setScheduleEntries([])
    setSelectedEmployeeId(null)
    setIsEmployeeFormOpen(false)
    setDraggedCustomerId(null)
    setActiveDropCellKey('')
    setResizeState(null)
    setLoadError('')
    setAuthError(message)
    setIsLoading(false)
  }

  const resetEmployeeForm = () => {
    setEmployeeForm(createInitialEmployeeForm())
    setIsEmployeeFormOpen(false)
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

  const handleCustomerSubmit = async (event) => {
    event.preventDefault()

    const customerName = customerForm.name.trim()
    const address = customerForm.address.trim()
    const notes = customerForm.notes.trim()
    const customerColor = getRandomCustomerColor(customers)

    if (!customerName || isSavingCustomer) {
      return
    }

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

  const hasScheduleConflict = ({ dayOfWeek, startTime, endTime, ignoreEntryId = null }) => {
    const startIndex = getTimeIndex(startTime)
    const endIndex = getTimeIndex(endTime)

    if (startIndex < 0 || endIndex <= startIndex) {
      return true
    }

    return scheduleEntriesForCurrentView.some((entry) => {
      if (entry.id === ignoreEntryId || getScheduleEntryDay(entry) !== dayOfWeek) {
        return false
      }

      const entryStartIndex = getTimeIndex(getScheduleEntryStartTime(entry))
      const entryEndIndex = getTimeIndex(getScheduleEntryEndTime(entry))

      return startIndex < entryEndIndex && entryStartIndex < endIndex
    })
  }

  const createScheduleEntryFromDrop = async ({ customerId, dayOfWeek, startTime }) => {
    if (isSavingSchedule) {
      return
    }

    if (selectedEmployeeId === null) {
      setLoadError('Bitte zuerst einen Mitarbeiter auswählen.')
      return
    }

    const startIndex = getTimeIndex(startTime)
    const defaultEndTime = timeOptions[startIndex + 1]

    if (!Number.isInteger(customerId) || customerId <= 0 || !defaultEndTime) {
      setLoadError('Dieser Kunde konnte nicht eingeplant werden.')
      return
    }

    if (scheduledCustomerIds.has(customerId)) {
      setLoadError('Dieser Kunde ist für den ausgewählten Mitarbeiter in dieser Woche bereits eingeplant.')
      return
    }

    if (hasScheduleConflict({ dayOfWeek, startTime, endTime: defaultEndTime })) {
      setLoadError('Dieses Zeitfenster ist bereits belegt.')
      return
    }

    setIsSavingSchedule(true)

    try {
      const scheduleDate = getIsoDateForWeekday(year, calendarWeek, dayOfWeek)
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
          start_time: startTime,
          end_time: defaultEndTime,
          notes: null,
        }),
      })

      setScheduleEntries((currentEntries) =>
        sortScheduleEntries([...currentEntries, createdScheduleEntry]),
      )
      setLoadError('')
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
        return
      }

      setLoadError(error.message || 'Einsatz konnte nicht gespeichert werden.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const deleteScheduleEntry = async (entryId) => {
    if (isSavingSchedule) {
      return
    }

    setIsSavingSchedule(true)

    try {
      await apiRequest(`/schedule_entries/${entryId}`, {
        method: 'DELETE',
        accessToken: authToken,
      })

      setScheduleEntries((currentEntries) =>
        currentEntries.filter((entry) => entry.id !== entryId),
      )
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

  const handleResizeStart = (entry, event) => {
    event.preventDefault()
    event.stopPropagation()

    setResizeState({
      entryId: entry.id,
      dayOfWeek: getScheduleEntryDay(entry),
      startTime: getScheduleEntryStartTime(entry),
      originalEndTime: getScheduleEntryEndTime(entry),
      previewEndTime: getScheduleEntryEndTime(entry),
      startClientY: event.clientY,
    })
    setLoadError('')
  }

  const handleCustomerDragStart = (customerId, event) => {
    if (selectedEmployeeId === null) {
      event.preventDefault()
      setLoadError('Bitte zuerst einen Mitarbeiter auswählen.')
      return
    }

    setDraggedCustomerId(customerId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(customerId))
    setLoadError('')
  }

  const handleCustomerDragEnd = () => {
    setDraggedCustomerId(null)
    setActiveDropCellKey('')
  }

  const handleScheduleCellDragOver = (day, time, event) => {
    if (selectedEmployeeId === null || isSavingSchedule) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setActiveDropCellKey(getCellKey(day, time))
  }

  const handleScheduleCellDrop = async (day, time, event) => {
    event.preventDefault()

    const droppedCustomerId = Number(
      event.dataTransfer.getData('text/plain') || draggedCustomerId || '',
    )

    setActiveDropCellKey('')
    setDraggedCustomerId(null)

    await createScheduleEntryFromDrop({
      customerId: droppedCustomerId,
      dayOfWeek: day,
      startTime: time,
    })
  }

  const handleScheduleCellDragLeave = (day, time) => {
    const leavingCellKey = getCellKey(day, time)
    setActiveDropCellKey((currentCellKey) =>
      currentCellKey === leavingCellKey ? '' : currentCellKey,
    )
  }

  useEffect(() => {
    if (!resizeState) {
      return undefined
    }

    const getMaximumResizeSpan = (entry) => {
      const startIndex = getTimeIndex(getScheduleEntryStartTime(entry))
      if (startIndex < 0) {
        return 1
      }

      const nextStartIndex = scheduleEntriesForCurrentViewRef.current
        .filter(
          (candidate) =>
            candidate.id !== entry.id &&
            getScheduleEntryDay(candidate) === getScheduleEntryDay(entry),
        )
        .map((candidate) => getTimeIndex(getScheduleEntryStartTime(candidate)))
        .filter((candidateIndex) => candidateIndex > startIndex)
        .sort((left, right) => left - right)[0]

      const maxEndIndex =
        nextStartIndex === undefined ? timeOptions.length - 1 : nextStartIndex

      return Math.max(maxEndIndex - startIndex, 1)
    }

    const persistResizedDuration = async (entryId, nextEndTime) => {
      if (isSavingSchedule) {
        return
      }

      setIsSavingSchedule(true)

      try {
        const updatedScheduleEntry = await apiRequest(`/schedule_entries/${entryId}`, {
          method: 'PATCH',
          accessToken: authToken,
          body: JSON.stringify({
            end_time: nextEndTime,
          }),
        })

        setScheduleEntries((currentEntries) =>
          sortScheduleEntries(
            currentEntries.map((entry) => (entry.id === entryId ? updatedScheduleEntry : entry)),
          ),
        )
        setLoadError('')
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          resetAuthenticatedApp('Sitzung abgelaufen. Bitte erneut anmelden.')
          return
        }

        setLoadError(error.message || 'Dauer konnte nicht aktualisiert werden.')
      } finally {
        setIsSavingSchedule(false)
      }
    }

    const handleMouseMove = (event) => {
      const currentResizeState = resizeStateRef.current
      if (!currentResizeState) {
        return
      }

      const entry = scheduleEntriesForCurrentViewRef.current.find(
        (scheduleEntry) => scheduleEntry.id === currentResizeState.entryId,
      )
      if (!entry) {
        return
      }

      const startIndex = getTimeIndex(currentResizeState.startTime)
      const originalEndIndex = getTimeIndex(currentResizeState.originalEndTime)
      const originalSpan = Math.max(originalEndIndex - startIndex, 1)
      const deltaRows = Math.round((event.clientY - currentResizeState.startClientY) / SCHEDULE_ROW_HEIGHT)
      const maxSpan = getMaximumResizeSpan(entry)
      const nextSpan = Math.min(Math.max(originalSpan + deltaRows, 1), maxSpan)
      const nextEndTime = timeOptions[startIndex + nextSpan]

      setResizeState((previousResizeState) => {
        if (!previousResizeState || previousResizeState.previewEndTime === nextEndTime) {
          return previousResizeState
        }

        return {
          ...previousResizeState,
          previewEndTime: nextEndTime,
        }
      })
    }

    const handleMouseUp = () => {
      const finalResizeState = resizeStateRef.current
      setResizeState(null)

      if (
        !finalResizeState ||
        finalResizeState.previewEndTime === finalResizeState.originalEndTime
      ) {
        return
      }

      void persistResizedDuration(
        finalResizeState.entryId,
        finalResizeState.previewEndTime,
      )
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [authToken, isSavingSchedule, resizeState])

  if (!isAuthenticated) {
    return (
      <main className="app auth-app">
        <header className="page-header">
          <div>
            <p className="eyebrow">Putzfirma</p>
            <h1>Dienstplan Software</h1>
          </div>
        </header>
        {authError ? <p className="status-message status-error">{authError}</p> : null}
        <section className="panel auth-panel">
          <div className="auth-panel-header">
            <h2>Login</h2>
            <p className="panel-note">
              Melde dich mit deinem Benutzerkonto an. Geschützte Backend-Routen werden danach
              automatisch mit Bearer-Token aufgerufen.
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
          <p className="panel-note auth-note">
            Registrierung mit Invite-Code läuft aktuell über `POST /auth/register`.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="page-header page-header-row">
        <div>
          <p className="eyebrow">Putzfirma</p>
          <h1>Dienstplan Software</h1>
        </div>
        <div className="header-actions">
          <div className="session-pill">
            <span className="session-label">Angemeldet</span>
            <strong>{currentUser.email}</strong>
            {currentAccount ? (
              <span className="session-meta">Account: {currentAccount.name}</span>
            ) : null}
            <span className="session-meta">Rolle: {currentMembershipRole}</span>
          </div>
          <button type="button" className="secondary-button header-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      {isLoading ? <p className="status-message">Daten werden geladen...</p> : null}
      {loadError ? <p className="status-message status-error">{loadError}</p> : null}

      <section className="panel employee-panel" aria-label="Mitarbeiter">
        <div className="section-header">
          <div>
            <h2>Mitarbeiter</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Mitarbeiter erstellen"
            disabled={isLoading}
            onClick={() => setIsEmployeeFormOpen(true)}
          >
            +
          </button>
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
        {isEmployeeFormOpen ? (
          <form className="form-card" onSubmit={handleEmployeeSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="employee-phone">Telefon</label>
                <input
                  id="employee-phone"
                  type="text"
                  value={employeeForm.phone}
                  onChange={(event) =>
                    setEmployeeForm((currentForm) => ({
                      ...currentForm,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="+43 ..."
                />
              </div>
              <div className="form-field">
                <label htmlFor="employee-first-name">Vorname</label>
                <input
                  id="employee-first-name"
                  type="text"
                  value={employeeForm.firstName}
                  onChange={(event) =>
                    setEmployeeForm((currentForm) => ({
                      ...currentForm,
                      firstName: event.target.value,
                    }))
                  }
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
                  onChange={(event) =>
                    setEmployeeForm((currentForm) => ({
                      ...currentForm,
                      lastName: event.target.value,
                    }))
                  }
                  placeholder="Özcan"
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="employee-notes">Notizen</label>
              <textarea
                id="employee-notes"
                value={employeeForm.notes}
                onChange={(event) =>
                  setEmployeeForm((currentForm) => ({
                    ...currentForm,
                    notes: event.target.value,
                  }))
                }
                placeholder="Interne Hinweise"
              />
            </div>
            <p className="form-hint">
              Der Mitarbeiter gehört automatisch zu deinem Account.
            </p>
            <div className="form-actions">
              <button
                type="submit"
                className="action-button form-button"
                disabled={isSavingEmployee}
              >
                {isSavingEmployee ? 'Speichert...' : 'Speichern'}
              </button>
              <button
                type="button"
                className="secondary-button form-button"
                disabled={isSavingEmployee}
                onClick={resetEmployeeForm}
              >
                Abbrechen
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel controls-panel" aria-label="Planungsparameter">
        <div className="control-group">
          <label htmlFor="year">Jahr</label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(event) => setYear(Number(event.target.value) || 0)}
          />
        </div>
        <div className="control-group">
          <label htmlFor="calendar-week">Kalenderwoche</label>
          <input
            id="calendar-week"
            type="number"
            value={calendarWeek}
            onChange={(event) => setCalendarWeek(Number(event.target.value) || 0)}
          />
        </div>
      </section>

      <section className="content">
        <div className="panel schedule-panel">
          <div className="schedule-header">
            <p className="schedule-employee-name">{selectedEmployeeLabel}</p>
            {scheduleDateRangeLabel ? (
              <p className="schedule-date-range">{scheduleDateRangeLabel}</p>
            ) : (
              <span className="schedule-date-range-placeholder" aria-hidden="true" />
            )}
            <span className="schedule-header-spacer" aria-hidden="true" />
          </div>
          <div className="table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Uhrzeit</th>
                  {weekdays.map((day) => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((time) => (
                  <tr key={time}>
                    <th scope="row" className="time-cell">
                      {time}
                    </th>
                    {weekdays.map((day) => {
                      const cellKey = getCellKey(day, time)

                      if (coveredScheduleCellKeys.has(cellKey)) {
                        return null
                      }

                      const entry = scheduleEntriesByStartCell.get(cellKey)

                      if (entry) {
                        const customer = customersById[entry.customer_id]
                        const displayEndTime =
                          resizeState?.entryId === entry.id
                            ? resizeState.previewEndTime
                            : getScheduleEntryEndTime(entry)
                        const rowSpan = Math.max(
                          getTimeIndex(displayEndTime) -
                            getTimeIndex(getScheduleEntryStartTime(entry)),
                          1,
                        )
                        const isResizingEntry = resizeState?.entryId === entry.id

                        return (
                          <td
                            key={`${time}-${day}`}
                            rowSpan={rowSpan}
                            aria-label={`${day} ${time}`}
                            className="schedule-entry-cell"
                          >
                            <article
                              className={`schedule-entry-card${
                                isResizingEntry ? ' schedule-entry-card-resizing' : ''
                              }`}
                              title={`${customer?.name ?? `Kunde #${entry.customer_id}`} bis ${displayEndTime}`}
                              style={{
                                backgroundColor: customer?.color ?? '#475569',
                                minHeight: `calc(var(--schedule-row-height) * ${rowSpan} - 2px)`,
                              }}
                            >
                              <button
                                type="button"
                                className="schedule-entry-delete"
                                aria-label="Einsatz entfernen"
                                disabled={isSavingSchedule}
                                onClick={() => deleteScheduleEntry(entry.id)}
                              >
                                ×
                              </button>
                              <span className="schedule-entry-name">
                                {customer?.name ?? `Kunde #${entry.customer_id}`}
                              </span>
                              <span className="schedule-entry-time">
                                {getScheduleEntryStartTime(entry)} - {displayEndTime}
                              </span>
                              <button
                                type="button"
                                className="schedule-entry-resize"
                                aria-label="Einsatzdauer anpassen"
                                onMouseDown={(event) => handleResizeStart(entry, event)}
                              >
                                ⌄
                              </button>
                            </article>
                          </td>
                        )
                      }

                      const isDropTarget = activeDropCellKey === cellKey

                      return (
                        <td
                          key={`${time}-${day}`}
                          aria-label={`${day} ${time}`}
                          className={`schedule-drop-zone${
                            isDropTarget ? ' schedule-drop-zone-active' : ''
                          }`}
                          onDragOver={(event) => handleScheduleCellDragOver(day, time, event)}
                          onDrop={(event) => handleScheduleCellDrop(day, time, event)}
                          onDragLeave={() => handleScheduleCellDragLeave(day, time)}
                        >
                          <div className="schedule-drop-cell">
                            {draggedCustomerId !== null ? 'Hier ablegen' : ''}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="sidebar">
          <section className="panel sidebar-panel">
            <div className="section-header section-header-stack">
              <div>
                <h2>Offene Kunden</h2>
                <p className="panel-note">
                  Bereits eingeplante Kunden verschwinden für diese Woche und diesen Mitarbeiter aus
                  der Liste.
                </p>
              </div>
            </div>
            <div className="customer-list">
              {availableCustomers.length > 0 ? (
                availableCustomers.map((customer) => (
                  <article
                    key={customer.id}
                    className={`customer-card${
                      draggedCustomerId === customer.id ? ' customer-card-dragging' : ''
                    }${selectedEmployeeId === null ? ' customer-card-disabled' : ''}`}
                    style={{ backgroundColor: customer.color }}
                    draggable={selectedEmployeeId !== null && !isSavingSchedule}
                    onDragStart={(event) => handleCustomerDragStart(customer.id, event)}
                    onDragEnd={handleCustomerDragEnd}
                  >
                    <div className="customer-card-content">
                      <span>{customer.name}</span>
                      {customer.address ? (
                        <span className="customer-card-meta">{customer.address}</span>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : customers.length > 0 && selectedEmployeeId !== null ? (
                <p className="empty-state">
                  Alle Kunden für {selectedEmployeeLabel} in KW {calendarWeek}/{year} sind bereits
                  eingeplant.
                </p>
              ) : selectedEmployeeId === null ? (
                <p className="empty-state">Wähle zuerst einen Mitarbeiter zum Planen aus.</p>
              ) : (
                <p className="empty-state">Keine Kunden vorhanden.</p>
              )}
            </div>
          </section>

          <section className="panel sidebar-panel">
            <div className="section-header">
              <h2>Kunde erstellen</h2>
            </div>
            <form className="form-card form-card-compact" onSubmit={handleCustomerSubmit}>
              <div className="form-field">
                <label htmlFor="customer-name">Kundenname</label>
                <input
                  id="customer-name"
                  type="text"
                  value={customerForm.name}
                  onChange={(event) =>
                    setCustomerForm((currentForm) => ({
                      ...currentForm,
                      name: event.target.value,
                    }))
                  }
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
                  onChange={(event) =>
                    setCustomerForm((currentForm) => ({
                      ...currentForm,
                      address: event.target.value,
                    }))
                  }
                  placeholder="Wiener Straße 1"
                />
              </div>
              <div className="form-field">
                <label htmlFor="customer-notes">Notizen</label>
                <textarea
                  id="customer-notes"
                  value={customerForm.notes}
                  onChange={(event) =>
                    setCustomerForm((currentForm) => ({
                      ...currentForm,
                      notes: event.target.value,
                    }))
                  }
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
                  onClick={resetCustomerForm}
                >
                  Zurücksetzen
                </button>
              </div>
            </form>
          </section>

        </aside>
      </section>
    </main>
  )
}

export default App
