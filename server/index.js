import express from 'express'
import cors from 'cors'
import settingsRouter from './routes/settings.js'
import categoriesRouter from './routes/categories.js'
import { testsRouter, testEventsHandler } from './routes/tests.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/settings', settingsRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/tests', testsRouter)
app.get('/test-events', testEventsHandler)

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
