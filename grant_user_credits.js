const { Pool } = require('pg');

async function grantCredits() {
    const pool = new Pool({
        connectionString: 'postgresql://neondb_owner:npg_RIr4xzu8qfdA@ep-steep-bird-adcve1bq-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
    });
    
    try {
        // Grant 3000 credits to nepvl@icloud.com
        await pool.query(`
            INSERT INTO users (email, balance, plan_id, plan_name, cycle_end)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
                balance = $2,
                plan_id = $3,
                plan_name = $3,
                cycle_end = $5;
        `, ['nepvl@icloud.com', 3000, '690384601430', '690384601430', new Date(Date.now() + 30*24*60*60*1000)]);
        
        console.log('✅ Granted 3000 credits to nepvl@icloud.com');
        
        // Verify
        const result = await pool.query('SELECT email, balance, plan_id FROM users WHERE email = $1', ['nepvl@icloud.com']);
        console.log('📊 User record:', result.rows[0]);
        
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
}

grantCredits();
