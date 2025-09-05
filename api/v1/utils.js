export function verifyEnvVariables() {
	const variables = [
		'DATABASE_URL',
		'DATABASE_URL',
		'SHOPIFY_WEBHOOK_SECRET',
		'SHOPIFY_WEBHOOK_SECRET',
		'SELLING_PLAN_TIER1',
		'SELLING_PLAN_TIER2',
		'SELLING_PLAN_TIER3',
		'JWT_SECRET',
		'JWT_SECRET',
		'OPENAI_API_KEY',
		'OPENAI_BASE_URL',
		'OPENAI_MODEL',
		'CREDITS_PER_SECOND',
		'APSTLE_API_BASE',
		'APSTLE_API_KEY',
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
