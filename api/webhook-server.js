// @ts-check

require('dotenv').config()
const express = require('express')
const crypto = require('crypto')
const app = express()
const { Pool } = require('pg')
const { attachDatabasePool } = require('@vercel/functions')

verifyEnvVariables()

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	connectionTimeoutMillis: 5000,
})

attachDatabasePool(pool)

// Middleware to capture raw body for webhook verification
app.use('/v1/webhooks/shopify', express.raw({ type: 'application/json' }))
app.use(express.json())

// Basic rate limiting (per IP)
const rateMap = new Map()
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
const MAX_REQ = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100)
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
		return res.status(429).json({ error: 'Too many requests' })
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
		return res.sendStatus(200)
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

app.post('/v1/webhooks/shopify', async (req, res) => {
	// TODO: Insert customer from Appstle webhook
	const topic = req.headers['x-shopify-topic']
	const signature = req.headers['x-shopify-hmac-sha256']
	const webhookId = req.headers['x-shopify-webhook-id']
	const shop = req.headers['x-shopify-shop-domain']

	console.log('\n🔔 WEBHOOK RECEIVED:')
	console.log(`📋 Topic: ${topic}`)
	console.log(`🏪 Shop: ${shop}`)
	console.log(`🔐 Signature: ${signature ? 'Present' : 'Missing'}`)
	console.log(`📦 Body size: ${req.body.length} bytes`)

	// Verify HMAC if secret provided
	try {
		if (process.env.SHOPIFY_WEBHOOK_SECRET) {
			const hmac = crypto
				.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
				.update(req.body, 'utf8')
				.digest('base64')
			if (hmac !== signature) {
				console.log('❌ HMAC verification failed')
				return res.status(401).send('Invalid signature')
			}
		} else {
			console.log(
				'ℹ️ No SHOPIFY_WEBHOOK_SECRET set; skipping HMAC check (dev mode).',
			)
		}
	} catch (e) {
		console.log('❌ HMAC verification error:', e.message)
		return res.status(400).send('Bad request')
	}

	try {
		const order = JSON.parse(req.body)
		console.log(`\n📄 Order Details:`)
		console.log(`- Order ID: ${order.id}`)
		console.log(`- Customer: ${order.customer?.email || 'No customer'}`)
		console.log(`- Total: ${order.total_price} ${order.currency}`)
		console.log(`- Items: ${order.line_items?.length || 0}`)

		// Check for subscription items
		const subscriptionItems =
			order.line_items?.filter(
				(item) => item.selling_plan_allocation !== null,
			) || []

		// Check for top-up items
		const topupItems =
			order.line_items?.filter(
				(item) =>
					item.sku &&
					(item.sku.includes('TOPUP') || item.sku.includes('CREDIT')),
			) || []

		// Check for AutoVFX subscription items (temporary detection)
		const autovfxItems =
			order.line_items?.filter(
				(item) => item.sku && item.sku.includes('AUTOVFX'),
			) || []

		if (subscriptionItems.length > 0) {
			console.log(`\n🔄 SUBSCRIPTION ITEMS FOUND:`)
			subscriptionItems.forEach((item) => {
				console.log(`- ${item.title}`)
				console.log(
					`  Selling Plan ID: ${item.selling_plan_allocation?.selling_plan?.id}`,
				)
				console.log(`  Price: ${item.price}`)
			})

			// Minimal credit grant by selling plan
			const email = order.customer?.email
			const customerId = String(order.customer?.id)
			const planId = String(
				subscriptionItems[0]?.selling_plan_allocation?.selling_plan
					?.id || '',
			)
			// Runway pricing: 15 credits per second
			// $10 = 40 videos x 5sec = 200sec = 3000 credits
			// $25 = 100 videos x 5sec = 500sec = 7500 credits
			// $80 = 320 videos x 5sec = 1600sec = 24000 credits
			const planCredits = {
				[process.env.SELLING_PLAN_TIER1 || '690384601430']: 3000, // $49 plan → $10 runway cost
				[process.env.SELLING_PLAN_TIER2 || '690385518934']: 7500, // $79 plan → $25 runway cost
				[process.env.SELLING_PLAN_TIER3 || '690385551702']: 24000, // $199 plan → $80 runway cost
			}
			const credits = planCredits[planId] || 1000
			if (email) {
				const prev = getUser(email)
				const cycleEnd = new Date(
					Date.now() + 30 * 24 * 60 * 60 * 1000,
				).toISOString()
				// await updateUser(email)
				// console.log(
				// 	`💰 Granted ${credits} credits to ${email} (plan ${planId}). New balance: ${
				// 		usersByEmail.get(email).balance
				// 	}`,
				// )
			}
		}

		if (topupItems.length > 0) {
			console.log(`\n💰 TOP-UP ITEMS FOUND:`)
			topupItems.forEach((item) => {
				console.log(`- ${item.title}`)
				console.log(`  SKU: ${item.sku}`)
				console.log(`  Price: ${item.price}`)
			})
		}

		if (autovfxItems.length > 0) {
			console.log(`\n🎯 AUTOVFX SUBSCRIPTION ITEMS:`)
			autovfxItems.forEach((item) => {
				console.log(`- ${item.title}`)
				console.log(`  SKU: ${item.sku}`)
				console.log(`  Price: ${item.price}`)
			})

			// TODO: In production, this would create user and grant credits
			console.log(`\n📧 WOULD CREATE USER:`)
			console.log(`- Email: ${order.customer?.email}`)
			console.log(`- Shopify ID: ${order.customer?.id}`)
			console.log(`- Credits: ${getCreditsForSku(autovfxItems[0].sku)}`)
		}

		if (
			subscriptionItems.length === 0 &&
			topupItems.length === 0 &&
			autovfxItems.length === 0
		) {
			console.log(`\n ℹ️  No subscription or top-up items found`)
		}
	} catch (error) {
		console.error('❌ Error parsing webhook body:', error.message)
	}

	res.status(200).json({
		received: true,
		topic: topic,
		timestamp: new Date().toISOString(),
	})
})

