# Familia AI Frontend - Debugging & Development Guide

Complete guide for debugging and developing the Familia AI Frontend using Wrangler and browser tools.

## 🚀 Quick Start with Wrangler

### Local Development Setup

1. **Install Wrangler (if not already installed)**
   ```bash
   npm install -g @cloudflare/wrangler
   ```

2. **Navigate to frontend directory**
   ```bash
   cd frontend(not completly front)
   ```

3. **Start local development server**
   ```bash
   wrangler dev
   ```

4. **Access your application**
   - Frontend: `http://localhost:8787`
   - Backend API: `http://localhost:8787/api/*`

## 🔧 Development Commands

### Frontend Development
```bash
# Start Vite development server (recommended for frontend)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Install dependencies
npm install
```

### Wrangler Commands
```bash
# Start local development with Wrangler
wrangler dev

# Start with specific environment
wrangler dev --env development

# Preview deployment
wrangler preview

# Publish to Cloudflare
wrangler publish

# Check configuration
wrangler config
```

## 🐛 Browser Debugging

### Chrome DevTools Setup

1. **Open Developer Tools**
   - Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Opt+I` (Mac)

2. **Network Tab Configuration**
   - Enable "Preserve log"
   - Filter by "XHR" for API calls
   - Check "Disable cache" for development

3. **Console Tab**
   - View JavaScript errors and logs
   - Test API calls manually
   - Monitor state changes

### Debugging API Calls

#### 1. Check API Base URL
```javascript
// In browser console
console.log('API Base URL:', window.location.origin);
console.log('Full API URL:', window.location.origin + '/api/health');
```

#### 2. Test API Endpoints
```javascript
// Test health check
fetch('/api/health')
  .then(response => response.json())
  .then(data => console.log('Health check:', data))
  .catch(error => console.error('Health check failed:', error));

// Test login
fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
    familyCode: 'your-family-code'
  })
})
.then(response => response.json())
.then(data => console.log('Login response:', data))
.catch(error => console.error('Login failed:', error));
```

#### 3. Monitor WebSocket/EventSource
```javascript
// Check for real-time connections
console.log('EventSource connections:', window.EventSource ? 'Available' : 'Not available');
console.log('WebSocket connections:', window.WebSocket ? 'Available' : 'Not available');
```

## 🔍 Common Issues & Solutions

### 1. CORS Errors
```javascript
// Check CORS configuration
fetch('/api/health')
  .then(response => {
    console.log('CORS headers:', response.headers.get('Access-Control-Allow-Origin'));
    return response.json();
  });
```

**Solution**: Ensure backend has correct `ALLOWED_ORIGIN` configuration.

### 2. Environment Variables Not Loading
```javascript
// Check environment variables
console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
console.log('All env vars:', import.meta.env);
```

**Solution**: Verify `.env` file exists and has correct values.

### 3. Build Issues
```bash
# Check build output
npm run build
ls -la dist/

# Check for missing dependencies
npm list
npm outdated
```

**Solution**: Ensure all dependencies are installed and compatible.

### 4. API Connection Issues
```javascript
// Test backend connectivity
async function testBackend() {
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      console.log('✅ Backend is accessible');
    } else {
      console.log('❌ Backend returned error:', response.status);
    }
  } catch (error) {
    console.log('❌ Backend connection failed:', error.message);
  }
}

testBackend();
```

## 🛠️ Advanced Debugging

### 1. State Management Debugging
```javascript
// Add to your app.js for state debugging
window.addEventListener('storage', (e) => {
  console.log('Storage change:', e.key, e.newValue);
});

// Debug localStorage
console.log('User data:', localStorage.getItem('user_data'));
console.log('Token:', localStorage.getItem('familia_token'));
console.log('Device ID:', localStorage.getItem('device_id'));
```

### 2. Performance Monitoring
```javascript
// Monitor render performance
window.addEventListener('load', () => {
  const renderTime = performance.now();
  console.log('Page load time:', renderTime + 'ms');
});

// Monitor API response times
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const startTime = performance.now();
  return originalFetch.apply(this, args)
    .then(response => {
      const endTime = performance.now();
      console.log(`API call took: ${endTime - startTime}ms`);
      return response;
    });
};
```

### 3. Error Tracking
```javascript
// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Send to error tracking service
});

// Unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
```

## 📱 Mobile Debugging

### Remote Debugging
1. **Enable USB debugging** on Android device
2. **Connect device** to computer via USB
3. **Open Chrome** on computer
4. **Navigate to** `chrome://inspect`
5. **Select your device** and inspect pages

### Mobile-Specific Issues
```javascript
// Check mobile-specific features
console.log('User Agent:', navigator.userAgent);
console.log('Touch support:', 'ontouchstart' in window);
console.log('Screen size:', screen.width + 'x' + screen.height);
console.log('Viewport size:', window.innerWidth + 'x' + window.innerHeight);
```

## 🔒 Security Debugging

### Check Security Headers
```javascript
// Verify security headers
fetch('/api/health')
  .then(response => {
    const headers = response.headers;
    console.log('Security headers:');
    console.log('X-Frame-Options:', headers.get('X-Frame-Options'));
    console.log('X-Content-Type-Options:', headers.get('X-Content-Type-Options'));
    console.log('X-XSS-Protection:', headers.get('X-XSS-Protection'));
  });
```

### Token Security
```javascript
// Check token security
const token = localStorage.getItem('familia_token');
if (token) {
  console.log('Token exists:', token.length > 0);
  console.log('Token format:', token.substring(0, 20) + '...');
} else {
  console.log('No token found');
}
```

## 🚀 Production Debugging

### Source Maps
Ensure source maps are enabled in `vite.config.ts`:
```typescript
export default defineConfig({
  build: {
    sourcemap: true
  }
});
```

### Logging Levels
```javascript
// Add logging levels to your app
const log = {
  debug: (msg) => console.log('[DEBUG]', msg),
  info: (msg) => console.log('[INFO]', msg),
  warn: (msg) => console.warn('[WARN]', msg),
  error: (msg) => console.error('[ERROR]', msg)
};

// Use in your application
log.info('User logged in');
log.debug('API response:', response);
```

## 📊 Performance Optimization

### Bundle Analysis
```bash
# Analyze bundle size
npm run build -- --mode analyze
npx vite-bundle-analyzer dist
```

### Lighthouse Audit
1. Open Chrome DevTools
2. Go to "Lighthouse" tab
3. Run audit for performance, accessibility, SEO
4. Review recommendations

### Memory Usage
```javascript
// Monitor memory usage
if ('memory' in performance) {
  console.log('Memory usage:', performance.memory);
  console.log('Used JS heap size:', performance.memory.usedJSHeapSize);
  console.log('Total JS heap size:', performance.memory.totalJSHeapSize);
  console.log('JS heap size limit:', performance.memory.jsHeapSizeLimit);
}
```

## 🔄 Hot Reload Issues

### Vite Hot Reload
```javascript
// Check Vite HMR status
if (import.meta.hot) {
  console.log('✅ HMR is available');
  import.meta.hot.on('vite:beforeUpdate', (event) => {
    console.log('HMR update:', event);
  });
} else {
  console.log('❌ HMR is not available');
}
```

### Cache Issues
```bash
# Clear browser cache
# In Chrome: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# Clear Vite cache
rm -rf node_modules/.vite

# Clear npm cache
npm cache clean --force
```

## 🎯 Debugging Checklist

### Before Deployment
- [ ] All API endpoints working
- [ ] Authentication flow tested
- [ ] Chat functionality working
- [ ] Admin panel accessible
- [ ] Mobile responsiveness tested
- [ ] Performance optimized
- [ ] Security headers configured
- [ ] Error handling implemented

### During Development
- [ ] Console errors monitored
- [ ] Network requests tracked
- [ ] State changes logged
- [ ] Performance metrics checked
- [ ] Mobile compatibility tested

### After Deployment
- [ ] Production logs monitored
- [ ] User feedback collected
- [ ] Performance metrics reviewed
- [ ] Error rates monitored
- [ ] Security scans completed

## 🆘 Getting Help

### Documentation
- [Vite Documentation](https://vitejs.dev/)
- [Wrangler Documentation](https://developers.cloudflare.com/wrangler/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)

### Community Support
- [Cloudflare Community](https://community.cloudflare.com/)
- [Vite Discord](https://chat.vitejs.dev/)
- [GitHub Issues](https://github.com/your-repo/issues)

### Debugging Tools
- Chrome DevTools
- Firefox Developer Tools
- Safari Web Inspector
- VS Code Debugger

Happy debugging! 🐛🔍