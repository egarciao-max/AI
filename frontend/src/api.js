// API client for Familia AI Backend
class FamiliaAIAPI {
  constructor() {
    this.baseURL = 'https://family-ai-backend.enriquegarciaoropeza.workers.dev';
    this.token = localStorage.getItem('familia_token');
    this.deviceId = localStorage.getItem('device_id') || this.generateDeviceId();
    this.deviceName = localStorage.getItem('device_name') || this.getDeviceName();
    
    // Save device info
    localStorage.setItem('device_id', this.deviceId);
    localStorage.setItem('device_name', this.deviceName);
  }

  generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9);
  }

  getDeviceName() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop Browser';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-ID': this.deviceId,
      'X-Device-Name': this.deviceName,
      ...options.headers
    };

    if (this.token) {
      headers['X-Family-Token'] = this.token;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw new Error(`Failed to connect to server: ${error.message}`);
    }
  }

  // Authentication endpoints
  async register(userData) {
    return this.request('/api/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async login(credentials) {
    return this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async verify2FA(userId, code) {
    return this.request('/api/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ userId, code })
    });
  }

  // Chat endpoints
  async sendMessage(message, threadId = null) {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, threadId })
    });
  }

  async getChats() {
    return this.request('/api/chats');
  }

  async getChatMessages(threadId) {
    return this.request(`/api/chats/${threadId}/messages`);
  }

  async deleteChat(threadId) {
    return this.request(`/api/chats/${threadId}`, {
      method: 'DELETE'
    });
  }

  // Profile endpoints
  async getProfile() {
    return this.request('/api/profile');
  }

  async updateProfile(updates) {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async updateSettings(settings) {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // Admin endpoints
  async getUsers() {
    return this.request('/api/admin/users');
  }

  async updateUserRole(userId, role) {
    return this.request(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  async getStats() {
    return this.request('/api/admin/stats');
  }

  async getDashboard() {
    return this.request('/api/admin/dashboard');
  }

  // Logout
  logout() {
    this.token = null;
    localStorage.removeItem('familia_token');
    localStorage.removeItem('user_data');
  }
}

export default new FamiliaAIAPI();