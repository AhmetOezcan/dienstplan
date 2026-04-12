const PRINT_PAGE_STYLE_ID = 'dynamic-print-page-style'

export function printSection(sectionId, options = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const targetSection = document.getElementById(sectionId)
  const { pageStyle = '' } = options

  if (!targetSection || typeof window.print !== 'function') {
    return
  }

  const existingPageStyle = document.getElementById(PRINT_PAGE_STYLE_ID)
  if (existingPageStyle) {
    existingPageStyle.remove()
  }

  let pageStyleElement = null
  if (pageStyle.trim()) {
    pageStyleElement = document.createElement('style')
    pageStyleElement.id = PRINT_PAGE_STYLE_ID
    pageStyleElement.textContent = pageStyle
    document.head.append(pageStyleElement)
  }

  const clearPrintTarget = () => {
    if (document.body.dataset.printTarget === sectionId) {
      delete document.body.dataset.printTarget
    }

    pageStyleElement?.remove()
  }

  window.addEventListener('afterprint', clearPrintTarget, { once: true })
  document.body.dataset.printTarget = sectionId
  window.requestAnimationFrame(() => {
    window.print()
  })
}
