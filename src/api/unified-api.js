// src/api/unified-api.js - Square POS Integration
const squareAPI = require('./square-api');

/**
 * Simple in-memory restaurant database (replace with real DB)
 */
const restaurants = new Map();

/**
 * Get all restaurants
 */
async function getRestaurants(req, res) {
  try {
    const restaurantList = Array.from(restaurants.values());
    res.json({ restaurants: restaurantList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single restaurant
 */
async function getRestaurant(req, res) {
  try {
    const { id } = req.params;
    const restaurant = restaurants.get(id);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({ restaurant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create restaurant
 */
async function createRestaurant(req, res) {
  try {
    const { name, platform, merchantId, locationId } = req.body;

    const id = `rest_${Date.now()}`;
    const restaurant = {
      id,
      name,
      platform, // 'square'
      merchantId,
      locationId,
      createdAt: new Date().toISOString()
    };

    restaurants.set(id, restaurant);

    res.json({ restaurant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get menu - works with any POS
 */
async function getMenu(req, res) {
  try {
    const { restaurantId } = req.params;
    const restaurant = restaurants.get(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let menu;

    if (restaurant.platform !== 'square') {
      return res.status(400).json({ error: 'Unsupported platform. Only Square is supported.' });
    }

    menu = await squareAPI.getMenu(restaurant.merchantId, restaurant.locationId);

    res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        platform: restaurant.platform
      },
      ...menu
    });

  } catch (error) {
    console.error('getMenu error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Search menu - works with any POS
 */
async function searchMenu(req, res) {
  try {
    const { restaurantId, query } = req.params;
    const restaurant = restaurants.get(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let results;

    if (restaurant.platform !== 'square') {
      return res.status(400).json({ error: 'Unsupported platform. Only Square is supported.' });
    }

    results = await squareAPI.searchMenu(restaurant.merchantId, query);

    res.json({
      query,
      platform: restaurant.platform,
      results
    });

  } catch (error) {
    console.error('searchMenu error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create order - works with any POS
 */
async function createOrder(req, res) {
  try {
    const { restaurantId, lineItems, customer, fulfillment } = req.body;

    const restaurant = restaurants.get(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    let order;

    // Prepare order data based on platform
    const orderData = {
      locationId: restaurant.locationId,
      lineItems,
      customer,
      fulfillment
    };

    if (restaurant.platform !== 'square') {
      return res.status(400).json({ error: 'Unsupported platform. Only Square is supported.' });
    }

    order = await squareAPI.createOrder(restaurant.merchantId, orderData);

    res.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name
      },
      order
    });

  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get order - works with any POS
 */
async function getOrder(req, res) {
  try {
    const { orderId } = req.params;
    const { restaurantId, platform, merchantId } = req.query;

    if (!platform || !merchantId) {
      return res.status(400).json({ error: 'platform and merchantId required' });
    }

    let order;

    if (platform !== 'square') {
      return res.status(400).json({ error: 'Unsupported platform. Only Square is supported.' });
    }

    order = await squareAPI.getOrder(merchantId, orderId);

    res.json({ order });

  } catch (error) {
    console.error('getOrder error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update order - works with any POS
 */
async function updateOrder(req, res) {
  try {
    const { orderId } = req.params;
    const { platform, merchantId, status, fulfillmentUid, version } = req.body;

    if (!platform || !merchantId) {
      return res.status(400).json({ error: 'platform and merchantId required' });
    }

    let order;

    if (platform !== 'square') {
      return res.status(400).json({ error: 'Unsupported platform. Only Square is supported.' });
    }

    order = await squareAPI.updateOrderStatus(
      merchantId,
      orderId,
      fulfillmentUid,
      status,
      version
    );

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('updateOrder error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get restaurant orders (for admin dashboard)
 */
async function getRestaurantOrders(req, res) {
  try {
    const { restaurantId } = req.params;

    // This would query from your orders database
    // For now, return empty array

    res.json({
      restaurantId,
      orders: []
    });

  } catch (error) {
    console.error('getRestaurantOrders error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  getMenu,
  searchMenu,
  createOrder,
  getOrder,
  updateOrder,
  getRestaurantOrders
};
