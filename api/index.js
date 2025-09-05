import express from 'express'
import v1 from './v1/index.js'
import v2 from './v2/index.js'

const app = express()

// Middleware to capture raw body for webhook verification
app.use('/v1/webhooks/shopify', express.raw({ type: 'application/json' }))
// TODO: Lower limit to the allowed size by Runway
app.use(express.json({ limit: '50mb' }))

// Basic rate limiting (per IP)
const rateMap = new Map()
const WINDOW_MS = Number(15 * 60 * 1000)
const MAX_REQ = Number(100)
app.use((req, res, next) => {
	const now = Date.now()
	const ip =
		req.headers['x-forwarded-for']?.split(',')[0].trim() ||
		req.socket.remoteAddress ||
		'local'
	let entry = rateMap.get(ip) || { count: 0, reset: now + WINDOW_MS }
	if (now > entry.reset) {
		entry = { count: 0, reset: now + WINDOW_MS }
	}
	entry.count += 1
	rateMap.set(ip, entry)
	if (entry.count > MAX_REQ) {
		return res
			.status(Status.TOO_MANY_REQUESTS)
			.json({ error: 'Too many requests' })
	}
	next()
})

// CORS: allow all origins for CEP compatibility (panels use file:// or no origin)
app.use((req, res, next) => {
	const origin = req.headers.origin
	res.header('Access-Control-Allow-Origin', origin || '*')
	res.header(
		'Access-Control-Allow-Headers',
		'Authorization, Content-Type, ngrok-skip-browser-warning',
	)
	res.header(
		'Access-Control-Allow-Methods',
		'GET, POST, PUT, DELETE, OPTIONS',
	)
	res.header('Access-Control-Allow-Credentials', 'true')
	if (req.method === 'OPTIONS') {
		return res.sendStatus(Status.OK)
	}
	next()
})

// Test endpoint
app.get('/', (req, res) => {
	res.json({
		message: 'AutoVFX Webhook Server Running',
		timestamp: new Date().toISOString(),
	})
})

app.get('/health', (req, res) => {
	res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

app.use('/v1', v1)
app.use('/v2', v2)

if (process.env.RUN_LOCAL === 'true') {
	const PORT = 3000
	app.listen(PORT, () => {
		console.log(`\nServer started on http://localhost:${PORT}`)
		console.log(`Waiting for webhooks...\n`)
	})
}

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('\n👋 Shutting down webhook server...')
	process.exit(0)
})

export default app
