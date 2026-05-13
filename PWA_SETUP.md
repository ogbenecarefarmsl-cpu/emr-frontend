# PWA Setup Guide

## Overview

HARBOUR Diagnostics LIS is configured as a Progressive Web App (PWA) with offline-first capabilities, enabling it to work reliably even with poor network connectivity.

## Features

### Core PWA Features
- ✅ Installable on desktop and mobile devices
- ✅ Offline functionality with service worker
- ✅ Background sync for pending operations
- ✅ Push notifications support
- ✅ App-like experience (no browser chrome)
- ✅ Fast loading with aggressive caching

### Offline-First Architecture
- ✅ IndexedDB for local data storage (Dexie)
- ✅ Automatic sync when connection restored
- ✅ Queue system for pending operations
- ✅ Conflict resolution for concurrent edits
- ✅ Visual indicators for offline status

## Installation

### Prerequisites
```bash
cd frontend
pnpm install vite-plugin-pwa workbox-window
```

### Generate Icons
```bash
# Install ImageMagick first
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick
# Windows: Download from https://imagemagick.org

# Generate all required icons
chmod +x scripts/generate-icons.sh
./scripts/generate-icons.sh
```

This creates:
- `icon-192.png` - Standard PWA icon
- `icon-512.png` - High-res PWA icon
- `apple-touch-icon.png` - iOS home screen icon
- `favicon.ico` - Browser favicon
- Maskable variants for adaptive icons

## Configuration

### Vite Config (`vite.config.ts`)

PWA plugin is configured with:
- Auto-update registration
- Workbox service worker
- Runtime caching strategies
- Asset precaching

### Manifest (`manifest.json`)

Generated automatically with:
- App name and description
- Theme colors
- Display mode (standalone)
- Icon definitions
- Start URL and scope

## Caching Strategies

### Cache-First (Static Assets)
- Images (png, jpg, svg, webp)
- Audio files (mp3, wav)
- Fonts (woff, woff2)
- **Use case**: Assets that rarely change

### Network-First (API Calls)
- All `/api/*` endpoints
- 10-second network timeout
- Falls back to cache if offline
- **Use case**: Dynamic data that should be fresh

### Cache-First (External Resources)
- Google Fonts
- CDN resources
- **Use case**: Third-party assets

## Offline Data Management

### IndexedDB Schema

```typescript
// Dexie database definition
const db = new Dexie('HarbourLIS');

db.version(1).stores({
  patients: '++id, patientId, firstName, lastName, phone',
  orders: '++id, orderNumber, patientId, status, createdAt',
  tests: '++id, code, name, category',
  results: '++id, orderId, testCode, value',
  pendingSync: '++id, operation, entity, data, timestamp'
});
```

### Sync Queue

Operations are queued when offline:
```typescript
interface PendingOperation {
  id?: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'order' | 'patient' | 'result' | 'payment';
  data: any;
  timestamp: number;
  retryCount: number;
}
```

### Sync Process

1. **Detect Connection**: Listen for `online` event
2. **Process Queue**: Execute pending operations in order
3. **Handle Conflicts**: Use timestamp-based resolution
4. **Update UI**: Reflect synced changes
5. **Clear Queue**: Remove successful operations

## Usage

### Install PWA

**Desktop (Chrome/Edge)**:
1. Visit the app URL
2. Click install icon in address bar
3. Or: Menu → Install HARBOUR LIS

**Mobile (Android)**:
1. Visit the app URL
2. Tap "Add to Home Screen"
3. Confirm installation

**Mobile (iOS)**:
1. Visit the app URL in Safari
2. Tap Share button
3. Select "Add to Home Screen"

### Offline Mode

The app automatically:
- Detects network status
- Shows offline indicator
- Queues operations
- Syncs when online

Users can:
- View cached data
- Create new orders (queued)
- Enter results (queued)
- Search patients (local)

### Update Handling

Service worker auto-updates:
1. New version detected
2. Download in background
3. Prompt user to reload
4. Apply updates on reload

## Development

### Testing Offline

**Chrome DevTools**:
1. Open DevTools (F12)
2. Network tab
3. Select "Offline" from throttling dropdown

**Service Worker**:
1. Application tab
2. Service Workers section
3. Check "Offline" checkbox

