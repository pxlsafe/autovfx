# Apstle Migration Summary

## Overview

The AutoVFX extension has been successfully refactored to replace LemonSqueezy with Apstle Subscriptions (Shopify app) for subscription management and billing. This migration maintains the existing credit system and ledger logic while updating the subscription/billing integration layer.

## Changes Made

### 1. Configuration Files Updated

#### `config/config.json`
- ✅ Replaced `lemonSqueezy` section with `apstle` configuration
- ✅ Updated webhook endpoint from `/webhooks/lemonsqueezy` to `/webhooks/shopify`
- ✅ Added Apstle API configuration and Shopify store settings
- ✅ Mapped selling plan IDs for the 3 tiers
- ✅ Added Shopify product IDs for top-up products

#### `config/backend-env.example`
- ✅ Replaced all `LEMON_*` environment variables with `APSTLE_*` and `SHOPIFY_*` equivalents
- ✅ Added Apstle API configuration (`APSTLE_API_BASE`, `APSTLE_API_KEY`)
- ✅ Added Shopify webhook configuration (`SHOPIFY_WEBHOOK_SECRET`)
- ✅ Added selling plan IDs for tiers (`SELLING_PLAN_TIER1/2/3`)
- ✅ Added top-up SKU configuration (`TOPUP_SKU_1000/2000`)

### 2. Frontend Updates

#### `js/license-api.js`
- ✅ Updated portal link generation to use Apstle instead of LemonSqueezy
- ✅ Updated checkout link generation for Shopify instead of LemonSqueezy
- ✅ Changed subscription tier reference from `ls_variant_id` to `selling_plan_id`
- ✅ Updated console logging to reflect Apstle/Shopify integration

#### `pricing.html`
- ✅ Replaced LemonSqueezy overlay script with Shopify checkout integration
- ✅ Updated checkout function to use backend API for Apstle subscription creation
- ✅ Changed variant IDs to selling plan IDs
- ✅ Updated API endpoints to use backend instead of LemonSqueezy directly

### 3. Documentation Updates

#### `docs/backend-implementation-guide.md`
- ✅ Updated to reflect Apstle/Shopify integration
- ✅ Changed webhook handlers from LemonSqueezy to Shopify
- ✅ Updated database schema to use `shopify_customer_id` and `apstle_contract_id`
- ✅ Replaced webhook event handling logic

#### `license_README.md`
- ✅ Updated title and overview to reference Apstle Subscriptions
- ✅ Replaced LemonSqueezy configuration section with Apstle/Shopify setup
- ✅ Updated webhook handling from LemonSqueezy events to Shopify `orders/paid`
- ✅ Updated database schema references
- ✅ Updated webhook handler code examples

#### `README.md`
- ✅ Added subscription requirement to prerequisites
- ✅ Updated setup instructions to mention AutoVFX subscription

#### New Documentation Added
- ✅ Created `docs/apstle-integration-guide.md` - Comprehensive guide for Apstle API integration

## Key Integration Points

### Webhook Mapping

| LemonSqueezy Event | Apstle/Shopify Replacement | Purpose |
|---|---|---|
| `subscription_payment_success` | Shopify `orders/paid` (subscription orders) | Credit reset on renewal |
| `order_created` | Shopify `orders/paid` (top-up products) | Immediate credit top-up |
| `subscription_updated` | Apstle contract update endpoints | Tier changes/upgrades |
| `subscription_cancelled` | Apstle contract status updates | Subscription lifecycle |

### API Endpoint Mapping

| LemonSqueezy API | Apstle/Shopify Replacement | Purpose |
|---|---|---|
| Portal link generation | `GET /manage-subscription-link/{customerId}` | Customer portal access |
| Checkout creation | Shopify checkout with selling plans | Subscription purchases |
| Subscription management | Apstle contract endpoints | Subscription CRUD operations |

### Credit System (Unchanged)

The credit system logic remains identical:
- ✅ 1 credit = 5 seconds of generation
- ✅ Tier 1: 1,000 credits ($49/mo)
- ✅ Tier 2: 2,500 credits ($79/mo)  
- ✅ Tier 3: 8,000 credits ($199/mo)
- ✅ Top-ups: 1,000 credits ($30), 2,000 credits ($50)
- ✅ Reserve/settle/refund logic unchanged
- ✅ Ledger system unchanged

## Implementation Requirements

### Backend Changes Needed

1. **Environment Variables**
   - Set all new `APSTLE_*` and `SHOPIFY_*` environment variables
   - Remove old `LEMON_*` variables

2. **Webhook Handlers**
   - Replace `/v1/webhooks/lemonsqueezy` with `/v1/webhooks/shopify`
   - Handle Shopify webhook signature verification
   - Process `orders/paid` events for both subscription renewals and top-ups

3. **API Endpoints**
   - Update portal link generation to call Apstle API
   - Update checkout creation to use Shopify/Apstle
   - Add new `/v1/checkout/subscription` endpoint for subscription purchases

4. **Database Schema** (if needed)
   - Migrate `ls_customer_id` to `shopify_customer_id`
   - Migrate `ls_subscription_id` to `apstle_contract_id`
   - Migrate `ls_variant_id` to `selling_plan_id`

### Shopify/Apstle Setup

1. **Apstle Configuration**
   - Install Apstle Subscriptions app in Shopify
   - Create selling plan groups for 3 tiers
   - Configure billing intervals and pricing

2. **Shopify Products**
   - Create top-up products with specific SKUs
   - Set up webhook endpoints for `orders/paid`

3. **Testing**
   - Test subscription creation and renewal
   - Test credit resets on billing events
   - Test top-up purchases
   - Test customer portal functionality

## Migration Checklist

- [x] Update configuration files
- [x] Update frontend API integration
- [x] Update pricing page
- [x] Update documentation
- [x] Create Apstle integration guide
- [ ] **Backend Implementation** (requires server-side changes)
- [ ] **Apstle/Shopify Setup** (requires merchant account setup)
- [ ] **Database Migration** (if schema changes needed)
- [ ] **Testing & Validation**

## Compatibility

This refactoring maintains full compatibility with the existing AutoVFX extension UI and user experience. The only changes are in the backend subscription management layer - users will continue to:

- See the same credit balance and usage information
- Use the same generation workflow
- Access customer portal for subscription management
- Purchase top-ups for additional credits

The credit math, ledger system, and user interface remain unchanged, ensuring a seamless transition for existing users.
