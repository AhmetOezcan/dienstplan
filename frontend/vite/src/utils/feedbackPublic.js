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

export function getFeedbackApiBaseUrl() {
  return (
    normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) || getDefaultApiBaseUrl()
  )
}

export function getFeedbackTokenFromLocation() {
  if (typeof window === 'undefined') {
    return ''
  }

  const url = new URL(window.location.href)
  return url.searchParams.get('feedback')?.trim() ?? ''
}

export function buildFeedbackPublicUrl(feedbackPublicToken) {
  if (typeof feedbackPublicToken !== 'string' || !feedbackPublicToken.trim()) {
    return ''
  }

  if (typeof window === 'undefined') {
    return `/?feedback=${encodeURIComponent(feedbackPublicToken.trim())}`
  }

  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('feedback', feedbackPublicToken.trim())
  return url.toString()
}

export function buildFeedbackQrCodeUrl(feedbackPublicUrl, options = {}) {
  if (typeof feedbackPublicUrl !== 'string' || !feedbackPublicUrl.trim()) {
    return ''
  }

  const format = options.format === 'svg' ? 'svg' : 'png'
  const size = Number.isInteger(options.size) && options.size > 0 ? options.size : 240

  return `https://api.qrserver.com/v1/create-qr-code/?format=${format}&size=${size}x${size}&data=${encodeURIComponent(feedbackPublicUrl)}`
}
