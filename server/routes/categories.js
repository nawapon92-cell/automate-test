import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../data')
const FILE = join(DATA_DIR, 'categories.json')

function readCats() {
  if (!existsSync(FILE)) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, '[]')
    return []
  }
  return JSON.parse(readFileSync(FILE, 'utf-8'))
}

function writeCats(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(data, null, 2))
}

const router = Router()

router.get('/', (req, res) => {
  res.json(readCats())
})

router.get('/:id', (req, res) => {
  const cats = readCats()
  const cat = cats.find(c => c.id === req.params.id)
  if (!cat) return res.status(404).json({ error: 'Not found' })
  res.json(cat)
})

router.post('/', (req, res) => {
  const cats = readCats()
  const newCat = {
    id: uuidv4(),
    name: req.body.name,
    repeat_count: req.body.repeat_count || 1,
    created_at: new Date().toISOString(),
    scenarios: []
  }
  cats.push(newCat)
  writeCats(cats)
  res.json(newCat)
})

router.put('/:id', (req, res) => {
  const cats = readCats()
  const idx = cats.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  cats[idx] = { ...cats[idx], ...req.body, id: cats[idx].id }
  writeCats(cats)
  res.json(cats[idx])
})

router.delete('/:id', (req, res) => {
  const cats = readCats().filter(c => c.id !== req.params.id)
  writeCats(cats)
  res.json({ ok: true })
})

// Scenarios CRUD
router.post('/:catId/scenarios', (req, res) => {
  const cats = readCats()
  const cat = cats.find(c => c.id === req.params.catId)
  if (!cat) return res.status(404).json({ error: 'Category not found' })
  const newScen = {
    id: uuidv4(),
    name: req.body.name,
    steps: (req.body.steps || []).map(s => ({ id: uuidv4(), ...s }))
  }
  cat.scenarios.push(newScen)
  writeCats(cats)
  res.json(newScen)
})

router.put('/:catId/scenarios/:scenId', (req, res) => {
  const cats = readCats()
  const cat = cats.find(c => c.id === req.params.catId)
  if (!cat) return res.status(404).json({ error: 'Category not found' })
  const idx = cat.scenarios.findIndex(s => s.id === req.params.scenId)
  if (idx === -1) return res.status(404).json({ error: 'Scenario not found' })
  cat.scenarios[idx] = {
    ...cat.scenarios[idx],
    name: req.body.name,
    steps: (req.body.steps || []).map(s => ({ id: s.id || uuidv4(), ...s }))
  }
  writeCats(cats)
  res.json(cat.scenarios[idx])
})

router.delete('/:catId/scenarios/:scenId', (req, res) => {
  const cats = readCats()
  const cat = cats.find(c => c.id === req.params.catId)
  if (!cat) return res.status(404).json({ error: 'Category not found' })
  cat.scenarios = cat.scenarios.filter(s => s.id !== req.params.scenId)
  writeCats(cats)
  res.json({ ok: true })
})

export default router
