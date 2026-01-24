// src/api/square-api.js - Square Menu & Orders Integration
const { Client, Environment } = require('square');
const { v4: uuidv4 } = require('uuid');
const TokenManager = require('../auth/token-manager');

// Default timeout for API requests (30 seconds)
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT) || 30000;

/**
 * Get Square client for a specific merchant with timeout
 */
function getSquareClient(accessToken) {
  return new Client({
    accessToken,
    environment: process.env.SQUARE_ENVIRONMENT === 'production'
      ? Environment.Production
      : Environment.Sandbox,
    timeout: API_TIMEOUT
  });
}

/**
 * Get restaurant menu (catalog items)
 */
async function getMenu(merchantId, locationId) {
  try {
    const accessToken = await TokenManager.getAccessToken('square', merchantId);
    const client = getSquareClient(accessToken);

    // Get all catalog objects
    const response = await client.catalogApi.listCatalog(
      undefined,
      'ITEM,ITEM_VARIATION,CATEGORY,MODIFIER_LIST,MODIFIER'
    );

    const catalogObjects = response.result.objects || [];

    // Organize into structured menu
    const menu = {
      categories: catalogObjects.filter(obj => obj.type === 'CATEGORY'),
      items: catalogObjects.filter(obj => obj.type === 'ITEM'),
      variations: catalogObjects.filter(obj => obj.type === 'ITEM_VARIATION'),
      modifierLists: catalogObjects.filter(obj => obj.type === 'MODIFIER_LIST'),
      modifiers: catalogObjects.filter(obj => obj.type === 'MODIFIER')
    };

    // Build hierarchical structure
    const formattedMenu = buildMenuHierarchy(menu);

    return {
      platform: 'square',
      merchantId,
      locationId,
      menu: formattedMenu,
      totalItems: menu.items.length
    };

  } catch (error) {
    console.error('Square getMenu error:', error);
    throw new Error(`Failed to get Square menu: ${error.message}`);
  }
}

/**
 * Search menu items by name
 */
async function searchMenu(merchantId, searchTerm) {
  try {
    const accessToken = await TokenManager.getAccessToken('square', merchantId);
    const client = getSquareClient(accessToken);

    const response = await client.catalogApi.searchCatalogItems({
      textFilter: searchTerm
    });

    return response.result.items || [];

  } catch (error) {
    console.error('Square searchMenu error:', error);
    throw new Error(`Failed to search Square menu: ${error.message}`);
  }
}

/**
 * Create a new order
 */
async function createOrder(merchantId, orderData) {
  try {
    const accessToken = await TokenManager.getAccessToken('square', merchantId);
    const client = getSquareClient(accessToken);

    const { locationId, lineItems, customer, fulfillment } = orderData;

    // Build line items
    const formattedLineItems = lineItems.map(item => ({
      catalogObjectId: item.variationId,
      quantity: String(item.quantity),
      modifiers: (item.modifiers || []).map(mod => ({
        catalogObjectId: mod.modifierId
      })),
      note: item.note || ''
    }));

    // Build fulfillment details
    const fulfillmentData = {
      type: fulfillment.type || 'PICKUP',
      state: 'PROPOSED',
      pickupDetails: {
        recipient: {
          displayName: customer.name,
          phoneNumber: customer.phone
        },
        scheduleType: fulfillment.pickupTime ? 'SCHEDULED' : 'ASAP',
        pickupAt: fulfillment.pickupTime,
        prepTimeDuration: 'PT15M',
        note: fulfillment.note || ''
      }
    };

    // Create order
    const response = await client.ordersApi.createOrder({
      order: {
        locationId,
        lineItems: formattedLineItems,
        fulfillments: [fulfillmentData],
        customerId: customer.customerId
      },
      idempotencyKey: uuidv4()
    });

    const order = response.result.order;

    return {
      platform: 'square',
      orderId: order.id,
      locationId: order.locationId,
      totalMoney: order.totalMoney,
      state: order.state,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      fulfillments: order.fulfillments
    };

  } catch (error) {
    console.error('Square createOrder error:', error);
    throw new Error(`Failed to create Square order: ${error.message}`);
  }
}

/**
 * Get order details
 */
async function getOrder(merchantId, orderId) {
  try {
    const accessToken = await TokenManager.getAccessToken('square', merchantId);
    const client = getSquareClient(accessToken);

    const response = await client.ordersApi.retrieveOrder(orderId);
    const order = response.result.order;

    return {
      platform: 'square',
      orderId: order.id,
      locationId: order.locationId,
      state: order.state,
      totalMoney: order.totalMoney,
      lineItems: order.lineItems,
      fulfillments: order.fulfillments,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

  } catch (error) {
    console.error('Square getOrder error:', error);
    throw new Error(`Failed to get Square order: ${error.message}`);
  }
}

/**
 * Update order fulfillment status
 */
async function updateOrderStatus(merchantId, orderId, fulfillmentUid, newState, version) {
  try {
    const accessToken = await TokenManager.getAccessToken('square', merchantId);
    const client = getSquareClient(accessToken);

    const response = await client.ordersApi.updateOrder(orderId, {
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        version,
        fulfillments: [{
          uid: fulfillmentUid,
          state: newState // RESERVED, PREPARED, COMPLETED, CANCELED
        }]
      },
      idempotencyKey: uuidv4()
    });

    return response.result.order;

  } catch (error) {
    console.error('Square updateOrderStatus error:', error);
    throw new Error(`Failed to update Square order: ${error.message}`);
  }
}

/**
 * Get location information
 */
async function getLocations(merchantId) {
  try {
    const accessToken = await TokenManager.getAccessToken('square', merchantId);
    const client = getSquareClient(accessToken);

    const response = await client.locationsApi.listLocations();
    return response.result.locations || [];

  } catch (error) {
    console.error('Square getLocations error:', error);
    throw new Error(`Failed to get Square locations: ${error.message}`);
  }
}

/**
 * Helper: Build hierarchical menu structure
 */
function buildMenuHierarchy(menu) {
  const result = [];

  // Group items by category
  const itemsByCategory = new Map();

  for (const item of menu.items) {
    const categoryIds = item.itemData?.categoryIds || ['uncategorized'];

    for (const categoryId of categoryIds) {
      if (!itemsByCategory.has(categoryId)) {
        itemsByCategory.set(categoryId, []);
      }
      itemsByCategory.get(categoryId).push(item);
    }
  }

  // Build category structure
  for (const category of menu.categories) {
    const categoryItems = itemsByCategory.get(category.id) || [];

    result.push({
      id: category.id,
      name: category.categoryData.name,
      items: categoryItems.map(item => ({
        id: item.id,
        name: item.itemData.name,
        description: item.itemData.description,
        variations: menu.variations
          .filter(v => item.itemData.variations?.some(iv => iv.id === v.id))
          .map(v => ({
            id: v.id,
            name: v.itemVariationData.name,
            price: v.itemVariationData.priceMoney
          })),
        modifierLists: item.itemData.modifierListInfo?.map(ml => ({
          id: ml.modifierListId,
          enabled: ml.enabled
        })) || []
      }))
    });
  }

  return result;
}

module.exports = {
  getMenu,
  searchMenu,
  createOrder,
  getOrder,
  updateOrderStatus,
  getLocations
};
