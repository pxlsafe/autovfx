// Create tables and grant credits
const { Pool } = require('pg');

async function setup() {
    const pool = new Pool({
        connectionString: 'postgresql://neondb_owner:npg_RIr4xzu8qfdA@ep-steep-bird-adcve1bq-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
    });
    
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0,
                plan_id TEXT,
                plan_name TEXT,
                cycle_end TIMESTAMPTZ,
                shopify_customer_id TEXT
            );
        `);
        console.log('✅ Created users table');
        
        // Grant 3000 credits to your account
        await pool.query(`
            INSERT INTO users (email, balance, plan_id, plan_name, cycle_end)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
                balance = $2,
                plan_id = $3,
                plan_name = $3,
                cycle_end = $5;
        `, ['davudcb@gmail.com', 3000, '690384601430', '690384601430', new Date(Date.now() + 30*24*60*60*1000)]);
        
        console.log('✅ Granted 3000 credits to davudcb@gmail.com');
        
        // Verify
        const result = await pool.query('SELECT email, balance, plan_id FROM users WHERE email = $1', ['davudcb@gmail.com']);
        console.log('�� User record:', result.rows[0]);
        
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
}

setup();
