// @ts-check

import { config } from 'dotenv'
import express from 'express'
import { Pool } from 'pg'
import { attachDatabasePool } from '@vercel/functions'
import RunwayML, { TaskFailedError } from '@runwayml/sdk'
import {
	calculateCredits,
	getPercentageUsed,
	redact,
	requireAuth,
	signToken,
	verifyEnvVariables,
} from './utils.js'
import Status from 'http-status-codes'

config({ path: '../.env.local' })
verifyEnvVariables()

const router = express.Router()
const runway = new RunwayML()
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	connectionTimeoutMillis: 10000,
})

attachDatabasePool(pool)

router.post('/auth', async (req, res) => {
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
			console.warn(`User ${redact(email)} does not exist`)
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

router.get('/me', requireAuth, async (req, res) => {
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

router.post('/enhance', requireAuth, async (req, res) => {
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

router.post('/portal-link', requireAuth, async (req, res) => {
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

router.post('/upload', requireAuth, async (req, res) => {
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

router.post('/generate', requireAuth, async (req, res) => {
	console.log('Running /generate')
	try {
		const { videoUri, imageUrl, promptText, seconds } = req.body
		if (!videoUri || !promptText || !seconds) {
			return res.status(Status.BAD_REQUEST).json({ error: 'Bad Request' })
		}
		const email = req.email
		const credits = calculateCredits(seconds)
		const { balance } = await getUser(email)
		console.log({ email: redact(email), credits, balance })
		if (balance - credits < 0) {
			console.log(
				`Not enough credits for ${redact(email)}. Required ${credits}, but balance is ${balance}`,
			)
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

router.post('/status', requireAuth, async (req, res) => {
	console.log('Running /status')
	try {
		const { id, seconds } = req.body
		const email = req.email
		console.log({ id, seconds })
		if (!id || !seconds) {
			return res.status(Status.BAD_REQUEST).json({ error: 'Bad Request' })
		}
		const task = await runway.tasks.retrieve(id)
		console.log({ task })
		if (task.status === 'SUCCEEDED') {
			// TODO: `subtractCredits` returns an object
			const credits = await subtractCredits(email, seconds)
			console.log(
				`New balance ${credits} for ${redact(email)} after task ${id}`,
			)
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

export default router
