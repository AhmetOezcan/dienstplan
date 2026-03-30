import './App.css'

const employees = ['Ahmet', 'Ali', 'Mehmet', 'Fatma']

const customers = [
  { name: 'Hotel Alpenblick', color: '#2563eb' },
  { name: 'Praxis Huber', color: '#10b981' },
  { name: 'Baeckerei Kaya', color: '#f59e0b' },
  { name: 'Mueller Buero', color: '#ef4444' },
]

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

function App() {
  return (
    <main className="app">
      <header className="page-header">
        <div>
          <p className="eyebrow">Putzfirma</p>
          <h1>Dienstplan Software</h1>
        </div>
      </header>

      <section className="panel employee-panel" aria-label="Mitarbeiter">
        <div className="section-header">
          <h2>Mitarbeiter</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Mitarbeiter erstellen"
          >
            +
          </button>
        </div>
        <div className="employee-bar">
          {employees.map((employee) => (
            <button key={employee} type="button" className="employee-button">
              {employee}
            </button>
          ))}
        </div>
      </section>

      <section className="panel controls-panel" aria-label="Planungsparameter">
        <div className="control-group">
          <label htmlFor="year">Jahr</label>
          <input id="year" type="number" defaultValue="2026" />
        </div>
        <div className="control-group">
          <label htmlFor="calendar-week">Kalenderwoche</label>
          <input id="calendar-week" type="number" defaultValue="14" />
        </div>
      </section>

      <section className="content">
        <div className="panel schedule-panel">
          <h2>Dienstplan</h2>
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
                    {weekdays.map((day) => (
                      <td key={`${time}-${day}`} aria-label={`${day} ${time}`}></td>
                    ))}
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
              {customers.map((customer) => (
                <article
                  key={customer.name}
                  className="customer-card"
                  style={{ backgroundColor: customer.color }}
                >
                  {customer.name}
                </article>
              ))}
            </div>
          </section>

          <section className="panel sidebar-panel">
            <div className="action-list">
              <button type="button" className="action-button">
                Kunde erstellen
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
