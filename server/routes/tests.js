import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { runCategoryTest } from '../automation/runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../data')
const RESULTS_FILE = join(DATA_DIR, 'results.json')
const CATS_FILE = join(DATA_DIR, 'categories.json')
const SETTINGS_FILE = join(DATA_DIR, 'settings.json')

function readJSON(file, fallback) {
  if (!existsSync(file)) return fallback
  try { return JSON.parse(readFileSync(file, 'utf-8')) } catch { return fallback }
}

function writeResults(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2))
}

export const testsRouter = Router()

testsRouter.get('/results', (req, res) => {
  res.json(readJSON(RESULTS_FILE, []))
})

testsRouter.get('/results/:categoryId', (req, res) => {
  const all = readJSON(RESULTS_FILE, [])
  res.json(all.filter(r => r.category_id === req.params.categoryId))
})

testsRouter.delete('/results/:categoryId', (req, res) => {
  const all = readJSON(RESULTS_FILE, [])
  writeResults(all.filter(r => r.category_id !== req.params.categoryId))
  res.json({ ok: true })
})

export function testEventsHandler(req, res) {
  const { categoryId } = req.query
  if (!categoryId) return res.status(400).json({ error: 'categoryId required' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (type, message) => {
    res.write(`data: ${JSON.stringify({ type, message })}\n\n`)
  }

  const cats = readJSON(CATS_FILE, [])
  const cat = cats.find(c => c.id === categoryId)
  const settings = readJSON(SETTINGS_FILE, {})

  if (!cat) {
    send('error', 'Category not found')
    return res.end()
  }

  if (!settings.bot_id) {
    send('error', 'Bot ID is not configured. Please set it in Widget Settings first.')
    return res.end()
  }

  const resultId = uuidv4()
  const result = {
    id: resultId,
    category_id: cat.id,
    category_name: cat.name,
    started_at: new Date().toISOString(),
    completed_at: null,
    status: 'running',
    scenarios: []
  }

  const all = readJSON(RESULTS_FILE, [])
  all.push(result)
  writeResults(all)

  runCategoryTest(cat, settings, (logMsg) => send('log', logMsg))
    .then(scenarioResults => {
      const allPass = scenarioResults.every(s => s.status === 'pass')
      result.status = allPass ? 'pass' : 'fail'
      result.completed_at = new Date().toISOString()
      result.scenarios = scenarioResults

      const updated = readJSON(RESULTS_FILE, [])
      const idx = updated.findIndex(r => r.id === resultId)
      if (idx !== -1) updated[idx] = result
      writeResults(updated)

      send('complete', 'Done')
      res.end()
    })
    .catch(err => {
      result.status = 'fail'
      result.completed_at = new Date().toISOString()
      const updated = readJSON(RESULTS_FILE, [])
      const idx = updated.findIndex(r => r.id === resultId)
      if (idx !== -1) updated[idx] = result
      writeResults(updated)

      send('error', err.message)
      res.end()
    })
}
