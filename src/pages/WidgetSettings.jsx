import { useState, useEffect } from 'react'
import { settingsApi } from '../api'

const defaultSettings = {
  bot_id: '',
  bot_logo: '',
  bot_name: '',
  theme_color: '#6366f1',
  locale: 'th',
  logged_in_greeting: '',
  greeting_message: '',
  default_open: false
}

export default function WidgetSettings() {
  const [settings, setSettings] = useState(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    settingsApi.get().then(r => {
      setSettings({ ...defaultSettings, ...r.data })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.update(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const embedCode = `<div id="bn-root"></div>
<script>window.onload = function() { BN.init({ version: '1.0' }) }</script>
<script>
  (function(d, s, id) {
    var js, bjs = d.getElementsByTagName(s)[0];
    if(d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = 'https://console.botnoi.ai/customerchat/index.js';
    bjs.parentNode.insertBefore(js, bjs);
  }(document, 'script', 'bn-jssdk'));
</script>
<div class="bn-customerchat"
  bot_id="${settings.bot_id}"${settings.bot_logo ? `\n  bot_logo="${settings.bot_logo}"` : ''}${settings.bot_name ? `\n  bot_name="${settings.bot_name}"` : ''}${settings.theme_color ? `\n  theme_color="${settings.theme_color}"` : ''}
  locale="${settings.locale}"${settings.logged_in_greeting ? `\n  logged_in_greeting="${settings.logged_in_greeting}"` : ''}${settings.greeting_message ? `\n  greeting_message="${settings.greeting_message}"` : ''}
  default_open="${settings.default_open}">
</div>`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Widget Settings</h1>
        <p className="text-gray-500 mt-1">กำหนดค่า Botnoi Webchat Widget สำหรับการทดสอบ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">การตั้งค่าหลัก</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Bot ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="6087c4d5e527050749207d18"
                  value={settings.bot_id}
                  onChange={e => handleChange('bot_id', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Bot Logo URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="https://..."
                  value={settings.bot_logo}
                  onChange={e => handleChange('bot_logo', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Bot Display Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ชื่อที่แสดงของบอท"
                  value={settings.bot_name}
                  onChange={e => handleChange('bot_name', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">ตั้งค่าการแสดงผล</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Theme Color</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    className="h-10 w-16 rounded-lg border border-gray-300 cursor-pointer p-1"
                    value={settings.theme_color}
                    onChange={e => handleChange('theme_color', e.target.value)}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="#6366f1"
                    value={settings.theme_color}
                    onChange={e => handleChange('theme_color', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label">Locale</label>
                <select
                  className="input"
                  value={settings.locale}
                  onChange={e => handleChange('locale', e.target.value)}
                >
                  <option value="th">Thai (th)</option>
                  <option value="en">English (en)</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Default Open</p>
                  <p className="text-xs text-gray-500">เปิด chat room โดยอัตโนมัติ</p>
                </div>
                <button
                  onClick={() => handleChange('default_open', !settings.default_open)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.default_open ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.default_open ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">ข้อความต้อนรับ</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Logged-in Greeting</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ยินดีต้อนรับ!"
                  value={settings.logged_in_greeting}
                  onChange={e => handleChange('logged_in_greeting', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Greeting Message</label>
                <input
                  type="text"
                  className="input"
                  placeholder="สวัสดี มีอะไรให้ช่วยไหม?"
                  value={settings.greeting_message}
                  onChange={e => handleChange('greeting_message', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving || !settings.bot_id} className="btn-primary">
              {saving ? 'กำลังบันทึก...' : 'บันทึก Settings'}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                บันทึกแล้ว
              </span>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Embed Code Preview</h2>
            <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
              {embedCode}
            </pre>
            <button
              onClick={() => navigator.clipboard.writeText(embedCode)}
              className="btn-secondary mt-3 text-sm w-full"
            >
              Copy Code
            </button>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">สรุปการตั้งค่า</h2>
            <dl className="space-y-2">
              {[
                { label: 'Bot ID', value: settings.bot_id || '-' },
                { label: 'Theme Color', value: settings.theme_color || '-' },
                { label: 'Locale', value: settings.locale },
                { label: 'Default Open', value: settings.default_open ? 'Yes' : 'No' }
              ].map(item => (
                <div key={item.label} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <dt className="text-sm text-gray-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
