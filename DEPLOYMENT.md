# Cloudflare Deployment Guide

## Environment Variables

The app uses different environment configurations:

- **Development**: `.env` (local development with localhost)
- **Production**: `.env.production` (Cloudflare deployment with cloud API)

### Production Configuration

The `.env.production` file is automatically used when building for production:

```bash
VITE_API_URL=https://carefam-lab-1e0cbe42a3ac.herokuapp.com
VITE_CLOUD_API_URL=https://carefam-lab-1e0cbe42a3ac.herokuapp.com
```

## Deployment Steps

### 1. Build Locally (Optional Test)

```bash
cd frontend
pnpm run build
```

This will use `.env.production` automatically.

### 2. Deploy to Cloudflare

```bash
npx wrangler deploy
```

Or if using Cloudflare Pages dashboard:
- Connect your GitHub repository
- Set build command: `pnpm install --frozen-lockfile && pnpm run build`
- Set build output directory: `dist`
- Set root directory: `frontend`

### 3. Environment Variables in Cloudflare Dashboard

If you need to override environment variables in Cloudflare:

1. Go to your Cloudflare Pages project
2. Navigate to Settings > Environment Variables
3. Add variables for Production:
   - `VITE_API_URL`: Your backend API URL
   - `VITE_CLOUD_API_URL`: Your cloud backup API URL

**Important**: After adding/changing environment variables, you must trigger a new build for them to take effect.

## Common Issues

### Issue: API calls fail with "Network Error"

**Cause**: Frontend is trying to connect to `localhost:3000` in production.

**Solution**: 
- Ensure `.env.production` exists with correct API URL
- Rebuild the app: `pnpm run build`
- Redeploy to Cloudflare

### Issue: Sound files not found (404 errors)

**Cause**: Sound service was looking for `.mp3` files but `.wav` files exist.

**Solution**: Already fixed in `soundService.ts` to use `.wav` files.

### Issue: "Cannot read properties of undefined (reading 'includes')"

**Cause**: Error handling code expects `error.message` but gets undefined.

**Solution**: Check error handling in login component to handle undefined error messages.

## Backend Requirements

Ensure your backend API:
1. Is deployed and accessible at the URL in `.env.production`
2. Has CORS configured to allow requests from your Cloudflare domain
3. Is running and healthy

## Verification

After deployment, check:
1. Browser console for any errors
2. Network tab to verify API calls go to correct URL
3. Test login functionality
4. Verify WebSocket connections (if applicable)
