/**
 * License API Manager
 * Handles backend communication for licensing, authentication, and credit management
 */

class LicenseAPI {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || 'https://your-backend-api.com/v1';
        this.endpoints = config.endpoints || {};
        this.currentUser = null;
        this.authToken = null;
        this.creditBalance = 0;
        this.subscription = null;
        this.cycle = null;
        
        console.log('🔐 LicenseAPI initialized:', {
            baseUrl: this.baseUrl,
            hasEndpoints: Object.keys(this.endpoints).length > 0
        });
        
        // Load stored auth token
        this.loadStoredAuth();
    }

    /**
     * Load stored authentication token from localStorage
     */
    loadStoredAuth() {
        try {
            const stored = localStorage.getItem('autovfx-auth');
            if (stored) {
                const authData = JSON.parse(stored);
                this.authToken = authData.token;
                this.currentUser = authData.user;
                console.log('🔐 Loaded stored auth for user:', this.currentUser?.email);
            }
        } catch (error) {
            console.warn('⚠️  Failed to load stored auth:', error);
            this.clearStoredAuth();
        }
    }

    /**
     * Store authentication token to localStorage
     */
    storeAuth(token, user) {
        try {
            this.authToken = token;
            this.currentUser = user;
            localStorage.setItem('autovfx-auth', JSON.stringify({
                token: token,
                user: user,
                timestamp: Date.now()
            }));
            console.log('🔐 Stored auth for user:', user?.email);
        } catch (error) {
            console.error('❌ Failed to store auth:', error);
        }
    }

    /**
     * Clear stored authentication
     */
    clearStoredAuth() {
        this.authToken = null;
        this.currentUser = null;
        this.creditBalance = 0;
        this.subscription = null;
        this.cycle = null;
        localStorage.removeItem('autovfx-auth');
        console.log('🔐 Cleared stored auth');
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.authToken && !!this.currentUser;
    }

    /**
     * Make authenticated API request
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...options.headers
            },
            ...options
        };

        // Add auth header if we have a token
        if (this.authToken) {
            config.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (_) {
                    // ignore parse error
                }
                const apiMsg = errorData.message || errorData.error || errorData.detail || '';
                if (response.status === 404) {
                    throw new Error(apiMsg || `Service not found (404). Check backend URL in config/config.json and that the server is running.`);
                }
                if (response.status === 0) {
                    throw new Error('Network error. Check your internet connection or CORS.');
                }
                throw new Error(apiMsg || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`❌ API Request failed: ${error.message}`);
            
            // Handle auth errors
            if (String(error.message).includes('401') || String(error.message).includes('Unauthorized')) {
                this.clearStoredAuth();
                throw new Error('Authentication required. Please sign in again.');
            }
            
            throw error;
        }
    }

    /**
     * Authenticate user with email/password or magic link
     */
    async authenticate(credentials) {
        try {
            const response = await this.makeRequest(this.endpoints.auth, {
                method: 'POST',
                body: JSON.stringify(credentials)
            });

            // Handle magic link response (no token, just success message)
            if (credentials.magicLink && response.success) {
                return response; // Just return the success message
            }

            // Handle regular login response (with token)
            if (response.token && response.user) {
                this.storeAuth(response.token, response.user);
                return response;
            } else {
                throw new Error('Invalid authentication response');
            }
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            throw error;
        }
    }

    /**
     * Get current user info including subscription and credits
     */
    async getMe() {
        try {
            const response = await this.makeRequest(this.endpoints.me);
            
            if (response.user) {
                this.currentUser = response.user;
                this.subscription = response.subscription;
                this.cycle = response.cycle;
                this.creditBalance = response.balance || 0;
                
                console.log('👤 User info updated:', {
                    email: this.currentUser.email,
                    balance: this.creditBalance,
                    subscription: this.subscription?.status,
                    cycleEnd: this.cycle?.end
                });
            }
            
            return response;
        } catch (error) {
            console.error('❌ Failed to get user info:', error);
            // If backend returns minimal user after first sign-in, proceed without throwing
            if (this.isAuthenticated()) {
                return { user: this.currentUser, balance: this.creditBalance };
            }
            throw error;
        }
    }

    /**
     * Get current credit balance and cycle info
     */
    async getCredits() {
        try {
            const response = await this.makeRequest(this.endpoints.credits);
            
            this.creditBalance = response.balance || 0;
            this.cycle = response.cycle;
            
            console.log('💰 Credits updated:', {
                balance: this.creditBalance,
                cycleStart: this.cycle?.start,
                cycleEnd: this.cycle?.end
            });
            
            return response;
        } catch (error) {
            console.error('❌ Failed to get credits:', error);
            throw error;
        }
    }

    /**
     * Calculate credits needed for video generation
     */
    calculateCreditsNeeded(durationSeconds) {
        const creditsPerSecond = 15; // Runway pricing: 15 credits per second
        return Math.ceil(durationSeconds * creditsPerSecond);
    }

    /**
     * Check if user has enough credits for generation
     */
    canGenerate(durationSeconds) {
        const needed = this.calculateCreditsNeeded(durationSeconds);
        return {
            canGenerate: this.creditBalance >= needed,
            needed: needed,
            current: this.creditBalance,
            deficit: Math.max(0, needed - this.creditBalance)
        };
    }

    /**
     * Reserve credits for video generation
     */
    async reserveCredits(requestedSeconds) {
        try {
            const response = await this.makeRequest(this.endpoints.jobs, {
                method: 'POST',
                body: JSON.stringify({ requestedSeconds })
            });
            
            console.log('🎟️  Credits reserved:', {
                taskId: response.taskId,
                reservedCredits: response.reservedCredits
            });
            
            // Update local balance
            this.creditBalance -= response.reservedCredits;
            
            return response;
        } catch (error) {
            console.error('❌ Failed to reserve credits:', error);
            throw error;
        }
    }

    /**
     * Get job/task status
     */
    async getJobStatus(taskId) {
        try {
            const response = await this.makeRequest(`${this.endpoints.jobs}/${taskId}`);
            
            console.log('📊 Job status:', {
                taskId: taskId,
                status: response.status,
                usedCredits: response.usedCredits,
                refundCredits: response.refundCredits
            });
            
            return response;
        } catch (error) {
            console.error('❌ Failed to get job status:', error);
            throw error;
        }
    }

    /**
     * Get Apstle/Shopify Customer Portal link for subscription management
     */
    async getPortalLink() {
        try {
            const response = await this.makeRequest(this.endpoints.portal, {
                method: 'POST'
            });
            
            console.log('🏪 Apstle portal link generated');
            return response.url;
        } catch (error) {
            console.error('❌ Failed to get portal link:', error);
            throw error;
        }
    }

    /**
     * Get Shopify checkout link for credit top-up
     */
    async getTopupCheckoutLink(pack) {
        try {
            const response = await this.makeRequest(this.endpoints.checkout, {
                method: 'POST',
                body: JSON.stringify({ pack })
            });
            
            console.log('💳 Shopify checkout link generated for pack:', pack);
            return response.url;
        } catch (error) {
            console.error('❌ Failed to get checkout link:', error);
            throw error;
        }
    }

    /**
     * Sign out user
     */
    signOut() {
        this.clearStoredAuth();
        console.log('👋 User signed out');
    }

    /**
     * Get subscription status summary
     */
    getSubscriptionStatus() {
        if (!this.subscription) {
            return {
                status: 'none',
                tier: null,
                cycleEnd: null,
                needsSubscription: true
            };
        }

        return {
            status: this.subscription.status,
            tier: this.subscription.selling_plan_id,
            cycleEnd: this.cycle?.end,
            needsSubscription: this.subscription.status !== 'active'
        };
    }

    /**
     * Get formatted credit balance info
     */
    getCreditInfo() {
        const secondsAvailable = this.creditBalance / 15; // 15 credits = 1 second
        const minutesAvailable = Math.floor(secondsAvailable / 60);
        
        return {
            credits: this.creditBalance,
            seconds: secondsAvailable,
            minutes: minutesAvailable,
            formatted: `${this.creditBalance} credits (~${minutesAvailable.toFixed(1)} min)`
        };
    }
}

// Make available globally
window.LicenseAPI = LicenseAPI; 