app.get('/health', (req, res) => {
	res.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

function getCreditsForSku(sku) {
	const skuCredits = {
		'AUTOVFX-CREATOR': 1000,
		'AUTOVFX-STUDIO': 2500,
		'AUTOVFX-PRO': 8000,
	}
	return skuCredits[sku] || 1000
}

// --- Minimal auth + credit endpoints for the panel ---
app.use(express.json())

// Minimal JWT (HS256)
function base64url(input) {
	return Buffer.from(input)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
}

function signToken(payload, expiresInSec = 7 * 24 * 3600) {
	const header = { alg: 'HS256', typ: 'JWT' }
	const exp = Math.floor(Date.now() / 1000) + expiresInSec
	const body = { ...payload, exp }
	const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
		JSON.stringify(body),
	)}`
	const sig = crypto
		.createHmac('sha256', process.env.JWT_SECRET || 'dev-secret')
		.update(unsigned)
		.digest('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
	return `${unsigned}.${sig}`
}

function verifyToken(token) {
	const parts = token.split('.')
	if (parts.length !== 3) {
		return null
	}
	const [h, p, s] = parts
	const expected = crypto
		.createHmac('sha256', process.env.JWT_SECRET || 'dev-secret')
		.update(`${h}.${p}`)
		.digest('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
	if (s !== expected) {
		return null
	}
	try {
		const payload = JSON.parse(
			Buffer.from(
				p.replace(/-/g, '+').replace(/_/g, '/'),
				'base64',
			).toString('utf8'),
		)
		if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
			return null
		}
		return payload
	} catch (_) {
		return null
	}
}

app.post('/v1/auth', async (req, res) => {
	const email = String(req.body?.email || '')
		.trim()
		.toLowerCase()
	if (!email) {
		return res
			.status(400)
			.json({ error: 'Email required', message: 'Email required' })
	}

	const user = getUser(email)
	if (!user) {
		return res.status(400).json({
			error: 'User does not exist',
			message: 'User does not exist',
		})
	}
	const expires =
		Number((process.env.JWT_EXPIRES_IN || '').replace('d', '')) || 7
	const token = signToken({ email }, expires * 24 * 3600)
	// TODO: Check how these keys are used
	return res.json({
		token,
		user: { email },
		subscription: {
			status: user.planId === 'none' ? 'none' : 'active',
			selling_plan_id: user.planId,
		},
		balance: user.balance,
		cycle: { end: user.cycleEnd },
		needsSubscription: user.planId === 'none',
	})
})

function requireAuth(req, res, next) {
	const auth = req.headers.authorization || ''
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
	const payload = verifyToken(token)
	if (!payload?.email) {
		return res.status(401).json({ error: 'Unauthorized' })
	}
	req.email = String(payload.email).toLowerCase()
	next()
}

app.get('/v1/me', requireAuth, async (req, res) => {
	const user = getUser(req.email)
	if (!user) {
		return res.status(400).json({
			error: 'User does not exist',
			message: 'User does not exist',
		})
	}
	// TODO: Check how these keys are used
	res.json({
		user: { email: req.email },
		balance: user.balance,
		subscription: {
			status: user.planId && user.planId !== 'none' ? 'active' : 'none',
			selling_plan_id: user.planId,
		},
		cycle: { end: user.cycleEnd },
	})
})

app.get('/v1/credits', requireAuth, async (req, res) => {
	const user = getUser(req.email)
	if (!user) {
		return res.status(400).json({
			error: 'User does not exist',
			message: 'User does not exist',
		})
	}
	// TODO: Check how these keys are used
	res.json({ balance: user.balance, cycle: { end: user.cycleEnd } })
})

app.post('/v1/enhance', async (req, res) => {
	try {
		const prompt = String(req.body?.prompt || '').trim()
		if (!prompt) {
			return res.status(400).json({ error: 'Prompt required' })
		}
		const response = await fetch(
			`${process.env.OPENAI_BASE_URL}/chat/completions`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: process.env.OPENAI_MODEL,
					messages: [
						{
							role: 'system',
							content: [
								"You are a professional video editing prompt enhancer specializing in Runway ML's Gen-4 Aleph model. Enhance user prompts following these rules:",
								'1) Start with an action verb (add, remove, change, replace, re-light, re-style)',
								'2) Be specific about the transformation',
								'3) ALWAYS include explicit preservation instructions for existing scene elements',
								'4) Keep prompts concise (20-35 words)',
								'MANDATORY: Explicitly state that all other elements remain unchanged/preserved.',
							].join('\n'),
						},
						{
							role: 'user',
							content: `Enhance this prompt for Runway ML video generation: "${prompt}"`,
						},
					],
					max_completion_tokens: 300,
				}),
			},
		)

		if (!response.ok) {
			const err = await response.json().catch(() => ({}))
			return res.status(500).json({
				error: `OpenAI error: ${response.status}`,
				detail: err.error?.message || null,
			})
		}
		const data = await response.json()
		const enhanced = (data.choices?.[0]?.message?.content || '')
			.trim()
			.replace(/^(["'])(.*)\1$/, '$2')
		if (!enhanced) {
			return res.status(500).json({ error: 'Empty response from OpenAI' })
		}
		return res.json({ success: true, original: prompt, enhanced })
	} catch (e) {
		console.error('Enhance error:', e)
		return res
			.status(500)
			.json({ error: 'Enhance failed', detail: String(e) })
	}
})

app.post('/v1/jobs', requireAuth, async (req, res) => {
	const requestedSeconds = Math.max(
		0,
		Number(req.body?.requestedSeconds || 0),
	)
	const creditsPerSecond = Number(process.env.CREDITS_PER_SECOND)
	// TODO: Check how fractional second credits are calculated by Runway
	// Bill to nearest whole second (minimum 1s) to match UX expectation (e.g., 3.10s -> 3s)
	const billableSeconds = Math.max(1, Math.round(requestedSeconds))
	const needed = billableSeconds * creditsPerSecond
	const user = getUser(req.email)
	const balance = user.balance
	if (balance < needed) {
		return res
			.status(402)
			.json({ error: 'Insufficient credits', needed, balance })
	}
	await updateBalance(req.email, balance - needed)
	console.log(
		`🧮 Credit reservation: requestedSeconds=${requestedSeconds}s, billableSeconds=${billableSeconds}s, creditsPerSecond=${creditsPerSecond}, needed=${needed}`,
	)
	res.json({ taskId: `task_${Date.now()}`, reservedCredits: needed })
})

app.post('/v1/portal-link', requireAuth, async (req, res) => {
	// TODO: Rewrite this to work with Appstle webhooks
	try {
		const user = getUser(req.email)
		if (!user || !user.shopifyCustomerId) {
			return res.status(400).json({
				// TODO: Is this message used in the extension?
				error: 'Missing customer ID. Make a first purchase to link your account.',
			})
		}
		// TODO: Verify this url is the same in the env 'https://subscription-admin.appstle.com/api/external/v2'
		// TODO: Shopify customer id is currently not set
		const resp = await fetch(
			`${process.env.APSTLE_API_BASE}/manage-subscription-link/${user.shopifyCustomerId}`,
			{
				headers: { 'X-Apstle-Api-Key': process.env.APSTLE_API_KEY },
			},
		)
		if (!resp.ok) {
			const txt = await resp.text().catch(() => '')
			return res
				.status(500)
				.json({ error: 'Failed to fetch portal link', detail: txt })
		}
		const data = await resp.json().catch(() => ({}))
		return res.json({
			url: data.url || data.manage_url || data.link || null,
		})
	} catch (e) {
		return res
			.status(500)
			.json({ error: 'Portal link error', detail: String(e) })
	}
})

app.post('/v1/checkout/topup', requireAuth, (req, res) => {
	const pack = String(req.body?.pack || 'credits_1000')
	const urls = {
		credits_1000:
			'https://6134fe-1d.myshopify.com/cart/add?sku=AUTOVFX-TOPUP-1000',
		credits_2000:
			'https://6134fe-1d.myshopify.com/cart/add?sku=AUTOVFX-TOPUP-2000',
	}
	const url = urls[pack] || urls.credits_1000
	res.json({ url })
})

if (process.env.RUN_LOCAL === 'true') {
	const PORT = process.env.PORT || 3000
	app.listen(PORT, () => {
		console.log(`\n🚀 AutoVFX Webhook Server started!`)
		console.log(`📍 Local: http://localhost:${PORT}`)
		console.log(`\n⏳ Waiting for webhooks...\n`)
	})
}

