// Import the API client
import api from './api.js';

// DOM Elements
const elements = {
  chatContainer: document.getElementById('chat-container'),
  messageInput: document.getElementById('message-input'),
  sendButton: document.getElementById('send-button'),
  chatHistory: document.getElementById('chat-history'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  chatSection: document.getElementById('chat-section'),
  adminPanel: document.getElementById('admin-panel'),
  userRole: document.getElementById('user-role'),
  userName: document.getElementById('user-name'),
  messageCount: document.getElementById('message-count'),
  chatList: document.getElementById('chat-list'),
  newChatButton: document.getElementById('new-chat-button'),
  logoutButton: document.getElementById('logout-button'),
  showRegister: document.getElementById('show-register'),
  showLogin: document.getElementById('show-login')
};

// State
let state = {
  user: null,
  currentChat: null,
  chats: [],
  isLoading: false
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Check if user is already logged in
  const userData = localStorage.getItem('user_data');
  if (userData) {
    state.user = JSON.parse(userData);
    setupUIForUser();
    await loadChats();
  } else {
    showLoginForm();
  }

  // Event Listeners
  elements.sendButton?.addEventListener('click', handleSendMessage);
  elements.messageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
  elements.newChatButton?.addEventListener('click', startNewChat);
  elements.logoutButton?.addEventListener('click', handleLogout);
  
  // Form switching
  elements.showRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
  
  elements.showLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
  
  // Form submissions
  elements.loginForm?.addEventListener('submit', handleLogin);
  elements.registerForm?.addEventListener('submit', handleRegister);
}

// UI Management
function showLoginForm() {
  elements.loginForm?.classList.remove('hidden');
  elements.registerForm?.classList.add('hidden');
  elements.chatSection?.classList.add('hidden');
  elements.adminPanel?.classList.add('hidden');
}

function showRegisterForm() {
  elements.loginForm?.classList.add('hidden');
  elements.registerForm?.classList.remove('hidden');
  elements.chatSection?.classList.add('hidden');
  elements.adminPanel?.classList.add('hidden');
}

function setupUIForUser() {
  elements.loginForm?.classList.add('hidden');
  elements.registerForm?.classList.add('hidden');
  elements.chatSection?.classList.remove('hidden');
  
  if (state.user) {
    elements.userName.textContent = state.user.name;
    elements.userRole.textContent = state.user.role;
    elements.messageCount.textContent = `${state.user.limits?.used_today || 0}/${state.user.limits?.daily_messages || 20}`;
    
    if (state.user.role === 'admin' || state.user.role === 'parent') {
      elements.adminPanel?.classList.remove('hidden');
      loadAdminData();
    }
  }
}

// Authentication
async function handleLogin(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const credentials = {
    email: formData.get('email'),
    password: formData.get('password'),
    familyCode: formData.get('family-code')
  };

  try {
    const result = await api.login(credentials);
    if (result.requires2FA) {
      show2FAForm(result.userId);
    } else {
      // Handle direct login
      state.user = result.user;
      localStorage.setItem('user_data', JSON.stringify(state.user));
      setupUIForUser();
      await loadChats();
    }
  } catch (error) {
    alert('Error de inicio de sesiÃ³n: ' + error.message);
  }
}

async function handle2FA(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const userId = formData.get('user-id');
  const code = formData.get('2fa-code');

  try {
    const result = await api.verify2FA(userId, code);
    state.user = result.user;
    localStorage.setItem('familia_token', result.token);
    localStorage.setItem('user_data', JSON.stringify(state.user));
    setupUIForUser();
    await loadChats();
  } catch (error) {
    alert('CÃ³digo 2FA incorrecto: ' + error.message);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const userData = {
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
    age: parseInt(formData.get('age')),
    parentEmail: formData.get('parent-email'),
    answers: {
      favorite_color: formData.get('favorite-color'),
      hobbies: formData.get('hobbies').split(',').map(h => h.trim())
    }
  };

  try {
    const result = await api.register(userData);
    alert(result.message);
    showLoginForm();
  } catch (error) {
    alert('Error de registro: ' + error.message);
  }
}

function show2FAForm(userId) {
  // Create 2FA form dynamically
  const form = document.createElement('form');
  form.innerHTML = `
    <h3>VerificaciÃ³n de 2 pasos</h3>
    <input type="hidden" name="user-id" value="${userId}">
    <input type="text" name="2fa-code" placeholder="CÃ³digo de verificaciÃ³n" required>
    <button type="submit">Verificar</button>
  `;
  form.addEventListener('submit', handle2FA);
  
  // Replace login form with 2FA form
  elements.loginForm.replaceWith(form);
}

// Chat Functionality
async function handleSendMessage() {
  const message = elements.messageInput.value.trim();
  if (!message || state.isLoading) return;

  state.isLoading = true;
  addMessageToUI(message, 'user');
  elements.messageInput.value = '';

  try {
    const result = await api.sendMessage(message, state.currentChat);
    addMessageToUI(result.response, 'ai');
    
    if (result.threadId && !state.currentChat) {
      state.currentChat = result.threadId;
      await loadChats();
    }
    
    // Update message count
    if (state.user) {
      state.user.limits.used_today = result.usedToday;
      elements.messageCount.textContent = `${result.usedToday}/${state.user.limits.daily_messages}`;
    }
  } catch (error) {
    addMessageToUI('Error: ' + error.message, 'error');
  } finally {
    state.isLoading = false;
  }
}

function addMessageToUI(message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = message;
  elements.chatHistory.appendChild(messageDiv);
  elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

async function loadChats() {
  try {
    const chats = await api.getChats();
    state.chats = chats;
    renderChatList();
  } catch (error) {
    console.error('Error loading chats:', error);
  }
}

function renderChatList() {
  elements.chatList.innerHTML = '';
  state.chats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.innerHTML = `
      <span>${chat.title}</span>
      <span class="chat-date">${new Date(chat.last_message_at).toLocaleString()}</span>
    `;
    chatItem.addEventListener('click', () => selectChat(chat.id));
    elements.chatList.appendChild(chatItem);
  });
}

async function selectChat(chatId) {
  state.currentChat = chatId;
  elements.chatHistory.innerHTML = '';
  
  try {
    const messages = await api.getChatMessages(chatId);
    messages.forEach(msg => {
      addMessageToUI(msg.content, msg.role === 'user' ? 'user' : 'ai');
    });
  } catch (error) {
    console.error('Error loading chat messages:', error);
  }
}

function startNewChat() {
  state.currentChat = null;
  elements.chatHistory.innerHTML = '';
}

// Admin Functionality
async function loadAdminData() {
  try {
    const [users, stats] = await Promise.all([
      api.getUsers(),
      api.getStats()
    ]);
    
    renderUserList(users);
    renderStats(stats);
  } catch (error) {
    console.error('Error loading admin data:', error);
  }
}

function renderUserList(users) {
  const userList = document.getElementById('user-list');
  userList.innerHTML = '';
  
  users.forEach(user => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.innerHTML = `
      <span>${user.name} (${user.email})</span>
      <select data-user-id="${user.id}">
        <option value="child" ${user.role === 'child' ? 'selected' : ''}>Child</option>
        <option value="parent" ${user.role === 'parent' ? 'selected' : ''}>Parent</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
      <button onclick="updateUserRole('${user.id}')">Actualizar</button>
    `;
    userList.appendChild(userItem);
  });
}

