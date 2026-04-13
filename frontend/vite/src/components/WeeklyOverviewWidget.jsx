import { printSection } from '../utils/printSection'
import {
  getDurationHoursBetweenTimes,
  getScheduleTimeRangeLabel,
} from '../utils/scheduleTime'

function getEmployeeDisplayName(employee) {
  if (!employee) {
    return ''
  }

  if (employee.name) {
    return employee.name
  }

  return [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim()
}

const EMPLOYEE_AVATAR_COLORS = [
  '#1d4ed8',
  '#2563eb',
  '#c2410c',
  '#7c3aed',
  '#be123c',
  '#0369a1',
  '#1e40af',
  '#b45309',
  '#4338ca',
  '#9f1239',
  '#0ea5e9',
  '#374151',
]

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

function getScheduleEntryDurationHours(entry) {
  return getDurationHoursBetweenTimes(getScheduleEntryStartTime(entry), getScheduleEntryEndTime(entry))
}

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

function formatAssignmentCount(count) {
  return count === 1 ? '1 Einsatz' : `${count} Einsätze`
}

function getEmployeeAvatarLabel(employeeLabel) {
  if (typeof employeeLabel !== 'string') {
    return '??'
  }

  const nameParts = employeeLabel
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (nameParts.length === 0) {
    return '??'
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase()
  }

  return `${nameParts[0][0] ?? ''}${nameParts[nameParts.length - 1][0] ?? ''}`.toUpperCase()
}

function getEmployeeAvatarColor(employeeId) {
  const normalizedId = Number.isInteger(employeeId) ? employeeId : 0
  return EMPLOYEE_AVATAR_COLORS[Math.abs(normalizedId) % EMPLOYEE_AVATAR_COLORS.length]
}

function WeeklyOverviewWidget({
  calendarWeek,
  customersById,
  dashboardWeekLabel,
  employees,
  scheduleDateRangeLabel,
  scheduleEntries,
  selectedEmployeeId,
  weekdays,
  year,
}) {
  const entriesByEmployeeId = {}
  const summariesByEmployeeId = {}

  scheduleEntries.forEach((entry) => {
    const employeeId = entry.employee_id
    const dayOfWeek = getScheduleEntryDay(entry)

    if (!entriesByEmployeeId[employeeId]) {
      entriesByEmployeeId[employeeId] = {}
    }

    if (!entriesByEmployeeId[employeeId][dayOfWeek]) {
      entriesByEmployeeId[employeeId][dayOfWeek] = []
    }

    if (!summariesByEmployeeId[employeeId]) {
      summariesByEmployeeId[employeeId] = {
        assignmentCount: 0,
        totalHours: 0,
      }
    }

    entriesByEmployeeId[employeeId][dayOfWeek].push(entry)
    summariesByEmployeeId[employeeId].assignmentCount += 1
    summariesByEmployeeId[employeeId].totalHours += getScheduleEntryDurationHours(entry)
  })

  const totalAssignments = scheduleEntries.length
  const scheduledEmployeesCount = employees.filter(
    (employee) => (summariesByEmployeeId[employee.id]?.assignmentCount ?? 0) > 0,
  ).length
  const scheduledEmployeesLabel =
    scheduledEmployeesCount === 1
      ? '1 Mitarbeiter ist eingeplant.'
      : `${scheduledEmployeesCount} Mitarbeiter sind eingeplant.`

  return (
    <section
      id="wochenuebersicht-widget"
      className="panel dashboard-widget weekly-overview-widget"
      aria-label="Wochenübersicht"
    >
      <div className="widget-topline">
        <div>
          <h2>Wochenübersicht</h2>
          <p className="widget-note">
            Alle Mitarbeitenden und Aufträge in {dashboardWeekLabel}. {scheduledEmployeesLabel}
          </p>
        </div>
        <div className="widget-topline-actions">
          <button
            type="button"
            className="secondary-button widget-print-button"
            onClick={() =>
              printSection('wochenuebersicht-widget', {
                pageStyle: '@page { size: A4 landscape; margin: 10mm; }',
              })
            }
          >
            Drucken
          </button>
          <span className="widget-count-pill widget-count-pill-accent">
            {String(totalAssignments).padStart(2, '0')}
          </span>
        </div>
      </div>

      {employees.length === 0 ? (
        <p className="empty-state">Keine Mitarbeiter vorhanden.</p>
      ) : (
        <>
          <div className="weekly-overview-board">
            <table className="weekly-overview-table">
              <thead>
                <tr>
                  <th scope="col" className="weekly-overview-corner">
                    <div className="weekly-overview-corner-content">
                      <span className="weekly-overview-kicker">Mitarbeiter</span>
                      <strong>{String(employees.length).padStart(2, '0')} gesamt</strong>
                    </div>
                  </th>
                  {weekdays.map((day) => (
                    <th key={day} scope="col" className="weekly-overview-day-header">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {employees.map((employee, index) => {
                  const employeeLabel = getEmployeeDisplayName(employee)
                  const employeeAvatarLabel = getEmployeeAvatarLabel(employeeLabel)
                  const employeeAvatarColor = getEmployeeAvatarColor(employee.id)
                  const summary = summariesByEmployeeId[employee.id] ?? {
                    assignmentCount: 0,
                    totalHours: 0,
                  }

                  return (
                    <tr
                      key={employee.id}
                      className={`weekly-overview-row${
                        selectedEmployeeId === employee.id ? ' weekly-overview-row-selected' : ''
                      }`}
                    >
                      <th scope="row" className="weekly-overview-row-header">
                        <div className="weekly-overview-employee">
                          <div className="weekly-overview-employee-topline">
                            <div
                              className="weekly-overview-avatar"
                              style={{
                                '--weekly-overview-avatar-color': employeeAvatarColor,
                              }}
                              aria-hidden="true"
                            >
                              <span className="weekly-overview-avatar-label">
                                {employeeAvatarLabel}
                              </span>
                              <span className="weekly-overview-avatar-index">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                            </div>

                            <div className="weekly-overview-employee-copy">
                              <strong>{employeeLabel}</strong>
                              <div className="weekly-overview-employee-meta">
                                <span>{formatAssignmentCount(summary.assignmentCount)}</span>
                                <span>{formatHourCount(summary.totalHours)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </th>

                      {weekdays.map((day) => {
                        const dayEntries = entriesByEmployeeId[employee.id]?.[day] ?? []

                        return (
                          <td key={`${employee.id}-${day}`} className="weekly-overview-cell">
                            {dayEntries.length > 0 ? (
                              <div className="weekly-overview-assignment-list">
                                {dayEntries.map((entry) => {
                                  const customer = customersById[entry.customer_id]
                                  const startTime = getScheduleEntryStartTime(entry)
                                  const endTime = getScheduleEntryEndTime(entry)
                                  const timeRangeLabel = getScheduleTimeRangeLabel(startTime, endTime)
                                  const customerLabel =
                                    customer?.name ?? `Kunde #${entry.customer_id}`

                                  return (
                                    <article
                                      key={entry.id}
                                      className="weekly-overview-assignment"
                                      style={{
                                        '--weekly-overview-accent': customer?.color ?? '#334155',
                                      }}
                                      title={`${employeeLabel} · ${day} · ${timeRangeLabel} · ${customerLabel}${
                                        customer?.address ? ` · ${customer.address}` : ''
                                      }`}
                                    >
                                      <span className="weekly-overview-assignment-time">
                                        {timeRangeLabel}
                                      </span>
                                      <strong className="weekly-overview-assignment-name">
                                        {customerLabel}
                                      </strong>
                                    </article>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="weekly-overview-empty">frei</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="weekly-overview-print-sheet" aria-hidden="true">
            <header className="weekly-overview-print-header">
              <strong className="weekly-overview-print-title">Wochenübersicht</strong>
              <div className="weekly-overview-print-meta">
                <span>
                  <strong>KW</strong> {calendarWeek}
                </span>
                <span>
                  <strong>Jahr</strong> {year}
                </span>
                <span>
                  <strong>Datum</strong> {scheduleDateRangeLabel || '-'}
                </span>
                <span>
                  <strong>Mitarbeiter</strong> {String(employees.length).padStart(2, '0')}
                </span>
                <span>
                  <strong>Einsätze</strong> {String(totalAssignments).padStart(2, '0')}
                </span>
              </div>
            </header>

            <table className="weekly-overview-print-table">
              <colgroup>
                <col className="weekly-overview-print-col-employee" />
                {weekdays.map((day) => (
                  <col key={`print-col-${day}`} className="weekly-overview-print-col-day" />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th scope="col">Mitarbeiter</th>
                  {weekdays.map((day) => (
                    <th key={`print-${day}`} scope="col">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => {
                  const employeeLabel = getEmployeeDisplayName(employee)
                  const summary = summariesByEmployeeId[employee.id] ?? {
                    assignmentCount: 0,
                    totalHours: 0,
                  }

                  return (
                    <tr key={`print-${employee.id}`}>
                      <th scope="row" className="weekly-overview-print-employee-cell">
                        <strong>{employeeLabel}</strong>
                        <span>
                          {formatAssignmentCount(summary.assignmentCount)} ·{' '}
                          {formatHourCount(summary.totalHours)}
                        </span>
                      </th>

                      {weekdays.map((day) => {
                        const dayEntries = entriesByEmployeeId[employee.id]?.[day] ?? []

                        return (
                          <td
                            key={`print-${employee.id}-${day}`}
                            className="weekly-overview-print-cell"
                          >
                            {dayEntries.length > 0 ? (
                              <div className="weekly-overview-print-assignment-list">
                                {dayEntries.map((entry) => {
                                  const customer = customersById[entry.customer_id]
                                  const startTime = getScheduleEntryStartTime(entry)
                                  const endTime = getScheduleEntryEndTime(entry)
                                  const timeRangeLabel = getScheduleTimeRangeLabel(startTime, endTime)
                                  const customerLabel =
                                    customer?.name ?? `Kunde #${entry.customer_id}`

                                  return (
                                    <article
                                      key={`print-entry-${entry.id}`}
                                      className="weekly-overview-print-assignment"
                                      style={{
                                        '--weekly-overview-print-accent':
                                          customer?.color ?? '#334155',
                                      }}
                                    >
                                      <span className="weekly-overview-print-assignment-time">
                                        {timeRangeLabel}
                                      </span>
                                      <strong>{customerLabel}</strong>
                                    </article>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="weekly-overview-print-empty">-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

export default WeeklyOverviewWidget
