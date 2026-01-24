// src/webhooks/retell-webhook.js - Retell AI Webhook Handler
const axios = require('axios');

const RETELL_API_KEY = process.env.RETELL_API_KEY;

/**
 * Handle Retell AI webhook
 */
async function handleWebhook(req, res) {
  try {
    const event = req.body;
    
    console.log('Retell webhook received:', {
      event: event.event,
      callId: event.call?.call_id
    });
    
    // Respond immediately
    res.status(200).json({ received: true });
    
    // Process event asynchronously
    await processEvent(event);
    
  } catch (error) {
    console.error('Retell webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * Process Retell event
 */
async function processEvent(event) {
  const { event: eventType, call } = event;
  
  try {
    switch (eventType) {
      case 'call_started':
        await handleCallStarted(call);
        break;
        
      case 'call_ended':
        await handleCallEnded(call);
        break;
        
      case 'call_analyzed':
        await handleCallAnalyzed(call);
        break;
        
      default:
        console.log('Unhandled Retell event:', eventType);
    }
  } catch (error) {
    console.error(`Error processing Retell ${eventType}:`, error);
  }
}

/**
 * Handle call started
 */
async function handleCallStarted(call) {
  console.log('Call started:', {
    callId: call.call_id,
    from: call.from_number,
    to: call.to_number,
    agentId: call.agent_id
  });
  
  // TODO:
  // - Log call start in database
  // - Initialize order session
  // - Load restaurant menu for agent context
}

/**
 * Handle call ended
 */
async function handleCallEnded(call) {
  console.log('Call ended:', {
    callId: call.call_id,
    duration: call.call_duration,
    disconnectionReason: call.disconnection_reason
  });
  
  // Extract order information from transcript
  const orderData = extractOrderFromTranscript(call.transcript);
  
  if (orderData) {
    console.log('Order extracted from call:', orderData);
    
    // TODO:
    // - Create order via unified API
    // - Send confirmation SMS
    // - Update call record with order ID
  }
  
  // TODO:
  // - Save call transcript to database
  // - Calculate call metrics
  // - Trigger post-call workflows
}

/**
 * Handle call analyzed (after AI processing)
 */
async function handleCallAnalyzed(call) {
  console.log('Call analyzed:', {
    callId: call.call_id,
    sentiment: call.call_analysis?.sentiment,
    summary: call.call_analysis?.call_summary
  });
  
  // TODO:
  // - Store analysis results
  // - Trigger quality assurance checks
  // - Update agent performance metrics
}

/**
 * Extract order information from transcript
 */
function extractOrderFromTranscript(transcript) {
  if (!transcript) return null;
  
  // This is a simplified example
  // In production, use NLP or parse structured data from Retell
  
  const orderPattern = /order.*(\d+)\s*(burger|pizza|sandwich)/gi;
  const matches = transcript.match(orderPattern);
  
  if (matches) {
    return {
      items: matches,
      rawTranscript: transcript,
      timestamp: new Date().toISOString()
    };
  }
  
  return null;
}

/**
 * Update Retell agent with dynamic menu
 * Call this when menu changes
 */
async function updateAgentMenu(agentId, menuData) {
  try {
    const response = await axios.patch(
      `https://api.retellai.com/v1/agent/${agentId}`,
      {
        general_prompt: generateMenuPrompt(menuData),
        begin_message: "Welcome to our restaurant! How can I help you today?"
      },
      {
        headers: {
          'Authorization': `Bearer ${RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Agent menu updated:', agentId);
    return response.data;
    
  } catch (error) {
    console.error('Failed to update agent menu:', error.response?.data || error);
    throw error;
  }
}

/**
 * Generate menu prompt for Retell agent
 */
function generateMenuPrompt(menuData) {
  let prompt = "You are a friendly restaurant ordering assistant. Here is our menu:\n\n";
  
  for (const category of menuData.menu) {
    prompt += `${category.name}:\n`;
    
    for (const item of category.items) {
      const prices = item.variations?.map(v => v.price?.amount / 100).filter(Boolean);
      const priceStr = prices?.length ? `$${Math.min(...prices)}` : '';
      
      prompt += `- ${item.name} ${priceStr}\n`;
      
      if (item.description) {
        prompt += `  ${item.description}\n`;
      }
    }
    
    prompt += "\n";
  }
  
  prompt += "\nHelp customers place orders by asking about quantities, special instructions, and pickup time.";
  
  return prompt;
}

module.exports = {
  handleWebhook,
  updateAgentMenu
};
