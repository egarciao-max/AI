# Cloudflare Deployment Guide

Complete guide for deploying Familia AI Frontend via Cloudflare Pages (browser-based deployment).

## 🚀 Quick Deployment via Browser

### Option 1: One-Click Deploy to Cloudflare Pages

[![Deploy to Cloudflare Pages](https://www.cloudflare.com/media/pages/products/serverless/pages/deploy-to-cloudflare-pages/button.svg)](https://pages.cloudflare.com/deploy)

Click the button above to deploy directly to Cloudflare Pages via your browser!

### Option 2: Manual Browser Deployment

1. **Go to Cloudflare Pages Dashboard**
   - Visit: https://pages.cloudflare.com/
   - Sign in with your Cloudflare account

2. **Connect Your Repository**
   - Click "Create a new project"
   - Select your Git provider (GitHub, GitLab, etc.)
   - Choose your Familia AI Frontend repository
   - Click "Begin setup"

3. **Configure Build Settings**
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Environment variables**: Add the variables below

4. **Set Environment Variables**
   Add these environment variables in the Cloudflare Pages dashboard:

   | Variable Name | Value | Description |
   |---------------|-------|-------------|
   | `VITE_API_BASE_URL` | `https://your-familia-ai-backend.workers.dev` | Your Familia AI Backend URL |
   | `VITE_ENABLE_ADMIN_PANEL` | `true` | Enable admin functionality |
   | `VITE_ENABLE_REGISTRATION` | `true` | Enable user registration |
   | `VITE_MAX_MESSAGE_LENGTH` | `1000` | Maximum message length |
   | `VITE_AUTO_SCROLL` | `true` | Enable auto-scroll in chat |

5. **Deploy**
   - Click "Save and Deploy"
   - Wait for the build to complete (2-5 minutes)
   - Your site will be live at `https://your-project.pages.dev`

## 🔧 Environment Variables Setup

### Required Variables

#### 1. Backend Connection
```bash
VITE_API_BASE_URL=https://your-familia-ai-backend.workers.dev
```
Replace with your actual Familia AI Backend URL.

#### 2. Feature Flags
```bash
VITE_ENABLE_ADMIN_PANEL=true
VITE_ENABLE_REGISTRATION=true
VITE_MAX_MESSAGE_LENGTH=1000
VITE_AUTO_SCROLL=true
```

### Optional Variables

#### 3. Advanced Configuration
```bash
VITE_DEBUG_MODE=false
VITE_MAINTENANCE_MODE=false
VITE_THEME=light
VITE_LANGUAGE=en
```

## 🌐 Custom Domain Setup

### Add Custom Domain
1. In Cloudflare Pages dashboard, go to your project
2. Click "Custom domains"
3. Add your domain (e.g., `ai.yourfamily.com`)
4. Follow the DNS setup instructions
5. Wait for SSL certificate (usually 15 minutes)

### DNS Configuration
Add these DNS records to your domain registrar:

```
CNAME   ai    your-project.pages.dev
```

## 🔒 Security Configuration

### CORS Setup
Ensure your Familia AI Backend has the correct CORS configuration:

```env
ALLOWED_ORIGIN=https://your-project.pages.dev
```

### Security Headers
Cloudflare Pages automatically adds security headers, but you can customize them:

```json
{
  "headers": {
    "/*": [
      {
        "key": "X-Frame-Options",
        "value": "DENY"
      },
      {
        "key": "X-Content-Type-Options",
        "value": "nosniff"
      },
      {
        "key": "X-XSS-Protection",
        "value": "1; mode=block"
      }
    ]
  }
}
```

## 📊 Monitoring & Analytics

### Cloudflare Analytics
1. Go to Cloudflare Dashboard
2. Select your domain
3. Enable "Analytics" in the sidebar
4. View traffic, performance, and security metrics

### Custom Analytics
Add Google Analytics or other tracking:

```html
<!-- Add to index.html head section -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 🔄 Continuous Deployment

### Automatic Deployments
- Every push to `main` or `master` branch triggers automatic deployment
- Preview deployments for pull requests
- Rollback to previous versions if needed

### Build Configuration
The `cloudflare-pages-config.json` file contains:
- Build commands
- Environment variables
- Deployment triggers
- Function routes

## 🐛 Troubleshooting

### Common Issues

#### 1. Build Failures
```
Error: Cannot find module 'vite'
```
**Solution**: Ensure `package.json` has correct dependencies

#### 2. Environment Variables Not Loading
```
Error: VITE_API_BASE_URL is undefined
```
**Solution**: Check Cloudflare Pages environment variables configuration

#### 3. CORS Errors
```
Access to fetch at 'https://backend.workers.dev' from origin 'https://your-project.pages.dev' has been blocked by CORS policy
```
**Solution**: Configure `ALLOWED_ORIGIN` in backend environment variables

#### 4. 404 Errors
```
The requested page could not be found
```
**Solution**: Check `vite.config.ts` base path and routing

### Debug Steps

1. **Check Build Logs**
   - Go to Cloudflare Pages dashboard
   - Select your project
   - View recent deployments
   - Check build logs for errors

2. **Test Environment Variables**
   - Add debug logging to your app
   - Verify variables are loaded correctly

3. **Network Inspection**
   - Open browser developer tools
   - Check Network tab for failed requests
   - Verify API endpoints are accessible

## 🚀 Performance Optimization

### Build Optimization
- Enable compression in `vite.config.ts`
- Optimize images and assets
- Use code splitting for large bundles

### Caching Strategy
- Cloudflare Pages provides automatic caching
- Configure cache headers for static assets
- Use Cloudflare CDN for global performance

### Monitoring Performance
- Use Cloudflare Analytics
- Monitor Core Web Vitals
- Set up performance alerts

## 📱 Mobile Optimization

### PWA Configuration
Add to `index.html`:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#007bff">
```

### Mobile-Specific Settings
- Touch-friendly interface
- Responsive design testing
- Mobile performance optimization

## 🔧 Advanced Configuration

### Custom Functions
Add serverless functions in `functions/` directory:
```javascript
// functions/api.js
export async function onRequest(context) {
  // Custom API logic
}
```

### Edge Configuration
Use `wrangler.toml` for advanced edge settings:
```toml
[env.production]
route = "your-project.pages.dev/*"
```

## 📞 Support

### Cloudflare Support
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Status](https://www.cloudflarestatus.com/)

### Familia AI Support
- Check this repository's Issues section
- Review the main README for troubleshooting
- Contact the development team

## ✅ Deployment Checklist

- [ ] Repository connected to Cloudflare Pages
- [ ] Build settings configured correctly
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] CORS configured in backend
- [ ] Test deployment successful
- [ ] Performance monitoring enabled
- [ ] Backup strategy in place

Your Familia AI Frontend is now ready for browser-based deployment via Cloudflare Pages! 🎉