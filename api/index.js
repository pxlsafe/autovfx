// @ts-check

import crypto from 'crypto'
import express from 'express'
import { Pool } from 'pg'
import { config } from 'dotenv'
import { attachDatabasePool } from '@vercel/functions'
import RunwayML, { TaskFailedError } from '@runwayml/sdk'
import {
	calculateCredits,
	getPercentageUsed,
	requireAuth,
	signToken,
	verifyEnvVariables,
} from './utils.js'
import Status from 'http-status-codes'

config({ path: '../.env.local' })
verifyEnvVariables()

const app = express()
const runway = new RunwayML()
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	connectionTimeoutMillis: 5000,
})

attachDatabasePool(pool)

// Middleware to capture raw body for webhook verification
app.use('/v1/webhooks/shopify', express.raw({ type: 'application/json' }))
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

app.post('/v1/webhooks/shopify', async (req, res) => {
	// TODO: Insert customer from Appstle webhook
	const topic = req.headers['x-shopify-topic']
	const signature = req.headers['x-shopify-hmac-sha256']
	const webhookId = req.headers['x-shopify-webhook-id']
	const shop = req.headers['x-shopify-shop-domain']

	console.log('🔔 WEBHOOK RECEIVED:')
	console.log(`📋 Topic: ${topic}`)
	console.log(`🏪 Shop: ${shop}`)
	console.log(`🔐 Signature: ${signature ? 'Present' : 'Missing'}`)
	console.log(`📦 Body size: ${req.body.length} bytes`)

	// TODO: Use shopify library
	// https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/docs/reference/webhooks/validate.md
	// const { valid, topic, domain } = await shopify.webhooks.validate({
	// 	rawBody: req.body, // is a string
	// 	rawRequest: req,
	// 	rawResponse: res,
	// })

	// if (!valid) {
	// 	// This is not a valid request!
	// 	res.send(400) // Bad Request
	// }

	// // Run my webhook-processing code here

	// Verify HMAC if secret provided
	try {
		if (process.env.SHOPIFY_WEBHOOK_SECRET) {
			const hmac = crypto
				.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
				.update(req.body, 'utf8')
				.digest('base64')
			if (hmac !== signature) {
				console.log('❌ HMAC verification failed')
				return res.status(Status.UNAUTHORIZED).send('Invalid signature')
			}
		}
	} catch (e) {
		console.log('❌ HMAC verification error:', e.message)
		return res.status(Status.BAD_REQUEST).send('Bad request')
	}

	res.status(Status.OK).json({
		received: true,
		topic: topic,
		timestamp: new Date().toISOString(),
	})
})

app.post('/v1/auth', async (req, res) => {
	try {
		const email = String(req.body?.email || '')
			.trim()
			.toLowerCase()
		if (!email) {
			return res
				.status(Status.BAD_REQUEST)
				.json({ error: 'Email required', message: 'Email required' })
		}

		const user = await getUser(email)
		if (!user) {
			return res.status(Status.BAD_REQUEST).json({
				error: 'User does not exist',
				message: 'User does not exist',
			})
		}
		const token = signToken({ email }, 7 * 24 * 3600)

		return res.json({
			token,
			user: { email },
			subscription: {
				name: user.plan_name,
				status: user.plan_id !== 'none' ? 'none' : 'active',
				selling_plan_id: user.plan_id,
				used: getPercentageUsed(user.plan_name, user.balance),
			},
			balance: user.balance,
			cycle: { end: user.cycle_end },
			needsSubscription: user._plan_id === 'none',
		})
	} catch (error) {
		console.error(error)
		return res
			.status(Status.INTERNAL_SERVER_ERROR)
			.json({ error: 'Internal Server Error' })
	}
})

app.get('/v1/me', requireAuth, async (req, res) => {
	try {
		const user = await getUser(req.email)
		if (!user) {
			return res.status(Status.BAD_REQUEST).json({
				error: 'User does not exist',
				message: 'User does not exist',
			})
		}
		res.json({
			user: { email: req.email },
			balance: user.balance,
			subscription: {
				name: user.plan_name,
				status: user.plan_id !== 'none' ? 'active' : 'none',
				selling_plan_id: user.plan_id,
				used: getPercentageUsed(user.plan_name, user.balance),
			},
			cycle: { end: user.cycle_end },
		})
	} catch (error) {
		console.error(error)
		return res
			.status(Status.INTERNAL_SERVER_ERROR)
			.json({ error: 'Internal Server Error' })
	}
})

// app.get('/v1/credits', requireAuth, async (req, res) => {
// 	const user = getUser(req.email)
// 	if (!user) {
// 		return res.status(Status.BAD_REQUEST).json({
// 			error: 'User does not exist',
// 			message: 'User does not exist',
// 		})
// 	}

// 	res.json({ balance: user.balance, cycle: { end: user.cycle_end } })
// })

