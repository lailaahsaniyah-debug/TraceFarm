
import { useState } from 'react'

const DEFAULT_PROFILE = {
  name: 'TraceFarm Admin',
  email: 'admin@tracefarm.com',
  organization: 'TraceFarm Agriculture'
}

const DEFAULT_PREFERENCES = {
  language: 'English',
  timezone: 'Asia/Jakarta',
  dateFormat: 'DD/MM/YYYY'
}

const DEFAULT_NOTIFICATIONS = {
  products: true,
  verification: true,
  tracking: true,
  reports: false
}

function loadSettings(key, fallback) {
  try {
    const saved = localStorage.getItem(key)

    if (!saved) return fallback

    const parsed = JSON.parse(saved)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback
    }

    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

function Settings() {
  const [profile, setProfile] = useState(() =>
    loadSettings('tracefarm-profile', DEFAULT_PROFILE)
  )

  const [preferences, setPreferences] = useState(() =>
    loadSettings('tracefarm-preferences', DEFAULT_PREFERENCES)
  )

  const [notifications, setNotifications] = useState(() =>
    loadSettings('tracefarm-notifications', DEFAULT_NOTIFICATIONS)
  )

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: ''
  })

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const showMessage = (text, type = 'success') => {
    setMessage(text)
    setMessageType(type)
  }

  const updateProfile = (field, value) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updatePreference = (field, value) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const toggleNotification = field => {
    setNotifications(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const saveSettings = () => {
    if (!profile.name.trim()) {
      showMessage('Full name is required.', 'error')
      return
    }

    if (!profile.email.trim()) {
      showMessage('Email address is required.', 'error')
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(profile.email.trim())) {
      showMessage('Please enter a valid email address.', 'error')
      return
    }

    if (!profile.organization.trim()) {
      showMessage('Organization name is required.', 'error')
      return
    }

    try {
      localStorage.setItem(
        'tracefarm-profile',
        JSON.stringify({
          ...profile,
          name: profile.name.trim(),
          email: profile.email.trim(),
          organization: profile.organization.trim()
        })
      )

      localStorage.setItem(
        'tracefarm-preferences',
        JSON.stringify(preferences)
      )

      localStorage.setItem(
        'tracefarm-notifications',
        JSON.stringify(notifications)
      )

      showMessage('Settings saved successfully!')
    } catch (error) {
      console.error('Save settings error:', error)

      showMessage(
        'Unable to save settings in this browser.',
        'error'
      )
    }
  }

  const changePassword = () => {
    if (
      !password.current ||
      !password.new ||
      !password.confirm
    ) {
      showMessage(
        'Please complete all password fields.',
        'error'
      )
      return
    }

    if (password.new.length < 8) {
      showMessage(
        'New password must contain at least 8 characters.',
        'error'
      )
      return
    }

    if (password.new !== password.confirm) {
      showMessage(
        'New password and confirmation do not match.',
        'error'
      )
      return
    }

    showMessage(
      'Password change is not available yet. Backend authentication must be implemented first.',
      'error'
    )
  }

  return (
    <div className="page-content settings-page">
      <div className="page-header">
        <span className="page-eyebrow">PREFERENCES & CONTROL</span>
        <h1>Settings</h1>
        <p>
          Manage your TraceFarm account and application preferences.
        </p>
      </div>

      {message && (
        <div
          className={`settings-message ${messageType}`}
          role="status"
        >
          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      <div className="settings-layout">
        <div className="settings-main">

          <section className="settings-card">
            <div className="settings-section-heading">
              <div className="settings-section-icon">♙</div>

              <div>
                <h2>Profile Information</h2>
                <p>
                  Manage your account and organization details.
                </p>
              </div>
            </div>

            <div className="settings-form-grid">
              <label>
                Full Name
                <input
                  type="text"
                  value={profile.name}
                  onChange={e =>
                    updateProfile('name', e.target.value)
                  }
                  placeholder="Enter your name"
                />
              </label>

              <label>
                Email Address
                <input
                  type="email"
                  value={profile.email}
                  onChange={e =>
                    updateProfile('email', e.target.value)
                  }
                  placeholder="Enter your email"
                />
              </label>

              <label className="settings-full-width">
                Organization
                <input
                  type="text"
                  value={profile.organization}
                  onChange={e =>
                    updateProfile('organization', e.target.value)
                  }
                  placeholder="Enter organization name"
                />
              </label>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-section-heading">
              <div className="settings-section-icon">⚙</div>

              <div>
                <h2>General Preferences</h2>
                <p>
                  Customize how information appears in TraceFarm.
                </p>
              </div>
            </div>

            <div className="settings-form-grid">
              <label>
                Language
                <select
                  value={preferences.language}
                  onChange={e =>
                    updatePreference('language', e.target.value)
                  }
                >
                  <option value="English">English</option>
                  <option value="Bahasa Indonesia">
                    Bahasa Indonesia
                  </option>
                </select>
              </label>

              <label>
                Timezone
                <select
                  value={preferences.timezone}
                  onChange={e =>
                    updatePreference('timezone', e.target.value)
                  }
                >
                  <option value="Asia/Jakarta">
                    Jakarta (GMT+7)
                  </option>
                  <option value="Asia/Makassar">
                    Makassar (GMT+8)
                  </option>
                  <option value="Asia/Jayapura">
                    Jayapura (GMT+9)
                  </option>
                </select>
              </label>

              <label className="settings-full-width">
                Date Format
                <select
                  value={preferences.dateFormat}
                  onChange={e =>
                    updatePreference('dateFormat', e.target.value)
                  }
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-section-heading">
              <div className="settings-section-icon">♧</div>

              <div>
                <h2>Notifications</h2>
                <p>
                  Choose which updates you want to receive.
                </p>
              </div>
            </div>

            <div className="settings-toggle-list">
              {[
                [
                  'products',
                  'New Products',
                  'When a new product is registered.'
                ],
                [
                  'verification',
                  'Verification Updates',
                  'When product verification status changes.'
                ],
                [
                  'tracking',
                  'Supply Chain Tracking',
                  'When a shipment or tracking stage is updated.'
                ],
                [
                  'reports',
                  'Weekly Reports',
                  'Receive weekly activity summaries.'
                ]
              ].map(([key, title, description]) => (
                <div
                  className="settings-toggle-row"
                  key={key}
                >
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>

                  <button
                    type="button"
                    className={`settings-switch ${
                      notifications[key] ? 'active' : ''
                    }`}
                    onClick={() => toggleNotification(key)}
                    aria-label={`Toggle ${title}`}
                    aria-pressed={Boolean(notifications[key])}
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-section-heading">
              <div className="settings-section-icon">♧</div>

              <div>
                <h2>Security</h2>
                <p>Update your account password.</p>
              </div>
            </div>

            <div className="settings-form-grid">
              <label className="settings-full-width">
                Current Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password.current}
                  onChange={e =>
                    setPassword(prev => ({
                      ...prev,
                      current: e.target.value
                    }))
                  }
                  placeholder="Enter current password"
                />
              </label>

              <label>
                New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password.new}
                  onChange={e =>
                    setPassword(prev => ({
                      ...prev,
                      new: e.target.value
                    }))
                  }
                  placeholder="Minimum 8 characters"
                />
              </label>

              <label>
                Confirm Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password.confirm}
                  onChange={e =>
                    setPassword(prev => ({
                      ...prev,
                      confirm: e.target.value
                    }))
                  }
                  placeholder="Confirm new password"
                />
              </label>
            </div>

            <button
              type="button"
              className="settings-secondary-button"
              onClick={changePassword}
            >
              Update Password
            </button>
          </section>

          <div className="settings-save-area">
            <button
              type="button"
              className="settings-save-button"
              onClick={saveSettings}
            >
              Save Changes
            </button>
          </div>
        </div>

        <aside className="settings-side">
          <div className="settings-info-card">
            <div className="settings-info-icon">🌱</div>

            <h3>TraceFarm</h3>

            <p>
              Agricultural traceability and product verification platform.
            </p>

            <span>Application Version 1.0.0</span>
          </div>

          <div className="settings-info-card">
            <h3>Account Status</h3>

            <div className="settings-account-status">
              <span className="settings-status-dot" />
              Demo Account
            </div>

            <p>
              Account information is currently stored locally in this browser.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Settings