function renderStats(stats) {
  const statsContainer = document.getElementById('stats-container');
  statsContainer.innerHTML = `
    <div class="stat-item">
      <span>Usuarios Activos Hoy:</span>
      <span>${stats.active_users}</span>
    </div>
    <div class="stat-item">
      <span>Mensajes Hoy:</span>
      <span>${stats.messages_today}</span>
    </div>
    <div class="stat-item">
      <span>RPM:</span>
      <span>${stats.rpm}</span>
    </div>
    <div class="stat-item">
      <span>Total Usuarios:</span>
      <span>${stats.total_users}</span>
    </div>
  `;
}

async function updateUserRole(userId) {
  const select = document.querySelector(`select[data-user-id="${userId}"]`);
  const role = select.value;
  
  try {
    await api.updateUserRole(userId, role);
    alert('Rol actualizado exitosamente');
    loadAdminData();
  } catch (error) {
    alert('Error al actualizar rol: ' + error.message);
  }
}

// Profile Management
async function loadProfile() {
  try {
    const profile = await api.getProfile();
    state.user = profile;
    localStorage.setItem('user_data', JSON.stringify(profile));
    setupUIForUser();
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Logout
function handleLogout() {
  api.logout();
  state.user = null;
  state.currentChat = null;
  state.chats = [];
  elements.chatHistory.innerHTML = '';
  showLoginForm();
}

// Global function for admin actions
window.updateUserRole = updateUserRole;