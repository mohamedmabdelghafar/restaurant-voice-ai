// src/database/setup.js - Database Setup Script
require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Setup database
 * Supports PostgreSQL and SQLite
 */
async function setupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not configured in .env');
    process.exit(1);
  }
  
  console.log('🔧 Setting up database...');
  
  if (databaseUrl.startsWith('postgres')) {
    await setupPostgreSQL();
  } else if (databaseUrl.startsWith('sqlite')) {
    await setupSQLite();
  } else {
    console.error('❌ Unsupported database type');
    process.exit(1);
  }
}

/**
 * Setup PostgreSQL
 */
async function setupPostgreSQL() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await client.query(schema);
    console.log('✅ Database schema created successfully');
    
    // Create initial data
    await createInitialData(client);
    
    await client.end();
    console.log('✅ Database setup complete!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

/**
 * Setup SQLite
 */
async function setupSQLite() {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = process.env.DATABASE_URL.replace('sqlite:', '');
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ SQLite connection failed:', err);
      process.exit(1);
    }
  });
  
  console.log('✅ Connected to SQLite');
  
  // Read schema file
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Execute schema
  db.exec(schema, (err) => {
    if (err) {
      console.error('❌ Schema creation failed:', err);
      process.exit(1);
    }
    
    console.log('✅ Database schema created successfully');
    console.log('✅ Database setup complete!');
    
    db.close();
  });
}

/**
 * Create initial test data
 */
async function createInitialData(client) {
  console.log('📝 Creating initial test data...');
  
  // Insert test restaurant (Sandbox)
  try {
    await client.query(`
      INSERT INTO restaurants (id, name, platform, merchant_id, location_id, phone, active)
      VALUES ('test_rest_1', 'Test Restaurant', 'square', 'sandbox_merchant', 'sandbox_location', '+1234567890', true)
      ON CONFLICT (platform, merchant_id) DO NOTHING
    `);
    
    console.log('✅ Test restaurant created');
  } catch (error) {
    console.error('⚠️ Could not create test data:', error.message);
  }
}

// Run setup
setupDatabase().catch(console.error);

module.exports = { setupDatabase };
