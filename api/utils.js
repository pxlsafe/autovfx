// @ts-check
import crypto from 'crypto'

export function requireAuth(req, res, next) {
	const auth = req.headers.authorization || ''
	const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
	const payload = verifyToken(token)
	if (!payload?.email) {
		return res.status(401).json({ error: 'Unauthorized' })
	}
	req.email = String(payload.email).toLowerCase()
	next()
}

export function signToken(payload, expiresInSec = 7 * 24 * 3600) {
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

// Minimal JWT (HS256)
function base64url(input) {
	return Buffer.from(input)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
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

export function verifyEnvVariables() {
	const variables = [
		'DATABASE_URL',
		'SHOPIFY_WEBHOOK_SECRET',
		'SELLING_PLAN_TIER1',
		'SELLING_PLAN_TIER2',
		'SELLING_PLAN_TIER3',
		'JWT_SECRET',
		'OPENAI_API_KEY',
		'OPENAI_BASE_URL',
		'OPENAI_MODEL',
		'CREDITS_PER_SECOND',
		'APSTLE_API_BASE',
		'APSTLE_API_KEY',
		'RUNWAYML_API_SECRET',
	]
	const missing = variables.filter((name) => {
		const exists = process.env[name]
		if (!exists) {
			console.warn(`Missing env variable ${name}`)
		}
		return !exists
	})
	if (missing.length) {
		throw new Error('Missing env variables')
	}
}

export function calculateCredits(seconds) {
	const creditsPerSecond = Number(process.env.CREDITS_PER_SECOND)
	if (Number.isNaN(creditsPerSecond)) {
		throw new Error('Invalid CREDITS_PER_SECOND')
	}
	// Note: Round seconds up to the highest second
	return Math.ceil(seconds) * creditsPerSecond
}

export function getPercentageUsed(tierName, balance) {
	const tiers = new Map([
		['Starter', 3000],
		['Pro', 7500],
		['Exclusive', 15000],
	])
	const credits = tiers.get(tierName)
	if (!credits) {
		console.error(`Unknown tier ${tierName}`)
		return 0
	}
	return 100 - (balance / credits) * 100
}

export function redact(email) {
	try {
		const [name, domain] = email.split('@')
		const [base, extension] = domain.split('.')
		const truncatedName = `${name.slice(0, 3)}...`
		const truncatedDomain = `${base.slice(0, 3)}...${extension}`
		return [truncatedName, truncatedDomain].join('@')
	} catch {
		return '[unknown]'
	}
}
