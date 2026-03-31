import { useEffect, useState } from 'react'
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
const dayOrder = Object.fromEntries(weekdays.map((day, index) => [day, index]))
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const AUTH_STORAGE_KEY = 'dienstplan_auth_session'

function createEmptyAuthSession() {
  return {
    accessToken: '',
    user: null,
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
    color: '#2563eb',
    address: '',
    notes: '',
  }
}

function createInitialScheduleForm(customerId = '') {
  return {
    customerId,
    dayOfWeek: weekdays[0],
    startTime: timeSlots[0],
    endTime: timeOptions[1],
    notes: '',
  }
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
    const yearDiff = left.year - right.year
    if (yearDiff !== 0) {
      return yearDiff
    }

    const weekDiff = left.calendar_week - right.calendar_week
    if (weekDiff !== 0) {
      return weekDiff
    }

    const dayDiff =
      (dayOrder[getScheduleEntryDay(left)] ?? Number.MAX_SAFE_INTEGER) -
      (dayOrder[getScheduleEntryDay(right)] ?? Number.MAX_SAFE_INTEGER)
    if (dayDiff !== 0) {
      return dayDiff
    }

    return getScheduleEntryStartTime(left).localeCompare(getScheduleEntryStartTime(right), 'de')
  })
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
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false)
  const [employeeForm, setEmployeeForm] = useState(createInitialEmployeeForm)
  const [customerForm, setCustomerForm] = useState(createInitialCustomerForm)
  const [scheduleForm, setScheduleForm] = useState(createInitialScheduleForm)
  const [year, setYear] = useState(2026)
  const [calendarWeek, setCalendarWeek] = useState(14)
  const [isLoading, setIsLoading] = useState(Boolean(initialAuthSession.accessToken))
  const [loadError, setLoadError] = useState('')
  const [authError, setAuthError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  const authToken = authSession.accessToken
  const currentUser = authSession.user
  const isAuthenticated = Boolean(authToken && currentUser)

  useEffect(() => {
    if (!isAuthenticated) {
      setEmployees([])
      setCustomers([])
      setScheduleEntries([])
      setSelectedEmployeeId(null)
      setIsEmployeeFormOpen(false)
      setIsScheduleFormOpen(false)
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
        setScheduleForm((currentForm) => {
          const currentCustomerExists = sortedCustomers.some(
            (customer) => String(customer.id) === currentForm.customerId,
          )
          const nextCustomerId = currentCustomerExists
            ? currentForm.customerId
            : (sortedCustomers[0]?.id?.toString() ?? '')

          if (nextCustomerId === currentForm.customerId) {
            return currentForm
          }

          return {
            ...currentForm,
            customerId: nextCustomerId,
          }
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
          setIsScheduleFormOpen(false)
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

  useEffect(() => {
    setScheduleForm((currentForm) => {
      const currentCustomerExists = customers.some(
        (customer) => String(customer.id) === currentForm.customerId,
      )
      const nextCustomerId = currentCustomerExists
        ? currentForm.customerId
        : (customers[0]?.id?.toString() ?? '')

      if (nextCustomerId === currentForm.customerId) {
        return currentForm
      }

      return {
        ...currentForm,
        customerId: nextCustomerId,
      }
    })
  }, [customers])

  useEffect(() => {
    setScheduleForm((currentForm) => {
      const availableEndTimes = timeOptions.filter((value) => value > currentForm.startTime)
      const nextEndTime = availableEndTimes.includes(currentForm.endTime)
        ? currentForm.endTime
        : (availableEndTimes[0] ?? currentForm.endTime)

      if (nextEndTime === currentForm.endTime) {
        return currentForm
      }

      return {
        ...currentForm,
        endTime: nextEndTime,
      }
    })
  }, [scheduleForm.startTime])

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null
  const selectedEmployeeLabel = selectedEmployee
    ? getEmployeeDisplayName(selectedEmployee)
    : 'Kein Mitarbeiter ausgewaehlt'
  const customersById = Object.fromEntries(customers.map((customer) => [customer.id, customer]))
  const endTimeOptions = timeOptions.filter((value) => value > scheduleForm.startTime)

  const resetAuthenticatedApp = (message = '') => {
    clearStoredAuthSession()
    setAuthSession(createEmptyAuthSession())
    setEmployees([])
    setCustomers([])
    setScheduleEntries([])
    setSelectedEmployeeId(null)
    setIsEmployeeFormOpen(false)
    setIsScheduleFormOpen(false)
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

  const resetScheduleForm = () => {
    setScheduleForm(createInitialScheduleForm(customers[0]?.id?.toString() ?? ''))
    setIsScheduleFormOpen(false)
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
      setLoadError('Vorname fuer den Mitarbeiter fehlt.')
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
    const customerColor = customerForm.color.trim() || '#2563eb'
    const address = customerForm.address.trim()
    const notes = customerForm.notes.trim()

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

  const handleScheduleSubmit = async (event) => {
    event.preventDefault()

    const customerId = Number(scheduleForm.customerId)
    const notes = scheduleForm.notes.trim()

    if (isSavingSchedule) {
      return
    }

    if (selectedEmployeeId === null) {
      setLoadError('Bitte zuerst einen Mitarbeiter auswaehlen.')
      return
    }

    if (!currentUser) {
      setLoadError('Bitte zuerst anmelden.')
      return
    }

    if (!Number.isInteger(customerId) || customerId <= 0) {
      setLoadError('Bitte einen gueltigen Kunden fuer den Einsatz waehlen.')
      return
    }

    if (scheduleForm.startTime >= scheduleForm.endTime) {
      setLoadError('Die Endzeit muss spaeter als die Startzeit sein.')
      return
    }

    setIsSavingSchedule(true)

    try {
      const createdScheduleEntry = await apiRequest('/schedule_entries', {
        method: 'POST',
        accessToken: authToken,
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          customer_id: customerId,
          year,
          calendar_week: calendarWeek,
          day_of_week: scheduleForm.dayOfWeek,
          start_time: scheduleForm.startTime,
          end_time: scheduleForm.endTime,
          notes: notes || null,
        }),
      })

      setScheduleEntries((currentEntries) =>
        sortScheduleEntries([...currentEntries, createdScheduleEntry]),
      )
      setLoadError('')
      resetScheduleForm()
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

  const getScheduleEntriesForCell = (day, time) =>
    scheduleEntries.filter(
      (entry) =>
        entry.year === year &&
        entry.calendar_week === calendarWeek &&
        getScheduleEntryDay(entry) === day &&
        getScheduleEntryStartTime(entry) === time &&
        (selectedEmployeeId === null || entry.employee_id === selectedEmployeeId),
    )

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
              Melde dich mit deinem Benutzerkonto an. Geschuetzte Backend-Routen werden danach
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
                {isLoggingIn ? 'Prueft...' : 'Anmelden'}
              </button>
            </div>
          </form>
          <p className="panel-note auth-note">
            Registrierung mit Invite-Code laeuft aktuell ueber `POST /auth/register`.
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
            <span className="session-meta">Rolle: {currentUser.role}</span>
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
            <p className="panel-note">Mitarbeiter werden automatisch deinem eingeloggten Account zugeordnet.</p>
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
                  placeholder="Oezcan"
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
              Der Mitarbeiter gehoert automatisch zu deinem Account.
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
            <h2>Dienstplan</h2>
            <p className="selected-employee">
              Ausgewaehlter Mitarbeiter: <span>{selectedEmployeeLabel}</span>
            </p>
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
                      const cellEntries = getScheduleEntriesForCell(day, time)

                      return (
                        <td key={`${time}-${day}`} aria-label={`${day} ${time}`}>
                          <div className="schedule-cell-content">
                            {cellEntries.map((entry) => {
                              const customer = customersById[entry.customer_id]
                              const endTime = getScheduleEntryEndTime(entry)

                              return (
                                <span
                                  key={entry.id}
                                  className="schedule-entry"
                                  title={`${customer?.name ?? `Kunde #${entry.customer_id}`}${
                                    endTime ? ` bis ${endTime}` : ''
                                  }`}
                                  style={{
                                    backgroundColor: customer?.color ?? '#475569',
                                  }}
                                >
                                  {customer?.name ?? `Kunde #${entry.customer_id}`}
                                </span>
                              )
                            })}
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
            <h2>Kunden</h2>
            <div className="customer-list">
              {customers.length > 0 ? (
                customers.map((customer) => (
                  <article
                    key={customer.id}
                    className="customer-card"
                    style={{ backgroundColor: customer.color }}
                  >
                    <div className="customer-card-content">
                      <span>{customer.name}</span>
                      {customer.address ? (
                        <span className="customer-card-meta">{customer.address}</span>
                      ) : null}
                    </div>
                  </article>
                ))
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
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="customer-color">Farbe</label>
                  <input
                    id="customer-color"
                    type="text"
                    value={customerForm.color}
                    onChange={(event) =>
                      setCustomerForm((currentForm) => ({
                        ...currentForm,
                        color: event.target.value,
                      }))
                    }
                    placeholder="#2563eb"
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
                    placeholder="Wiener Strasse 1"
                  />
                </div>
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
                  placeholder="Zugang, Schluessel, Besonderheiten"
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
                  Zuruecksetzen
                </button>
              </div>
            </form>
          </section>

          <section className="panel sidebar-panel">
            <div className="section-header">
              <div>
                <h2>Einsatz erstellen</h2>
                <p className="panel-note">
                  {selectedEmployee
                    ? `Fuer ${selectedEmployeeLabel} in KW ${calendarWeek}/${year}.`
                    : 'Zuerst einen Mitarbeiter auswaehlen.'}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Einsatz erstellen"
                disabled={isLoading || selectedEmployeeId === null || customers.length === 0}
                onClick={() => setIsScheduleFormOpen(true)}
              >
                +
              </button>
            </div>
            {selectedEmployeeId === null ? (
              <p className="empty-state">Kein Mitarbeiter ausgewaehlt.</p>
            ) : null}
            {selectedEmployeeId !== null && customers.length === 0 ? (
              <p className="empty-state">Lege zuerst einen Kunden an.</p>
            ) : null}
            {isScheduleFormOpen ? (
              <form className="form-card" onSubmit={handleScheduleSubmit}>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="schedule-customer">Kunde</label>
                    <select
                      id="schedule-customer"
                      value={scheduleForm.customerId}
                      onChange={(event) =>
                        setScheduleForm((currentForm) => ({
                          ...currentForm,
                          customerId: event.target.value,
                        }))
                      }
                      required
                    >
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="schedule-day">Wochentag</label>
                    <select
                      id="schedule-day"
                      value={scheduleForm.dayOfWeek}
                      onChange={(event) =>
                        setScheduleForm((currentForm) => ({
                          ...currentForm,
                          dayOfWeek: event.target.value,
                        }))
                      }
                    >
                      {weekdays.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="schedule-start-time">Startzeit</label>
                    <select
                      id="schedule-start-time"
                      value={scheduleForm.startTime}
                      onChange={(event) =>
                        setScheduleForm((currentForm) => ({
                          ...currentForm,
                          startTime: event.target.value,
                        }))
                      }
                    >
                      {timeSlots.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="schedule-end-time">Endzeit</label>
                    <select
                      id="schedule-end-time"
                      value={scheduleForm.endTime}
                      onChange={(event) =>
                        setScheduleForm((currentForm) => ({
                          ...currentForm,
                          endTime: event.target.value,
                        }))
                      }
                    >
                      {endTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="schedule-notes">Notizen</label>
                  <textarea
                    id="schedule-notes"
                    value={scheduleForm.notes}
                    onChange={(event) =>
                      setScheduleForm((currentForm) => ({
                        ...currentForm,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Hinweise zum Einsatz"
                  />
                </div>
                <p className="form-hint">
                  Jahr und Kalenderwoche kommen aus den oberen Steuerfeldern. Erstellt wird der
                  Eintrag als {currentUser.email}.
                </p>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="action-button form-button"
                    disabled={isSavingSchedule}
                  >
                    {isSavingSchedule ? 'Speichert...' : 'Einsatz speichern'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button form-button"
                    disabled={isSavingSchedule}
                    onClick={resetScheduleForm}
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