async function getUser(email) {
	const db = await pool.connect()
	const result = await db.query('SELECT * FROM users WHERE email = $1', [
		email,
	])
	return result.rows[0]
}

async function updateBalance(email, balance) {
	const db = await pool.connect()
	await db.query(`UPDATE users SET balance = $1 WHERE email = $2`, [
		balance,
		email,
	])
}

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('\n👋 Shutting down webhook server...')
	process.exit(0)
})

function verifyEnvVariables() {
	const variables = [
		'DATABASE_URL',
		'RATE_LIMIT_WINDOW_MS',
		'RATE_LIMIT_MAX_REQUESTS',
		'SHOPIFY_WEBHOOK_SECRET',
		'SELLING_PLAN_TIER1',
		'SELLING_PLAN_TIER2',
		'SELLING_PLAN_TIER3',
		'JWT_SECRET',
		'JWT_EXPIRES_IN',
		'OPENAI_API_KEY',
		'OPENAI_BASE_URL',
		'OPENAI_MODEL',
		'CREDITS_PER_SECOND',
		'APSTLE_API_BASE',
		'APSTLE_API_KEY',
	]
	const missing = variables.filter((variable) => process.env[variable])
	if (missing.length) {
		throw new Error(`Missing env variables ${missing.join(', ')}`)
	}
}

