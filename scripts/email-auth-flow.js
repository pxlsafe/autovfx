// Email Authentication Flow for AutoVFX
// This shows how the email verification works

// 1. Customer enters email in extension
app.post('/v1/auth', async (req, res) => {
	const { email } = req.body

	try {
		// Find user by email
		const user = await db.query('SELECT * FROM users WHERE email = $1', [
			email,
		])

		if (!user.rows.length) {
			return res.status(404).json({
				error: 'Email not found. Please purchase a subscription first.',
				needsSubscription: true,
			})
		}

		// Check if user has active subscription
		const subscription = await db.query(
			`
            SELECT * FROM subscriptions 
            WHERE user_id = $1 AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        `,
			[user.rows[0].id],
		)

		if (!subscription.rows.length) {
			return res.status(403).json({
				error: 'No active subscription found.',
				needsSubscription: true,
			})
		}

		// Get current credit balance
		const balance = await db.query(
			'SELECT balance FROM credit_balance WHERE user_id = $1',
			[user.rows[0].id],
		)

		// Generate JWT token
		const token = jwt.sign(
			{ userId: user.rows[0].id, email: email },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' },
		)

		res.json({
			success: true,
			token: token,
			user: {
				id: user.rows[0].id,
				email: email,
			},
			subscription: subscription.rows[0],
			balance: balance.rows[0]?.balance || 0,
		})
	} catch (error) {
		console.error('Auth error:', error)
		res.status(500).json({ error: 'Authentication failed' })
	}
})

// 2. When Shopify webhook receives order, create/update user
async function handleOrderPaid(order) {
	const customerEmail = order.customer.email
	const customerId = order.customer.id.toString()

	// Upsert user (create if doesn't exist)
	await db.query(
		`
        INSERT INTO users (email, shopify_customer_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (email) 
        DO UPDATE SET shopify_customer_id = $2
    `,
		[customerEmail, customerId],
	)

	// Check if this is a subscription order
	const subscriptionItem = order.line_items.find(
		(item) => item.sku && item.sku.includes('AUTOVFX'),
	)

	if (subscriptionItem) {
		console.log(`✅ New subscription for: ${customerEmail}`)

		// Create subscription record
		const user = await db.query('SELECT id FROM users WHERE email = $1', [
			customerEmail,
		])

		await db.query(
			`
            INSERT INTO subscriptions (
                user_id, 
                shopify_customer_id, 
                sku,
                status,
                current_period_start,
                current_period_end,
                created_at
            ) VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '30 days', NOW())
        `,
			[user.rows[0].id, customerId, subscriptionItem.sku],
		)

		// Grant initial credits based on tier
		const credits = getCreditsForSku(subscriptionItem.sku)
		await grantCredits(user.rows[0].id, credits, 'SUBSCRIPTION_START')
	}
}

function getCreditsForSku(sku) {
	const skuCredits = {
		'AUTOVFX-CREATOR': 1000,
		'AUTOVFX-STUDIO': 2500,
		'AUTOVFX-PRO': 8000,
	}
	return skuCredits[sku] || 1000
}

async function grantCredits(userId, credits, eventType) {
	await db.query('BEGIN')
	try {
		// Add to ledger
		await db.query(
			`
            INSERT INTO credit_ledger (user_id, delta, event_type, created_at)
            VALUES ($1, $2, $3, NOW())
        `,
			[userId, credits, eventType],
		)

		// Update balance
		await db.query(
			`
            INSERT INTO credit_balance (user_id, balance, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET balance = credit_balance.balance + $2, updated_at = NOW()
        `,
			[userId, credits],
		)

		await db.query('COMMIT')
		console.log(`💰 Granted ${credits} credits to user ${userId}`)
	} catch (error) {
		await db.query('ROLLBACK')
		throw error
	}
}
