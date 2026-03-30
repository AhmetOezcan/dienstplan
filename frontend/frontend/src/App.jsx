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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`)
  }

  return response.json()
}

function App() {
  const [employees, setEmployees] = useState([])
  const [customers, setCustomers] = useState([])
  const [scheduleEntries, setScheduleEntries] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false)
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false)
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerColor, setNewCustomerColor] = useState('#2563eb')
  const [year, setYear] = useState(2026)
  const [calendarWeek, setCalendarWeek] = useState(14)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)

  useEffect(() => {
    const abortController = new AbortController()

    const loadData = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const [loadedEmployees, loadedCustomers, loadedScheduleEntries] = await Promise.all([
          apiRequest('/employees', { signal: abortController.signal }),
          apiRequest('/customers', { signal: abortController.signal }),
          apiRequest('/schedule', { signal: abortController.signal }),
        ])

        setEmployees(loadedEmployees)
        setCustomers(loadedCustomers)
        setScheduleEntries(loadedScheduleEntries)
        setSelectedEmployeeId((currentEmployeeId) => {
          if (
            currentEmployeeId !== null &&
            loadedEmployees.some((employee) => employee.id === currentEmployeeId)
          ) {
            return currentEmployeeId
          }

          return loadedEmployees[0]?.id ?? null
        })
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }

        setLoadError('Daten konnten nicht vom Backend geladen werden.')
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
  }, [])

  const selectedEmployee =
    employees.find((employee) => employee.id === selectedEmployeeId) ?? null
  const customersById = Object.fromEntries(
    customers.map((customer) => [customer.id, customer]),
  )

  const resetEmployeeForm = () => {
    setNewEmployeeName('')
    setIsEmployeeFormOpen(false)
  }

  const resetCustomerForm = () => {
    setNewCustomerName('')
    setNewCustomerColor('#2563eb')
    setIsCustomerFormOpen(false)
  }

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault()

    const employeeName = newEmployeeName.trim()

    if (!employeeName || isSavingEmployee) {
      return
    }

    setIsSavingEmployee(true)

    try {
      const createdEmployee = await apiRequest('/employees', {
        method: 'POST',
        body: JSON.stringify({ name: employeeName }),
      })

      setEmployees((currentEmployees) => [...currentEmployees, createdEmployee])
      setSelectedEmployeeId(createdEmployee.id)
      setLoadError('')
      resetEmployeeForm()
    } catch (error) {
      setLoadError('Mitarbeiter konnte nicht gespeichert werden.')
    } finally {
      setIsSavingEmployee(false)
    }
  }

  const handleCustomerSubmit = async (event) => {
    event.preventDefault()

    const customerName = newCustomerName.trim()
    const customerColor = newCustomerColor.trim() || '#2563eb'

    if (!customerName || isSavingCustomer) {
      return
    }

    setIsSavingCustomer(true)

    try {
      const createdCustomer = await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify({ name: customerName, color: customerColor }),
      })

      setCustomers((currentCustomers) => [...currentCustomers, createdCustomer])
      setLoadError('')
      resetCustomerForm()
    } catch (error) {
      setLoadError('Kunde konnte nicht gespeichert werden.')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  const getScheduleEntriesForCell = (day, time) =>
    scheduleEntries.filter(
      (entry) =>
        entry.year === year &&
        entry.calendar_week === calendarWeek &&
        entry.day === day &&
        entry.time === time &&
        (selectedEmployeeId === null || entry.employee_id === selectedEmployeeId),
    )

  return (
    <main className="app">
      <header className="page-header">
        <div>
          <p className="eyebrow">Putzfirma</p>
          <h1>Dienstplan Software</h1>
        </div>
      </header>
      {isLoading ? <p className="status-message">Daten werden geladen...</p> : null}
      {loadError ? <p className="status-message status-error">{loadError}</p> : null}

      <section className="panel employee-panel" aria-label="Mitarbeiter">
        <div className="section-header">
          <h2>Mitarbeiter</h2>
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
                {employee.name}
              </button>
            ))
          ) : (
            <p className="empty-state">Keine Mitarbeiter vorhanden.</p>
          )}
        </div>
        {isEmployeeFormOpen ? (
          <form className="form-card" onSubmit={handleEmployeeSubmit}>
            <div className="form-field">
              <label htmlFor="employee-name">Mitarbeitername</label>
              <input
                id="employee-name"
                type="text"
                value={newEmployeeName}
                onChange={(event) => setNewEmployeeName(event.target.value)}
                placeholder="Neuer Mitarbeiter"
                required
              />
            </div>
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
              Ausgewaehlter Mitarbeiter:{' '}
              <span>{selectedEmployee?.name ?? 'Kein Mitarbeiter ausgewaehlt'}</span>
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

                              return (
                                <span
                                  key={entry.id}
                                  className="schedule-entry"
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
                    {customer.name}
                  </article>
                ))
              ) : (
                <p className="empty-state">Keine Kunden vorhanden.</p>
              )}
            </div>
          </section>

          <section className="panel sidebar-panel">
            <div className="action-list">
              <button
                type="button"
                className="action-button"
                disabled={isLoading}
                onClick={() => setIsCustomerFormOpen(true)}
              >
                Kunde erstellen
              </button>
            </div>
            {isCustomerFormOpen ? (
              <form className="form-card" onSubmit={handleCustomerSubmit}>
                <div className="form-field">
                  <label htmlFor="customer-name">Kundenname</label>
                  <input
                    id="customer-name"
                    type="text"
                    value={newCustomerName}
                    onChange={(event) => setNewCustomerName(event.target.value)}
                    placeholder="Reinigung Maier"
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="customer-color">Farbe</label>
                  <input
                    id="customer-color"
                    type="text"
                    value={newCustomerColor}
                    onChange={(event) => setNewCustomerColor(event.target.value)}
                    placeholder="#2563eb"
                    required
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
