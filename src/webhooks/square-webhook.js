// src/webhooks/square-webhook.js - Square Webhook Handler
const crypto = require('crypto');

// Validate required environment variables
const SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const NOTIFICATION_URL = process.env.BASE_URL + '/webhook/square';

// Warn if signature key is not configured
if (!SIGNATURE_KEY) {
  console.warn('⚠️  SQUARE_WEBHOOK_SIGNATURE_KEY not configured - webhook verification disabled!');
}

/**
 * Verify webhook signature using HMAC-SHA256
 * @param {string} body - Raw request body
 * @param {string} signature - Signature from request header
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(body, signature) {
  // If no signature key configured, skip verification (log warning on startup)
  if (!SIGNATURE_KEY) {
    console.warn('Webhook signature verification skipped - no SIGNATURE_KEY');
    return true; // Allow in development, but warn
  }

  if (!signature) {
    console.error('Missing webhook signature header');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', SIGNATURE_KEY);
    hmac.update(NOTIFICATION_URL + body);
    const expectedSignature = hmac.digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (error) {
    console.error('Signature verification error:', error.message);
    return false;
  }
}

/**
 * Track processed events (use Redis in production)
 */
const processedEvents = new Set();

/**
 * Handle Square webhook
 */
async function handleWebhook(req, res) {
  let body;
  let event;

  try {
    const signature = req.headers['x-square-hmacsha256-signature'];
    body = req.body.toString();

    // Parse JSON first to validate it before responding
    try {
      event = JSON.parse(body);
    } catch (parseError) {
      console.error('Invalid JSON in webhook body:', parseError.message);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    // Verify signature
    if (!verifySignature(body, signature)) {
      console.error('Invalid Square webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Respond immediately (Square requires 200 within 10 seconds)
    res.status(200).json({ received: true, eventId: event.event_id });

    // Process event asynchronously (after response sent)
    setImmediate(async () => {
      try {
        await processEvent(event);
      } catch (processError) {
        console.error('Error processing webhook event:', processError);
      }
    });

  } catch (error) {
    console.error('Square webhook error:', error);
    // Only send error response if not already sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal error' });
    }
  }
}

/**
 * Process webhook event
 */
async function processEvent(event) {
  const { type, event_id, merchant_id, data } = event;

  // Check if already processed (idempotency)
  if (processedEvents.has(event_id)) {
    console.log('Event already processed:', event_id);
    return;
  }

  console.log(`Processing Square webhook: ${type} for merchant: ${merchant_id}`);

  try {
    switch (type) {
      case 'order.created':
        await handleOrderCreated(data.object.order_created);
        break;

      case 'order.updated':
        await handleOrderUpdated(data.object.order_updated);
        break;

      case 'order.fulfillment.updated':
        await handleFulfillmentUpdated(data.object.order_fulfillment_updated);
        break;

      case 'payment.created':
        await handlePaymentCreated(data.object.payment);
        break;

      case 'payment.updated':
        await handlePaymentUpdated(data.object.payment);
        break;

      case 'oauth.authorization.revoked':
        await handleOAuthRevoked(merchant_id);
        break;

      default:
        console.log('Unhandled event type:', type);
    }

    // Mark as processed
    processedEvents.add(event_id);

    // Clean old events (keep last 1000)
    if (processedEvents.size > 1000) {
      const toDelete = Array.from(processedEvents).slice(0, 500);
      toDelete.forEach(id => processedEvents.delete(id));
    }

  } catch (error) {
    console.error(`Error processing ${type}:`, error);
  }
}

/**
 * Handle order.created event
 */
async function handleOrderCreated(orderData) {
  const order = orderData.order;

  console.log('New order created:', {
    orderId: order.id,
    locationId: order.location_id,
    state: order.state,
    totalMoney: order.total_money
  });

  // TODO: 
  // - Save order to database
  // - Send notification to restaurant
  // - Trigger n8n workflow
  // - Update kitchen display system
}

/**
 * Handle order.updated event
 */
async function handleOrderUpdated(orderData) {
  const order = orderData.order;

  console.log('Order updated:', {
    orderId: order.id,
    state: order.state,
    version: order.version
  });

  // TODO:
  // - Update order in database
  // - Notify customer if status changed
}

/**
 * Handle order.fulfillment.updated event
 */
async function handleFulfillmentUpdated(fulfillmentData) {
  const { order_id, fulfillment_update } = fulfillmentData;

  console.log('Fulfillment updated:', {
    orderId: order_id,
    fulfillmentUid: fulfillment_update[0]?.uid,
    state: fulfillment_update[0]?.state
  });

  // TODO:
  // - Update fulfillment status in database
  // - Send SMS to customer with pickup time
  // - Notify via Retell AI if needed
}

/**
 * Handle payment.created event
 */
async function handlePaymentCreated(paymentData) {
  console.log('Payment received:', {
    paymentId: paymentData.id,
    orderId: paymentData.order_id,
    amount: paymentData.amount_money,
    status: paymentData.status
  });

  // TODO:
  // - Update order payment status
  // - Send receipt to customer
  // - Trigger order confirmation
}

/**
 * Handle payment.updated event
 */
async function handlePaymentUpdated(paymentData) {
  console.log('Payment updated:', {
    paymentId: paymentData.id,
    status: paymentData.status
  });
}

/**
 * Handle OAuth revocation
 */
async function handleOAuthRevoked(merchantId) {
  console.log('OAuth access revoked for merchant:', merchantId);

  // TODO:
  // - Remove tokens from database
  // - Notify admin
  // - Disable restaurant in system
}

module.exports = {
  handleWebhook
};