// --- DEV UTILS: simulate Shopify orders/paid to grant credits ---
// Enabled only when NODE_ENV !== 'production'
// POST /v1/dev/mock-orders-paid { email, sellingPlanId?, sku? }
// if (process.env.NODE_ENV !== 'production')
// 	app.post('/v1/dev/mock-orders-paid', async (req, res) => {
// 		const email = String(req.body?.email || '')
// 			.trim()
// 			.toLowerCase()
// 		const sellingPlanId = req.body?.sellingPlanId
// 			? String(req.body.sellingPlanId)
// 			: null
// 		const sku = req.body?.sku ? String(req.body.sku) : null
// 		if (!email) {
// 			return res.status(400).json({ error: 'Email required' })
// 		}

// 		let credits = 0
// 		if (sellingPlanId) {
// 			const planCredits = {
// 				[process.env.SELLING_PLAN_TIER1 || '690384601430']: 3000,
// 				[process.env.SELLING_PLAN_TIER2 || '690385518934']: 7500,
// 				[process.env.SELLING_PLAN_TIER3 || '690385551702']: 24000,
// 			}
// 			credits = planCredits[sellingPlanId] || 1000
// 		} else if (sku) {
// 			credits = getCreditsForSku(sku)
// 		} else {
// 			return res.status(400).json({ error: 'Provide sellingPlanId or sku' })
// 		}

// 		const prev = usersByEmail.get(email) || {
// 			balance: 0,
// 			planId: 'none',
// 			planName: 'none',
// 			cycleEnd: null,
// 			shopifyCustomerId: null,
// 		}
// 		const cycleEnd = new Date(
// 			Date.now() + 30 * 24 * 60 * 60 * 1000,
// 		).toISOString()
// 		const planId = sellingPlanId || prev.planId || 'none'
// 		usersByEmail.set(email, {
// 			balance: (prev.balance || 0) + credits,
// 			planId,
// 			planName: planId,
// 			cycleEnd,
// 			shopifyCustomerId: prev.shopifyCustomerId,
// 		})
// 		await updateUser(email)
// 		return res.json({
// 			email,
// 			granted: credits,
// 			balance: usersByEmail.get(email).balance,
// 			cycleEnd,
// 		})
// 	})

// Export app for serverless platforms (Vercel) and start locally only if RUN_LOCAL=true
module.exports = app
