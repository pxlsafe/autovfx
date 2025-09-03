const { Pool } = require('pg')

async function refreshUser() {
	const pool = new Pool({
		connectionString:
			'postgresql://neondb_owner:npg_RIr4xzu8qfdA@ep-steep-bird-adcve1bq-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
	})

	try {
		// Check current balance
		const result = await pool.query(
			'SELECT email, balance FROM users WHERE email = $1',
			['nepvl@icloud.com'],
		)
		console.log('📊 Current DB record:', result.rows[0])

		// Ensure they have 3000 credits
		await pool.query(
			`
            UPDATE users SET balance = 3000 WHERE email = $1;
        `,
			['nepvl@icloud.com'],
		)

		console.log('✅ Refreshed nepvl@icloud.com to 3000 credits')
	} catch (e) {
		console.error('❌ Error:', e.message)
	} finally {
		await pool.end()
	}
}

refreshUser()
