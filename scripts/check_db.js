const { Pool } = require('pg')

async function checkDB() {
	const pool = new Pool({
		connectionString:
			'postgresql://neondb_owner:npg_RIr4xzu8qfdA@ep-steep-bird-adcve1bq-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
	})

	try {
		const result = await pool.query(
			'SELECT email, balance, plan_id FROM users WHERE email = $1',
			['davudcb@gmail.com'],
		)
		console.log('📊 Database record:', result.rows[0])

		if (result.rows.length === 0) {
			console.log('❌ No user found in database')
		}
	} catch (e) {
		console.error('❌ Error:', e.message)
	} finally {
		await pool.end()
	}
}

checkDB()
