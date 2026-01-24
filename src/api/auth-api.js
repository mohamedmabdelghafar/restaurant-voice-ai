// src/api/auth-api.js - Authentication API Endpoints
const bcrypt = require('bcryptjs');
const jwtAuth = require('../auth/jwt-auth');

// In-memory user store (replace with database in production)
const users = new Map();

// Default admin user for testing
const initDefaultAdmin = () => {
    const adminId = 'admin_001';
    if (!users.has(adminId)) {
        users.set(adminId, {
            id: adminId,
            email: 'admin@restaurant.ai',
            password: bcrypt.hashSync('admin123', 10),
            name: 'Admin User',
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        console.log('ℹ️  Default admin user created: admin@restaurant.ai / admin123');
    }
};

// Initialize default admin on startup
initDefaultAdmin();

/**
 * Register new user
 * POST /api/auth/register
 */
async function register(req, res) {
    try {
        const { email, password, name, role = 'user' } = req.body;

        // Check if email already exists
        const existingUser = Array.from(users.values()).find(u => u.email === email);
        if (existingUser) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Email already registered'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Password must be at least 8 characters'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const userId = `user_${Date.now()}`;
        const user = {
            id: userId,
            email,
            password: hashedPassword,
            name,
            role: role === 'admin' ? 'user' : role, // Prevent self-admin registration
            createdAt: new Date().toISOString()
        };

        users.set(userId, user);

        // Generate tokens
        const tokens = jwtAuth.generateTokenPair(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            ...tokens
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Registration failed'
        });
    }
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Email and password are required'
            });
        }

        // Find user by email
        const user = Array.from(users.values()).find(u => u.email === email);

        if (!user) {
            // Use same error for security (don't reveal if email exists)
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid email or password'
            });
        }

        // Generate tokens
        const tokens = jwtAuth.generateTokenPair(user);

        // Update last login
        user.lastLoginAt = new Date().toISOString();

        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            ...tokens
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Login failed'
        });
    }
}

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
async function refresh(req, res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Refresh token is required'
            });
        }

        const tokens = jwtAuth.refreshAccessToken(refreshToken);

        res.json({
            success: true,
            ...tokens
        });

    } catch (error) {
        console.error('Token refresh error:', error.message);
        res.status(401).json({
            error: 'Unauthorized',
            message: error.message
        });
    }
}

/**
 * Logout user (revoke refresh token)
 * POST /api/auth/logout
 */
async function logout(req, res) {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            jwtAuth.revokeRefreshToken(refreshToken);
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Logout failed'
        });
    }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
async function getProfile(req, res) {
    try {
        const user = users.get(req.user.id);

        if (!user) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get profile'
        });
    }
}

/**
 * Change password
 * POST /api/auth/change-password
 */
async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'New password must be at least 8 characters'
            });
        }

        const user = users.get(req.user.id);

        if (!user) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = await bcrypt.hash(newPassword, 12);
        user.passwordChangedAt = new Date().toISOString();

        // Revoke all refresh tokens for security
        jwtAuth.revokeAllUserTokens(user.id);

        res.json({
            success: true,
            message: 'Password changed successfully. Please login again.'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to change password'
        });
    }
}

/**
 * List all users (admin only)
 * GET /api/auth/users
 */
async function listUsers(req, res) {
    try {
        const userList = Array.from(users.values()).map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
        }));

        res.json({
            users: userList,
            total: userList.length
        });

    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to list users'
        });
    }
}

module.exports = {
    register,
    login,
    refresh,
    logout,
    getProfile,
    changePassword,
    listUsers
};
