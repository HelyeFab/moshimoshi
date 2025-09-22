"use strict";
/**
 * Mock Stripe Events for Testing
 *
 * Provides realistic Stripe event fixtures for testing handlers
 * Based on actual Stripe webhook payloads
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockCheckoutSessionCompleted = createMockCheckoutSessionCompleted;
exports.createMockSubscriptionCreated = createMockSubscriptionCreated;
exports.createMockInvoicePaymentSucceeded = createMockInvoicePaymentSucceeded;
exports.createMockInvoicePaymentFailed = createMockInvoicePaymentFailed;
exports.createMockSubscriptionDeleted = createMockSubscriptionDeleted;
/**
 * Creates a mock checkout.session.completed event
 */
function createMockCheckoutSessionCompleted(overrides) {
    const session = Object.assign({ id: 'cs_test_a1b2c3d4', object: 'checkout.session', amount_subtotal: 1999, amount_total: 1999, cancel_url: 'https://example.com/cancel', client_reference_id: 'uid_test123', currency: 'usd', customer: 'cus_test123', customer_details: {
            email: 'test@example.com',
            metadata: {
                uid: 'uid_test123',
            },
        }, customer_email: 'test@example.com', livemode: false, metadata: {
            uid: 'uid_test123',
            price_id: 'price_1QcTestMonthlyXXX',
        }, mode: 'subscription', payment_intent: null, payment_status: 'paid', status: 'complete', subscription: 'sub_test123', success_url: 'https://example.com/success' }, overrides);
    return {
        id: 'evt_checkout_completed',
        object: 'event',
        api_version: '2024-06-20',
        created: Date.now() / 1000,
        data: { object: session },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_checkout', idempotency_key: null },
        type: 'checkout.session.completed',
    };
}
/**
 * Creates a mock customer.subscription.created event
 */
function createMockSubscriptionCreated(overrides) {
    const subscription = Object.assign({ id: 'sub_test123', object: 'subscription', application: null, application_fee_percent: null, automatic_tax: { enabled: false }, billing_cycle_anchor: Date.now() / 1000, billing_thresholds: null, cancel_at: null, cancel_at_period_end: false, canceled_at: null, collection_method: 'charge_automatically', created: Date.now() / 1000, currency: 'usd', current_period_end: (Date.now() / 1000) + (30 * 24 * 60 * 60), current_period_start: Date.now() / 1000, customer: 'cus_test123', days_until_due: null, default_payment_method: 'pm_test123', default_source: null, default_tax_rates: [], description: null, discount: null, ended_at: null, items: {
            object: 'list',
            data: [{
                    id: 'si_test123',
                    object: 'subscription_item',
                    billing_thresholds: null,
                    created: Date.now() / 1000,
                    metadata: {},
                    price: {
                        id: 'price_1QcTestMonthlyXXX',
                        object: 'price',
                        active: true,
                        billing_scheme: 'per_unit',
                        created: Date.now() / 1000,
                        currency: 'usd',
                        livemode: false,
                        lookup_key: null,
                        metadata: {},
                        nickname: 'Monthly Plan',
                        product: 'prod_test123',
                        recurring: {
                            aggregate_usage: null,
                            interval: 'month',
                            interval_count: 1,
                            trial_period_days: null,
                            usage_type: 'licensed',
                        },
                        tiers_mode: null,
                        transform_quantity: null,
                        type: 'recurring',
                        unit_amount: 1999,
                        unit_amount_decimal: '1999',
                    },
                    quantity: 1,
                    subscription: 'sub_test123',
                    tax_rates: [],
                }],
            has_more: false,
            url: '/v1/subscription_items?subscription=sub_test123',
        }, latest_invoice: 'inv_test123', livemode: false, metadata: {}, next_pending_invoice_item_invoice: null, on_behalf_of: null, pause_collection: null, payment_settings: {
            payment_method_options: null,
            payment_method_types: null,
            save_default_payment_method: 'off',
        }, pending_invoice_item_interval: null, pending_setup_intent: null, pending_update: null, schedule: null, start_date: Date.now() / 1000, status: 'active', test_clock: null, transfer_data: null, trial_end: null, trial_settings: { end_behavior: { missing_payment_method: 'create_invoice' } }, trial_start: null }, overrides);
    return {
        id: 'evt_subscription_created',
        object: 'event',
        api_version: '2024-06-20',
        created: Date.now() / 1000,
        data: { object: subscription },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_sub_created', idempotency_key: null },
        type: 'customer.subscription.created',
    };
}
/**
 * Creates a mock invoice.payment_succeeded event
 */
