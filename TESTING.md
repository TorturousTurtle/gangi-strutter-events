# Testing Guide for Phase 6A

Quick guide to test all Phase 6A components and features.

---

## 🚀 Quick Start

### 1. Start Local Server

```bash
cd web
php -S localhost:8000
```

### 2. Open Test Page

Navigate to: **http://localhost:8000/test-design-system.html**

This comprehensive test page includes:
- ✅ Automated validation tests
- ✅ Interactive component demos
- ✅ Live color palette
- ✅ All 16 CSS components
- ✅ All 5 JS components

---

## 🧪 Component Testing

### Toast Notifications

```javascript
// In browser console or test page
Toast.success('Test successful!');
Toast.error('Test error');
Toast.warning('Test warning');
Toast.info('Test info');

const loadingId = Toast.loading('Processing...');
// Later:
Toast.dismiss(loadingId);
```

### Modal Dialogs

```javascript
// Basic modal
const modal = new Modal({
  title: 'Test Modal',
  content: 'This is a test',
  size: 'md',
});
modal.open();

// Confirm dialog
const result = await Modal.confirm({
  title: 'Confirm',
  message: 'Are you sure?',
});
console.log(result); // true or false

// Alert dialog
await Modal.alert({
  title: 'Alert',
  message: 'This is an alert',
});
```

### Dropdown Menus

```html
<div class="dropdown" data-dropdown>
  <button class="btn btn-primary" data-dropdown-trigger>
    Menu
  </button>
  <div class="dropdown-menu" data-dropdown-menu>
    <button class="dropdown-item" data-dropdown-item>Item 1</button>
    <button class="dropdown-item" data-dropdown-item>Item 2</button>
  </div>
</div>
```

Auto-initializes on page load. Test by clicking button.

### File Upload

```javascript
const uploader = new FileUpload({
  container: document.getElementById('upload-container'),
  endpoint: '/api/upload/image.php',
  onSuccess: (response) => console.log('Uploaded:', response.url),
  onError: (error) => console.error('Error:', error),
});

// Upload happens automatically when file is selected
```

Test by:
1. Dragging an image file to the upload area
2. Or clicking "Choose File" button

### Skeleton Loaders

```javascript
const container = document.getElementById('content');

// Show skeleton
SkeletonLoader.table(container, { rows: 5, columns: 6 });

// Load data...
await loadData();

// Hide skeleton and show data
SkeletonLoader.hide(container);
container.innerHTML = renderData();
```

Test on test page by clicking skeleton type buttons.

---

## 🎨 Design Tokens Testing

### In Browser Console

```javascript
// Get computed value of a CSS variable
const primaryColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--brand-primary');
console.log(primaryColor); // Should output a color value

// Get spacing value
const spacing = getComputedStyle(document.documentElement)
  .getPropertyValue('--space-4');
console.log(spacing); // Should output "1rem"
```

### Visual Testing

Test page displays all:
- Brand colors (primary, secondary)
- Semantic colors (success, warning, error, info)
- Neutral palette (50-950)
- Button variants and sizes
- Badge variants and sizes
- Card layouts
- Form inputs
- Alerts

---

## 🔧 Admin Branding Testing

### 1. Access Admin Settings

```
http://localhost:8000/admin/
```

Login with admin credentials.

### 2. Navigate to Settings Tab

Click the "Settings" tab (7th tab in admin interface).

### 3. Test Branding Controls

**Organization Settings:**
- Change organization name
- Update tagline
- See live preview update

**Color Settings:**
- Click color picker for primary color
- Select a new color
- See preview buttons update
- Try preset color schemes

**Logo Settings:**
- Enter a logo URL, or
- Use file upload (once integrated)

**Save Changes:**
- Click "Save Changes"
- Refresh any page to see new branding applied

### 4. Verify Branding Application

Check that branding appears on:
- Header (organization name, colors)
- Buttons (primary/secondary colors)
- Page title
- All pages load branding automatically

---

## 🔍 Backend API Testing

### Upload Endpoint Test

```bash
# Create a test image
curl -X POST http://localhost:8000/api/upload/image.php \
  -F "file=@/path/to/test-image.jpg" \
  -H "Authorization: Basic base64(admin:password)"
```

Expected response:
```json
{
  "ok": true,
  "url": "/assets/uploads/brand-abc123.jpg",
  "filename": "brand-abc123.jpg"
}
```

