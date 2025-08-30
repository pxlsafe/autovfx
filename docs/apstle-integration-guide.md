# Apstle Subscriptions Integration Guide for AutoVFX

This guide details how to integrate AutoVFX with Apstle Subscriptions (Shopify app) to replace the previous LemonSqueezy integration.

## Overview

Apstle Subscriptions provides a comprehensive subscription management system for Shopify stores. This integration replaces LemonSqueezy with:

- **Apstle API** for subscription management
- **Shopify webhooks** for billing events and credit resets
- **Shopify checkout** for subscription and top-up purchases

## Apstle API Endpoints

Base URL: `https://<apstle-host>/api/external/v2`

### Authentication
All API calls require the `X-Apstle-Api-Key` header with your API key.

### Subscription Management

#### Get Subscription Contract Details
```http
GET /subscription-contract-details/{contractId}
```
Returns full contract information including billing cycle, line items, and status.

#### Create Subscription Contract
```http
POST /subscription-contract-details/create-subscription-contract
```
Creates a new subscription contract programmatically.

#### Update Subscription Status
```http
PUT /subscription-contracts-update-status
```
Update subscription status (active, paused, cancelled).

#### Update Billing Date
```http
PUT /subscription-contracts-update-billing-date
```
Modify the next billing date for a contract.

#### Update Frequency/Interval
```http
PUT /subscription-contracts-update-frequency-by-selling-plan
PUT /subscription-contracts-update-billing-interval
```
Change billing frequency or interval.

### Customer Portal

#### Generate Management Link
```http
GET /manage-subscription-link/{customerId}
```
Returns a customer portal link for subscription management.

#### Update Payment Method
```http
PUT /subscription-contracts-update-payment-method
PUT /subscription-contracts-update-existing-payment-method
```
Handle payment method updates.

### Billing & One-offs

#### Get Billing Attempts
```http
GET /subscription-billing-attempts/past-orders
```
Retrieve past billing attempts for polling credit resets.

#### Add One-off Charges
```http
PUT /subscription-contract-one-offs-by-contractId-and-billing-attempt-id
```
Add one-time charges to the next billing cycle.

### Selling Plans

#### Get Selling Plan Groups
```http
GET /subscription-groups
GET /subscription-groups/all-selling-plans
```
Retrieve selling plan configurations.

#### Create Selling Plan Group
```http
POST /subscription-groups
```
Create new subscription tiers.

## Shopify Webhook Integration

### Required Webhooks

Configure these webhooks in your Shopify admin:

#### orders/paid
Triggered when an order is successfully paid. Used for:
- **Subscription renewals**: Reset credits when subscription order is paid
- **Top-up purchases**: Add credits immediately when top-up product is purchased

#### orders/create
Optional backup for order creation events.

### Webhook Handler Implementation

```javascript
app.post('/v1/webhooks/shopify', async (req, res) => {
    const topic = req.headers['x-shopify-topic'];
    const signature = req.headers['x-shopify-hmac-sha256'];
    
    // Verify webhook signature
    if (!verifyShopifyWebhook(req.body, signature)) {
        return res.status(401).send('Unauthorized');
    }
    
    const order = req.body;
    
    switch (topic) {
        case 'orders/paid':
            await handleOrderPaid(order);
            break;
        default:
            console.log('Unhandled webhook:', topic);
    }
    
    res.status(200).send('OK');
});

async function handleOrderPaid(order) {
    const customerId = order.customer.id.toString();
    
    // Check if subscription order
    const subscriptionItem = order.line_items.find(item => 
        item.selling_plan_allocation !== null
    );
    
    if (subscriptionItem) {
        // Subscription renewal - reset credits
        const sellingPlanId = subscriptionItem.selling_plan_allocation.selling_plan.id;
        const credits = getCreditsForSellingPlan(sellingPlanId);
        
        await resetCreditsForCustomer(customerId, credits, {
            orderId: order.id,
            sellingPlanId: sellingPlanId
        });
    }
    
    // Check for top-up products
    const topupItem = order.line_items.find(item => 
        isTopupSku(item.sku)
    );
    
    if (topupItem) {
        // Top-up purchase - add credits immediately
        const credits = getCreditsForTopupSku(topupItem.sku);
        
        await addCreditsForCustomer(customerId, credits, {
            orderId: order.id,
            sku: topupItem.sku
        });
    }
}
```

## Credit System Integration

