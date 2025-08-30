# Apstle Support Request - AutoVFX Integration

## Subject: Help Setting Up 3 Subscription Tiers with External API Integration

## My Setup:
- **Shopify Store:** 6134fe-1d.myshopify.com
- **Apstle API Key:** V8v5lUCT7EdIdgb5h93QJJXYgHwdXS1H
- **Integration Type:** External backend system that needs to track subscription renewals for credit management

## What I Need Help With:

### 1. Creating Subscription Tiers
I need to create 3 subscription tiers for my AutoVFX service:

**Tier 1 - Creator:** $49/month
**Tier 2 - Studio:** $79/month  
**Tier 3 - Pro:** $199/month

**Questions:**
- How do I create these as selling plan groups in Apstle?
- Where do I find the selling plan IDs after creation?
- Do I need to create Shopify products first, or does Apstle handle this?

### 2. External API Integration
My backend system needs to:
- Reset user credits when subscriptions renew (via Shopify webhooks)
- Allow customers to upgrade/downgrade tiers
- Generate customer portal links for subscription management

**Questions:**
- How do I get the selling plan IDs to use with your API endpoints?
- Which API endpoint should I use to generate customer portal links?
- How do I identify subscription renewals in Shopify webhooks (orders/paid)?

### 3. Specific API Endpoints I Need
Based on your API documentation, I need help with:

```
GET /api/external/v2/manage-subscription-link/{customerId}
GET /api/external/v2/subscription-contract-details/{contractId}
GET /api/external/v2/subscription-groups/all-selling-plans
```

**Questions:**
- How do I get the customerId and contractId values?
- Are these the Shopify customer ID and some Apstle-specific contract ID?
- How do I map between Shopify orders and Apstle contracts?

### 4. Webhook Integration
I have Shopify webhooks set up for `orders/paid` events.

**Questions:**
- How can I identify which orders are subscription renewals vs regular purchases?
- What fields in the webhook payload indicate Apstle subscription information?
- Do subscription orders include `selling_plan_allocation` data?

### 5. Testing
**Questions:**
- Is there a way to create test subscriptions for development?
- How can I test the customer portal links?
- Can I simulate subscription renewals for testing?

## My Current Technical Setup:
- Backend API ready to receive webhooks
- Webhook server running at: https://d1b7bffb453a.ngrok-free.app/v1/webhooks/shopify
- Already processing Shopify `orders/paid` webhooks
- Need to connect subscription data to my credit management system

## What I'm Looking For:
1. **Step-by-step guide** to create the 3 subscription tiers
2. **The selling plan IDs** I need for my API calls
3. **Clarification** on customer ID mapping between Shopify and Apstle
4. **Example webhook payload** showing subscription renewal data
5. **Testing approach** for the integration

## Timeline:
I'm actively developing this integration and would appreciate guidance within 24-48 hours if possible.

Thank you for your help!