### Debugging

**View Cache**:
```javascript
// In browser console
caches.keys().then(console.log);
caches.open('api-cache').then(cache => 
  cache.keys().then(console.log)
);
```

**View IndexedDB**:
1. DevTools → Application tab
2. IndexedDB → HarbourLIS
3. Inspect tables

**Service Worker Logs**:
1. DevTools → Application tab
2. Service Workers section
3. Click "inspect" link

### Clear All Data

```javascript
// Clear caches
caches.keys().then(keys => 
  Promise.all(keys.map(key => caches.delete(key)))
);

// Clear IndexedDB
indexedDB.deleteDatabase('HarbourLIS');

// Clear localStorage
localStorage.clear();
```

## Build & Deploy

### Production Build

```bash
cd frontend
pnpm run build
```

Generates:
- Optimized bundles
- Service worker (`sw.js`)
- Manifest file
- Precache manifest

### Deployment

1. **Upload to Server**:
   ```bash
   scp -r dist/* user@server:/var/www/harbour-lis/
   ```

2. **Configure HTTPS**:
   - PWA requires HTTPS (except localhost)
   - Use Let's Encrypt or similar

3. **Set Headers**:
   ```nginx
   # nginx example
   location /sw.js {
     add_header Cache-Control "no-cache";
     add_header Service-Worker-Allowed "/";
   }
   ```

## Troubleshooting

### Service Worker Not Registering

**Check**:
- HTTPS enabled (or localhost)
- No console errors
- Browser supports service workers

**Fix**:
```javascript
// Unregister old service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
```

### Cache Not Updating

**Check**:
- Service worker updated
- Cache version incremented
- Network tab shows 200 (not 304)

**Fix**:
- Hard refresh (Ctrl+Shift+R)
- Clear site data in DevTools
- Update service worker manually

### Offline Sync Failing

**Check**:
- IndexedDB not full
- Pending operations valid
- Network restored
- API endpoints accessible

**Fix**:
- Check browser console
- Inspect pending sync queue
- Verify API responses
- Clear and re-sync

### Icons Not Showing

**Check**:
- Icons exist in `/public`
- Correct sizes (192x192, 512x512)
- Manifest references correct paths
- PNG format

**Fix**:
- Regenerate icons with script
- Check manifest.json
- Clear cache and reinstall

## Performance Optimization

### Reduce Bundle Size
- Code splitting enabled
- Tree shaking configured
- Vendor chunks separated
- Lazy loading for routes

### Optimize Caching
- Precache critical assets only
- Use appropriate cache strategies
- Set reasonable expiration times
- Limit cache sizes

### Improve Load Time
- Compress assets (gzip/brotli)
- Use CDN for static files
- Enable HTTP/2
- Minimize render-blocking resources

## Security Considerations

### Service Worker Scope
- Limited to app origin
- Cannot access other domains
- Respects CORS policies

### Data Storage
- IndexedDB encrypted at rest
- No sensitive data in cache
- Clear data on logout
- Implement data retention policies

### Updates
- Auto-update service worker
- Verify integrity of cached assets
- Use subresource integrity (SRI)
- Monitor for security patches

## Browser Support

### Full Support
- Chrome 90+ (Desktop & Android)
- Edge 90+
- Firefox 88+
- Safari 15+ (limited)

### Partial Support
- Safari 14 (no background sync)
- Samsung Internet 14+
- Opera 76+

### Not Supported
- Internet Explorer (any version)
- Legacy browsers

## Monitoring

### Metrics to Track
- Install rate
- Offline usage
- Sync success rate
- Cache hit ratio
- Service worker errors

### Tools
- Google Analytics (with offline support)
- Sentry for error tracking
- Custom logging to IndexedDB
- Performance API

## Future Enhancements

- [ ] Background sync for large files
- [ ] Periodic background sync
- [ ] Web Share API integration
- [ ] Badging API for notifications
- [ ] File System Access API
- [ ] Web Bluetooth for printers
- [ ] Geolocation for sample tracking
- [ ] Camera API for document scanning

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Workbox Guide](https://developers.google.com/web/tools/workbox)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Dexie.js Documentation](https://dexie.org/)