### Mapping Selling Plans to Credits

```javascript
const SELLING_PLAN_CREDITS = {
    [process.env.SELLING_PLAN_TIER1]: 1000,  // $49/mo
    [process.env.SELLING_PLAN_TIER2]: 2500,  // $79/mo  
    [process.env.SELLING_PLAN_TIER3]: 8000,  // $199/mo
};

const TOPUP_SKU_CREDITS = {
    [process.env.TOPUP_SKU_1000]: 1000,  // $30
    [process.env.TOPUP_SKU_2000]: 2000,  // $50
};
```

### Credit Reset Logic

```javascript
async function resetCreditsForCustomer(customerId, credits, metadata) {
    const user = await getUserByShopifyCustomerId(customerId);
    
    await db.transaction(async (trx) => {
        // Set billing cycle window
        await trx('subscriptions')
            .where('user_id', user.id)
            .update({
                current_period_start: new Date(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        
        // Add credit reset entry
        await trx('credit_ledger').insert({
            user_id: user.id,
            delta: credits,
            event_type: 'CREDIT_BASE_RESET',
            reason: 'Subscription renewal',
            ext_ref: metadata,
            created_at: new Date()
        });
        
        // Update balance
        await updateCreditBalance(trx, user.id);
    });
}
```

## Customer Portal Integration

### Generate Portal Link

```javascript
async function getApstle PortalLink(userId) {
    const user = await getUserById(userId);
    
    const response = await fetch(
        `${process.env.APSTLE_API_BASE}/manage-subscription-link/${user.shopify_customer_id}`,
        {
            headers: {
                'X-Apstle-Api-Key': process.env.APSTLE_API_KEY
            }
        }
    );
    
    const data = await response.json();
    return data.url;
}
```

## Checkout Integration

### Subscription Checkout

```javascript
async function createSubscriptionCheckout(sellingPlanId, customerId) {
    // Use Shopify Checkout API with selling plan
    const checkout = await shopify.checkout.create({
        line_items: [{
            variant_id: getVariantIdForSellingPlan(sellingPlanId),
            quantity: 1,
            selling_plan: sellingPlanId
        }],
        customer_id: customerId
    });
    
    return checkout.web_url;
}
```

### Top-up Checkout

```javascript
async function createTopupCheckout(topupSku, customerId) {
    const productId = getProductIdForSku(topupSku);
    
    const checkout = await shopify.checkout.create({
        line_items: [{
            variant_id: productId,
            quantity: 1
        }],
        customer_id: customerId
    });
    
    return checkout.web_url;
}
```

## Environment Variables

Update your environment configuration:

```bash
# Apstle Configuration
APSTLE_API_BASE=https://<apstle-host>/api/external/v2
APSTLE_API_KEY=your-apstle-api-key

# Shopify Configuration
SHOPIFY_WEBHOOK_SECRET=your-shopify-webhook-secret
SHOPIFY_STORE_URL=your-store.myshopify.com

# Selling Plans
SELLING_PLAN_TIER1=selling-plan-id-tier1
SELLING_PLAN_TIER2=selling-plan-id-tier2
SELLING_PLAN_TIER3=selling-plan-id-tier3

# Top-up SKUs
TOPUP_SKU_1000=topup-1000-sku
TOPUP_SKU_2000=topup-2000-sku
```

## Migration Checklist

- [ ] Set up Apstle Subscriptions in Shopify
- [ ] Configure selling plan groups for 3 tiers
- [ ] Create top-up products in Shopify
- [ ] Set up Shopify webhooks (orders/paid)
- [ ] Update backend environment variables
- [ ] Replace LemonSqueezy API calls with Apstle/Shopify
- [ ] Update webhook handlers
- [ ] Test subscription creation and renewal
- [ ] Test top-up purchases
- [ ] Test customer portal links
- [ ] Verify credit reset logic

## Testing

### Subscription Flow Test
1. Create subscription via Apstle checkout
2. Verify credits are set on first order/paid webhook
3. Simulate renewal - verify credits reset
4. Test upgrade/downgrade via customer portal

### Top-up Flow Test
1. Purchase top-up product
2. Verify immediate credit addition
3. Test different top-up amounts

### Portal Test
1. Generate customer portal link
2. Verify subscription management works
3. Test payment method updates

This integration maintains the same credit system and ledger logic while replacing the subscription management layer with Apstle and Shopify.
