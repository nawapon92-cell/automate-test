import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../data')
const FILE = join(DATA_DIR, 'settings.json')

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

function readSettings() {
  if (!existsSync(FILE)) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(defaultSettings, null, 2))
    return defaultSettings
  }
  return JSON.parse(readFileSync(FILE, 'utf-8'))
}

function writeSettings(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(data, null, 2))
}

const router = Router()

router.get('/', (req, res) => {
  res.json(readSettings())
})

router.put('/', (req, res) => {
  const current = readSettings()
  const updated = { ...current, ...req.body }
  writeSettings(updated)
  res.json(updated)
})

export default router