function createMockInvoicePaymentSucceeded(overrides) {
    const invoice = Object.assign({ id: 'inv_test123', object: 'invoice', account_country: 'US', account_name: 'Test Company', account_tax_ids: null, amount_due: 1999, amount_paid: 1999, amount_remaining: 0, amount_shipping: 0, application: null, application_fee_amount: null, attempt_count: 1, attempted: true, auto_advance: false, automatic_tax: { enabled: false, status: null }, billing_reason: 'subscription_cycle', charge: 'ch_test123', collection_method: 'charge_automatically', created: Date.now() / 1000, currency: 'usd', custom_fields: null, customer: 'cus_test123', customer_address: null, customer_email: 'test@example.com', customer_name: 'Test User', customer_phone: null, customer_shipping: null, customer_tax_exempt: 'none', customer_tax_ids: [], default_payment_method: null, default_source: null, default_tax_rates: [], description: null, discount: null, discounts: [], due_date: null, ending_balance: 0, footer: null, from_invoice: null, hosted_invoice_url: 'https://invoice.stripe.com/i/test123', invoice_pdf: 'https://invoice.stripe.com/i/test123/pdf', last_finalization_error: null, latest_revision: null, lines: {
            object: 'list',
            data: [{
                    id: 'il_test123',
                    object: 'line_item',
                    amount: 1999,
                    amount_excluding_tax: 1999,
                    currency: 'usd',
                    description: 'Monthly subscription',
                    discount_amounts: [],
                    discountable: true,
                    discounts: [],
                    invoice_item: 'ii_test123',
                    livemode: false,
                    metadata: {},
                    period: {
                        end: (Date.now() / 1000) + (30 * 24 * 60 * 60),
                        start: Date.now() / 1000,
                    },
                    plan: null,
                    price: {
                        id: 'price_1QcTestMonthlyXXX',
                        object: 'price',
                        active: true,
                        billing_scheme: 'per_unit',
                        created: Date.now() / 1000,
                        currency: 'usd',
                        livemode: false,
                        lookup_key: null,
                        metadata: {},
                        nickname: 'Monthly Plan',
                        product: 'prod_test123',
                        recurring: {
                            aggregate_usage: null,
                            interval: 'month',
                            interval_count: 1,
                            trial_period_days: null,
                            usage_type: 'licensed',
                        },
                        tiers_mode: null,
                        transform_quantity: null,
                        type: 'recurring',
                        unit_amount: 1999,
                        unit_amount_decimal: '1999',
                    },
                    proration: false,
                    proration_details: { credited_items: null },
                    quantity: 1,
                    subscription: 'sub_test123',
                    subscription_item: 'si_test123',
                    tax_amounts: [],
                    tax_rates: [],
                    type: 'subscription',
                    unit_amount_excluding_tax: '1999',
                }],
            has_more: false,
            url: '/v1/invoices/inv_test123/lines',
        }, livemode: false, metadata: {}, next_payment_attempt: null, number: 'INV-0001', on_behalf_of: null, paid: true, paid_out_of_band: false, payment_intent: 'pi_test123', payment_settings: {
            default_mandate: null,
            payment_method_options: null,
            payment_method_types: null,
        }, period_end: (Date.now() / 1000) + (30 * 24 * 60 * 60), period_start: Date.now() / 1000, post_payment_credit_notes_amount: 0, pre_payment_credit_notes_amount: 0, quote: null, receipt_number: null, rendering_options: null, shipping_cost: null, shipping_details: null, starting_balance: 0, statement_descriptor: null, status: 'paid', status_transitions: {
            finalized_at: Date.now() / 1000,
            marked_uncollectible_at: null,
            paid_at: Date.now() / 1000,
            voided_at: null,
        }, subscription: 'sub_test123', subscription_proration_date: null, subtotal: 1999, subtotal_excluding_tax: 1999, tax: null, test_clock: null, total: 1999, total_discount_amounts: [], total_excluding_tax: 1999, total_tax_amounts: [], transfer_data: null, webhooks_delivered_at: Date.now() / 1000 }, overrides);
    return {
        id: 'evt_invoice_payment_succeeded',
        object: 'event',
        api_version: '2024-06-20',
        created: Date.now() / 1000,
        data: { object: invoice },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_invoice', idempotency_key: null },
        type: 'invoice.payment_succeeded',
    };
}
/**
 * Creates a mock invoice.payment_failed event
 */
function createMockInvoicePaymentFailed(overrides) {
    const invoice = createMockInvoicePaymentSucceeded(overrides).data.object;
    // Modify for failed payment
    invoice.amount_paid = 0;
    invoice.amount_remaining = invoice.amount_due;
    invoice.attempt_count = 2;
    invoice.next_payment_attempt = (Date.now() / 1000) + (3 * 24 * 60 * 60); // 3 days
    invoice.paid = false;
    invoice.status = 'open';
    invoice.last_payment_error = {
        charge: 'ch_failed_test123',
        code: 'card_declined',
        decline_code: 'insufficient_funds',
        doc_url: 'https://stripe.com/docs/error-codes/card-declined',
        message: 'Your card has insufficient funds.',
        payment_method: {
            id: 'pm_test123',
            object: 'payment_method',
            type: 'card',
        },
        type: 'card_error',
    };
    return {
        id: 'evt_invoice_payment_failed',
        object: 'event',
        api_version: '2024-06-20',
        created: Date.now() / 1000,
        data: { object: invoice },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_invoice_failed', idempotency_key: null },
        type: 'invoice.payment_failed',
    };
}
/**
 * Creates a mock customer.subscription.deleted event
 */
function createMockSubscriptionDeleted(overrides) {
    const subscription = createMockSubscriptionCreated(overrides).data.object;
    // Modify for deletion
    subscription.status = 'canceled';
    subscription.canceled_at = Date.now() / 1000;
    subscription.ended_at = Date.now() / 1000;
    return {
        id: 'evt_subscription_deleted',
        object: 'event',
        api_version: '2024-06-20',
        created: Date.now() / 1000,
        data: { object: subscription },
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_sub_deleted', idempotency_key: null },
        type: 'customer.subscription.deleted',
    };
}
//# sourceMappingURL=mock-events.js.map