app.post('/v1/enhance', requireAuth, async (req, res) => {
	console.log('Running /enhance')
	try {
		const prompt = req.body.prompt?.trim()
		if (!prompt) {
			return res
				.status(Status.BAD_REQUEST)
				.json({ error: 'Prompt required' })
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
			return res.status(Status.INTERNAL_SERVER_ERROR).json({
				error: `OpenAI error: ${err}`,
			})
		}
		const data = await response.json()
		const enhanced = (data.choices?.[0]?.message?.content || '')
			.trim()
			.replace(/^(["'])(.*)\1$/, '$2')
		if (!enhanced) {
			return res
				.status(Status.INTERNAL_SERVER_ERROR)
				.json({ error: 'Empty response from OpenAI' })
		}
		return res.json({ success: true, original: prompt, enhanced })
	} catch (error) {
		console.error('Enhance error:', error)
		return res
			.status(Status.INTERNAL_SERVER_ERROR)
			.json({ error: `Enhance failed ${error}` })
	}
})

app.post('/v1/portal-link', requireAuth, async (req, res) => {
	// TODO: Rewrite this to work with Appstle webhooks
	try {
		const user = await getUser(req.email)
		if (!user || !user.shopifyCustomerId) {
			return res.status(Status.BAD_REQUEST).json({
				error: 'Missing customer ID. Make a first purchase to link your account.',
			})
		}
		// TODO: Shopify customer id is currently not set in the database
		const resp = await fetch(
			`${process.env.APSTLE_API_BASE}/manage-subscription-link/${user.shopifyCustomerId}`.trim(),
			{
				headers: { 'X-Apstle-Api-Key': process.env.APSTLE_API_KEY },
			},
		)
		if (!resp.ok) {
			const txt = await resp.text().catch(() => '')
			return res
				.status(Status.INTERNAL_SERVER_ERROR)
				.json({ error: 'Failed to fetch portal link' })
		}
		const data = await resp.json().catch(() => ({}))
		return res.json({
			url: data.url || data.manage_url || data.link || null,
		})
	} catch (error) {
		console.error(error)
		return res
			.status(Status.INTERNAL_SERVER_ERROR)
			.json({ error: `Portal link error ${error}` })
	}
})

app.post('/v1/upload', requireAuth, async (req, res) => {
	console.log('Running /upload')
	try {
		// NOTE: Uses undocumented `/assets` route
		// https://github.com/runwayml/sdk-node?tab=readme-ov-file#making-customundocumented-requests
		const response = await runway.post('/assets', { body: req.body })
		if (!response.ok) {
			return res
				.status(Status.INTERNAL_SERVER_ERROR)
				.json({ error: 'Failed to upload video' })
		}
		return res.status(Status.OK)
	} catch (error) {
		console.error(error)
		return res
			.status(Status.INTERNAL_SERVER_ERROR)
			.json({ error: 'Internal Server Error' })
	}
})

app.post('/v1/generate', requireAuth, async (req, res) => {
	console.log('Running /generate')
	try {
		const { videoUri, imageUrl, promptText, seconds } = req.body
		if (!videoUri || !promptText || !seconds) {
			return res.status(Status.BAD_REQUEST).json({ error: 'Bad Request' })
		}
		const credits = calculateCredits(seconds)
		const { balance } = await getUser(req.email)
		console.log({ credits, balance })
		if (balance - credits < 0) {
			return res
				.status(Status.PAYMENT_REQUIRED)
				.json({ error: 'Not enough credits' })
		}
		const options = {
			model: 'gen4_aleph',
			ratio: '1280:720',
			promptText,
			videoUri,
		}
		if (imageUrl) {
			options.references = [imageUrl]
		}
		const task = await runway.videoToVideo.create(options)
		console.log('Started Runway task', task)
		return res.json(task)
	} catch (error) {
		// TODO: Deal with all possible errors
		// https://docs.dev.runwayml.com/errors/errors/
		// TODO: Deal with failure errors in the extension
		// https://docs.dev.runwayml.com/errors/task-failures/
		if (error instanceof TaskFailedError) {
			console.error('The video failed to generate.')
			console.error(error.taskDetails)
		} else {
			console.error(error)
		}
		return res
			.status(Status.INTERNAL_SERVER_ERROR)
			.json({ error: 'Internal Server Error' })
	}
})

app.post('/v1/status', requireAuth, async (req, res) => {
	console.log('Running /status')
	try {
		const { id, seconds } = req.body
		console.log({ id, seconds })
		if (!id || !seconds) {
			return res.status(Status.BAD_REQUEST).json({ error: 'Bad Request' })
		}
		const task = await runway.tasks.retrieve(id)
		console.log({ task })
		if (task.status === 'SUCCEEDED') {
			const credits = await subtractCredits(req.email, seconds)
			console.log({ credits })
			return res.json({ ...task, credits })
		}
		return res.json(task)
	} catch (error) {
		console.error(error)
		return res
			.status(Status.INTERNAL_SERVER_ERROR)
			.json({ error: 'Internal Server Error' })
	}
})

if (process.env.RUN_LOCAL === 'true') {
	const PORT = 3000
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

async function subtractCredits(email, seconds) {
	const db = await pool.connect()
	const credits = calculateCredits(seconds)
	// TODO: Make sure balance cannot go below 0
	const result = await db.query(
		`UPDATE users SET balance = balance - $1 WHERE email = $2 RETURNING balance`,
		[credits, email],
	)
	const balance = result.rows[0]
	if (!balance) {
		throw new Error('Failed to return balance')
	}
	return balance
}

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('\n👋 Shutting down webhook server...')
	process.exit(0)
})

export default app