### Branding Config Test

```bash
curl http://localhost:8000/api/branding/config.php
```

Expected response:
```json
{
  "ok": true,
  "branding": {
    "organizationName": "GKP Events",
    "tagline": "...",
    "primaryColor": "#6366f1",
    ...
  },
  "css": ":root { --brand-primary: #6366f1; ... }"
}
```

---

## ✅ Validation Checklist

Use this checklist when testing:

### Design Tokens
- [ ] CSS custom properties loaded
- [ ] 115+ variables available
- [ ] Brand colors work
- [ ] Semantic colors work
- [ ] Typography scale works
- [ ] Spacing scale works

### CSS Components
- [ ] Buttons render correctly (5 variants)
- [ ] Badges render correctly (7 variants)
- [ ] Cards render correctly
- [ ] Inputs render correctly
- [ ] Forms render correctly
- [ ] Alerts render correctly
- [ ] Tables render correctly
- [ ] Modals render correctly (CSS)
- [ ] Dropdowns render correctly (CSS)
- [ ] All other components render

### JS Components
- [ ] Toast shows/dismisses
- [ ] Modal opens/closes
- [ ] Modal has focus trap
- [ ] Modal closes on ESC
- [ ] Dropdown opens/closes
- [ ] Dropdown keyboard nav works
- [ ] FileUpload accepts files
- [ ] FileUpload shows preview
- [ ] FileUpload uploads successfully
- [ ] SkeletonLoader shows/hides

### Branding System
- [ ] BrandingLoader fetches config
- [ ] BrandingLoader applies CSS
- [ ] BrandingLoader caches (5 min)
- [ ] Branding.js provides config access
- [ ] Admin branding UI works
- [ ] Color picker updates preview
- [ ] Changes persist after save
- [ ] All pages load branding

### Documentation
- [ ] DESIGN_SYSTEM.md is complete
- [ ] All components documented
- [ ] Code examples work
- [ ] Tables are accurate

---

## 🐛 Troubleshooting

### Issue: Toast not showing
**Solution**: Check browser console for errors. Verify Toast.js is loaded.
```javascript
console.log(typeof Toast); // Should output "object"
```

### Issue: Modal not closing
**Solution**: Check if ESC key is enabled and click-outside is enabled in options.
```javascript
new Modal({
  closeOnEscape: true,
  closeOnBackdrop: true,
});
```

### Issue: Colors not loading
**Solution**: Check that design-tokens.css is loaded before other CSS.
```html
<link rel="stylesheet" href="/assets/css/design-tokens.css" />
<link rel="stylesheet" href="/assets/css/theme.css" />
<link rel="stylesheet" href="/assets/css/components.css" />
```

### Issue: Branding not applying
**Solution**: Check BrandingLoader.js is loaded and API is accessible.
```javascript
console.log(window.GKPBranding); // Should be defined
await window.GKPBranding.refresh(); // Force refresh
```

### Issue: File upload fails
**Solution**:
1. Check upload directory exists: `web/assets/uploads/`
2. Check directory permissions: `chmod 755 web/assets/uploads/`
3. Check PHP upload settings in php.ini
4. Check server logs for errors

---

## 📊 Performance Testing

### CSS Load Time
- Design tokens: ~16KB
- Theme CSS: ~6KB
- Components CSS: ~19KB
- **Total CSS: ~41KB** (excellent)

### JS Load Time
- Toast.js: ~10KB
- Modal.js: ~14KB
- Dropdown.js: ~12KB
- FileUpload.js: ~15KB
- SkeletonLoader.js: ~8KB
- **Total JS: ~59KB** (good)

### Branding Load
- API response: < 100ms (with caching)
- CSS injection: < 10ms
- **Total branding load: < 110ms** (excellent)

---

## 🎯 Success Criteria

Phase 6A is considered tested and validated when:

- ✅ All automated tests pass (12/12)
- ✅ All interactive demos work on test page
- ✅ All CSS components render correctly
- ✅ All JS components function correctly
- ✅ Admin branding UI works
- ✅ Branding applies across all pages
- ✅ No console errors
- ✅ No syntax errors
- ✅ Documentation is accurate

---

## 📝 Test Report

After testing, document results in `TEST_RESULTS.md` with:
- Test date
- Pass/fail counts
- Issues found
- Screenshots (optional)
- Performance metrics

---

*Happy Testing! 🧪*
