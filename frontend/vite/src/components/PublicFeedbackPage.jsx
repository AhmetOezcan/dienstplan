import { useEffect, useState } from 'react'
import {
  getFeedbackApiBaseUrl,
  buildFeedbackPublicUrl,
} from '../utils/feedbackPublic'

const API_BASE_URL = getFeedbackApiBaseUrl()

async function publicApiRequest(path, options = {}) {
  const { headers, ...fetchOptions } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const errorMessage =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? payload.detail
        : `API request failed with status ${response.status}`

    throw new Error(errorMessage)
  }

  return payload
}

function createInitialFeedbackForm() {
  return {
    authorName: '',
    message: '',
  }
}

export default function PublicFeedbackPage({ feedbackToken }) {
  const [feedbackPage, setFeedbackPage] = useState(null)
  const [feedbackForm, setFeedbackForm] = useState(createInitialFeedbackForm)
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCancelled = false

    const loadFeedbackPage = async () => {
      setIsLoadingPage(true)
      setErrorMessage('')

      try {
        const response = await publicApiRequest(`/public-feedback/${feedbackToken}`)
        if (!isCancelled) {
          setFeedbackPage(response)
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(error.message || 'Die Feedback-Seite konnte nicht geladen werden.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPage(false)
        }
      }
    }

    if (feedbackToken) {
      void loadFeedbackPage()
    } else {
      setErrorMessage('Kein gültiger Feedback-Link vorhanden.')
      setIsLoadingPage(false)
    }

    return () => {
      isCancelled = true
    }
  }, [feedbackToken])

  const publicDashboardUrl = buildFeedbackPublicUrl(feedbackToken).replace(/\?feedback=.*$/, '')

  const handleFieldChange = (field, value) => {
    setFeedbackForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setSubmitSuccessMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSubmitSuccessMessage('')

    try {
      await publicApiRequest(`/public-feedback/${feedbackToken}`, {
        method: 'POST',
        body: JSON.stringify({
          author_name: feedbackForm.authorName,
          message: feedbackForm.message,
        }),
      })
      setFeedbackForm(createInitialFeedbackForm())
      setSubmitSuccessMessage('Vielen Dank. Das Feedback wurde erfolgreich übermittelt.')
    } catch (error) {
      setErrorMessage(error.message || 'Das Feedback konnte nicht gesendet werden.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app auth-app feedback-public-app">
      <header className="page-header">
        <div>
          <p className="eyebrow">Feedback</p>
          <h1>Rückmeldung senden</h1>
        </div>
      </header>

      {errorMessage ? <p className="status-message status-error">{errorMessage}</p> : null}
      {submitSuccessMessage ? <p className="status-message">{submitSuccessMessage}</p> : null}

      <section className="panel auth-panel feedback-public-panel" aria-label="Feedback Formular">
        <div className="auth-panel-header">
          <h2>{feedbackPage?.account_name ?? 'Firma wird geladen...'}</h2>
          <p className="panel-note">
            {feedbackPage
              ? 'Teilen Sie Ihre Rückmeldung direkt mit dieser Firma. Ihre Nachricht erscheint anschließend im Dashboard.'
              : 'Die Zielseite wird geladen.'}
          </p>
        </div>

        <div className="feedback-public-summary">
          <div className="session-pill">
            <span className="session-label">Firma</span>
            <strong>{feedbackPage?.account_name ?? 'Wird geladen...'}</strong>
          </div>
          <a href={publicDashboardUrl || '/'} className="secondary-button header-button">
            Zur Startseite
          </a>
        </div>

        {isLoadingPage ? (
          <p className="empty-state">Feedback-Seite wird geladen...</p>
        ) : feedbackPage ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="public-feedback-author-name">Ihr Name</label>
              <input
                id="public-feedback-author-name"
                type="text"
                placeholder="Optional"
                value={feedbackForm.authorName}
                onChange={(event) => handleFieldChange('authorName', event.target.value)}
                maxLength={255}
              />
            </div>

            <div className="form-field">
              <label htmlFor="public-feedback-message">Bemerkung</label>
              <textarea
                id="public-feedback-message"
                placeholder="Ihre Rückmeldung"
                value={feedbackForm.message}
                onChange={(event) => handleFieldChange('message', event.target.value)}
                maxLength={4000}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="action-button form-button" disabled={isSubmitting}>
                {isSubmitting ? 'Wird gesendet...' : 'Feedback absenden'}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  )
}
