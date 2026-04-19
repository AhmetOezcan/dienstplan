import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import PublicFeedbackPage from './components/PublicFeedbackPage.jsx'
import { getFeedbackTokenFromLocation } from './utils/feedbackPublic'

const feedbackToken = getFeedbackTokenFromLocation()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {feedbackToken ? <PublicFeedbackPage feedbackToken={feedbackToken} /> : <App />}
  </StrictMode>,
)
