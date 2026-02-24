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

  // Mock data for demonstration when backend is not available
  getMockUser() {
    return {
      id: 'demo-user-1',
      name: 'Usuario Demo',
      email: 'demo@familia.ai',
      role: 'parent',
      limits: {
        daily_messages: 20,
        used_today: 5,
        total_messages: 50
      }
    };
  }

  getMockChats() {
    return [
      {
        id: 'chat-1',
        title: 'Conversación de prueba',
        last_message_at: new Date().toISOString(),
        message_count: 3
      },
      {
        id: 'chat-2', 
        title: 'Preguntas sobre IA',
        last_message_at: new Date(Date.now() - 86400000).toISOString(),
        message_count: 8
      }
    ];
  }

  getMockMessages() {
    return [
      { role: 'user', content: 'Hola, ¿cómo estás?', created_at: new Date().toISOString() },
      { role: 'assistant', content: '¡Hola! Estoy muy bien, gracias por preguntar. ¿En qué puedo ayudarte hoy?', created_at: new Date().toISOString() },
      { role: 'user', content: '¿Puedes explicarme cómo funciona la inteligencia artificial?', created_at: new Date().toISOString() },
      { role: 'assistant', content: 'La inteligencia artificial es un campo de la informática que busca crear sistemas capaces de realizar tareas que normalmente requerirían inteligencia humana. Esto incluye el aprendizaje automático, el procesamiento del lenguaje natural y la visión por computadora.', created_at: new Date().toISOString() }
    ];
  }

  // Check if backend is available
  async isBackendAvailable() {
    try {
      const response = await fetch(`${this.baseURL}/api/health`, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
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
    // Check if backend is available
    const backendAvailable = await this.isBackendAvailable();
    
    if (!backendAvailable) {
      return [
        {
          id: 'user-1',
          name: 'Juan Pérez',
          email: 'juan@familia.ai',
          role: 'parent',
          created_at: new Date().toISOString()
        },
        {
          id: 'user-2',
          name: 'María García',
          email: 'maria@familia.ai',
          role: 'child',
          created_at: new Date().toISOString()
        }
      ];
    }

    return this.request('/api/admin/users');
  }

  async updateUserRole(userId, role) {
    // Check if backend is available
    const backendAvailable = await this.isBackendAvailable();
    
    if (!backendAvailable) {
      return { success: true };
    }

    return this.request(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  async getStats() {
    // Check if backend is available
    const backendAvailable = await this.isBackendAvailable();
    
    if (!backendAvailable) {
      return {
        active_users: 5,
        messages_today: 23,
        rpm: 15.5,
        total_users: 12
      };
    }

    return this.request('/api/admin/stats');
  }

  async getDashboard() {
    // Check if backend is available
    const backendAvailable = await this.isBackendAvailable();
    
    if (!backendAvailable) {
      return {
        metrics: {
          total_users: 12,
          active_today: 5,
          total_messages: 156,
          avg_response_time: 2.3
        }
      };
    }

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