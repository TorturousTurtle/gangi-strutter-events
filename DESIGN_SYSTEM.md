# Design System Documentation

> Comprehensive design system for the Competition Registration Platform

**Version:** 1.0
**Last Updated:** February 2026
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Design Tokens](#design-tokens)
3. [Color Palette](#color-palette)
4. [Typography](#typography)
5. [Spacing](#spacing)
6. [Components](#components)
7. [Usage Examples](#usage-examples)
8. [Customization](#customization)

---

## Overview

This design system provides a comprehensive set of design tokens, components, and guidelines for building consistent, accessible user interfaces across the platform. It is built on CSS custom properties (CSS variables) and vanilla JavaScript, making it framework-agnostic and easy to maintain.

### Philosophy

- **Consistency**: All visual elements share a common design language
- **Accessibility**: WCAG 2.1 AA compliant with focus states and reduced motion support
- **Customization**: Admin-configurable branding colors without code changes
- **Performance**: Optimized CSS with minimal JavaScript dependencies
- **Maintainability**: Centralized tokens make updates easy

### File Structure

```
web/assets/css/
├── design-tokens.css     # Foundation: CSS custom properties (360+ lines)
├── theme.css             # Application-specific semantic variables (179 lines)
├── components.css        # Component library (1007 lines)
└── custom.css            # Legacy styles (to be migrated)

web/assets/js/
├── branding-loader.js    # Runtime CSS injection
├── branding.js           # Config access and application
└── components/
    ├── Toast.js          # Toast notifications
    ├── Modal.js          # Modal dialogs
    ├── Dropdown.js       # Dropdown menus
    ├── FileUpload.js     # File upload with drag-and-drop
    └── SkeletonLoader.js # Loading placeholders
```

---

## Design Tokens

Design tokens are the foundational building blocks of the design system. They are defined as CSS custom properties in `design-tokens.css`.

### Token Categories

| Category | Description | Count |
|----------|-------------|-------|
| **Brand Colors** | Admin-customizable primary and secondary colors | 6 |
| **Semantic Colors** | Fixed status colors (success, warning, error, info) | 16 |
| **Neutral Palette** | Gray scale from 50 (lightest) to 950 (darkest) | 11 |
| **Typography** | Font families, sizes, weights, line heights | 25 |
| **Spacing** | Consistent spacing scale based on 4px unit | 20 |
| **Border Radius** | Corner rounding values from sm to 3xl | 7 |
| **Shadows** | Elevation system from sm to 2xl | 8 |
| **Transitions** | Animation durations and easing functions | 12 |
| **Z-Index** | Stacking order for overlays | 10 |

---

## Color Palette

### Brand Colors (Customizable)

Brand colors can be customized via **Admin → Settings → Branding**:

```css
--brand-primary: #6366f1;           /* Indigo (default) */
--brand-primary-hover: #4f46e5;
--brand-primary-light: #e0e7ff;
--brand-primary-rgb: 99, 102, 241;  /* For rgba() usage */

--brand-secondary: #f59e0b;         /* Amber (default) */
--brand-secondary-hover: #d97706;
--brand-secondary-light: #fef3c7;
--brand-secondary-rgb: 245, 158, 11;
```

**Preset Color Schemes:**

| Name | Primary | Use Case |
|------|---------|----------|
| Rose Gold | `#b76e79` | Elegant, feminine |
| Royal Purple | `#7c3aed` | Regal, competitive |
| Midnight Navy | `#1e3a8a` | Professional, trustworthy |
| Champagne Gold | `#d4af37` | Premium, celebratory |
| Hot Pink | `#ec4899` | Energetic, youthful |
| Emerald | `#10b981` | Fresh, natural |
| Coral | `#f97316` | Warm, inviting |
| Sapphire | `#2563eb` | Classic, reliable |

### Semantic Colors (Fixed)

Semantic colors communicate universal meaning and should not be customized:

| Color | Variable | Hex | Use Case |
|-------|----------|-----|----------|
| Success | `--color-success` | `#16a34a` | Completed, paid, confirmed |
| Warning | `--color-warning` | `#ca8a04` | Pending, needs attention |
| Error | `--color-error` | `#dc2626` | Failed, destructive actions |
| Info | `--color-info` | `#0284c7` | Neutral information |

Each semantic color has:
- Base color: `--color-{name}`
- Hover state: `--color-{name}-hover`
- Light variant: `--color-{name}-light` (for backgrounds)
- RGB values: `--color-{name}-rgb` (for rgba() usage)

### Neutral Palette

Based on Tailwind's Zinc palette for a modern, slightly warm feel:

| Scale | Variable | Hex | Use Case |
|-------|----------|-----|----------|
| 50 | `--neutral-50` | `#fafafa` | Page background |
| 100 | `--neutral-100` | `#f4f4f5` | Hover states |
| 200 | `--neutral-200` | `#e4e4e7` | Borders |
| 300 | `--neutral-300` | `#d4d4d8` | Strong borders |
| 400 | `--neutral-400` | `#a1a1aa` | Subtle text |
| 500 | `--neutral-500` | `#71717a` | Muted text |
| 600 | `--neutral-600` | `#52525b` | Secondary text |
| 700 | `--neutral-700` | `#3f3f46` | Body text |
| 800 | `--neutral-800` | `#27272a` | Headings |
| 900 | `--neutral-900` | `#18181b` | Dark text |
| 950 | `--neutral-950` | `#09090b` | Pure black |

**Semantic Aliases:**

```css
--color-background: var(--neutral-50);
--color-surface: #ffffff;
--color-border: var(--neutral-200);
--color-text: var(--neutral-900);
--color-text-secondary: var(--neutral-700);
--color-text-muted: var(--neutral-500);
```

---

## Typography

### Font Families

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

**Inter** is loaded from Google Fonts with weights: 400, 500, 600, 700, 800.

### Font Size Scale

Uses rem units for accessibility (respects user font size preference):

| Token | Size | Pixels (@16px base) | Use Case |
|-------|------|---------------------|----------|
| `--text-xs` | 0.75rem | 12px | Captions, helper text |
| `--text-sm` | 0.875rem | 14px | Body text, labels |
| `--text-base` | 1rem | 16px | Default body text |
| `--text-lg` | 1.125rem | 18px | Subheadings |
| `--text-xl` | 1.25rem | 20px | Card titles |
| `--text-2xl` | 1.5rem | 24px | Section headings |
| `--text-3xl` | 1.875rem | 30px | Page headings |
| `--text-4xl` | 2.25rem | 36px | Hero headings |
| `--text-5xl` | 3rem | 48px | Display headings |

### Font Weights

| Token | Value | Use Case |
|-------|-------|----------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Emphasized text |
| `--font-semibold` | 600 | Subheadings, labels |
| `--font-bold` | 700 | Headings |
| `--font-extrabold` | 800 | Hero text |

### Line Heights

| Token | Value | Use Case |
|-------|-------|----------|
| `--leading-tight` | 1.25 | Headings |
| `--leading-snug` | 1.375 | Tight paragraphs |
| `--leading-normal` | 1.5 | Body text (default) |
| `--leading-relaxed` | 1.625 | Comfortable reading |

### Usage Example

```css
h1 {
  font-family: var(--font-sans);
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--neutral-900);
}

p {
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--neutral-700);
}
```

---

## Spacing

Consistent spacing scale based on 4px (0.25rem) unit:

| Token | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `--space-0` | 0 | 0px | No spacing |
| `--space-px` | 1px | 1px | Hairline |
| `--space-1` | 0.25rem | 4px | Tight spacing |
| `--space-2` | 0.5rem | 8px | Standard gap |
| `--space-3` | 0.75rem | 12px | Input padding |
| `--space-4` | 1rem | 16px | Card padding |
| `--space-5` | 1.25rem | 20px | Button padding |
| `--space-6` | 1.5rem | 24px | Section spacing |
| `--space-8` | 2rem | 32px | Large gaps |
| `--space-10` | 2.5rem | 40px | Hero padding |
| `--space-12` | 3rem | 48px | Page sections |
| `--space-16` | 4rem | 64px | Major sections |
| `--space-20` | 5rem | 80px | Hero sections |
| `--space-24` | 6rem | 96px | XXL sections |

### Border Radius

| Token | Value | Pixels | Use Case |
|-------|-------|--------|----------|
| `--radius-sm` | 0.25rem | 4px | Subtle rounding |
| `--radius-md` | 0.375rem | 6px | Default inputs |
| `--radius-lg` | 0.5rem | 8px | Cards, buttons |
| `--radius-xl` | 0.75rem | 12px | Modals, large cards |
| `--radius-2xl` | 1rem | 16px | Prominent elements |
| `--radius-3xl` | 1.5rem | 24px | Hero sections |
| `--radius-full` | 9999px | ∞ | Pills, avatars |

### Shadows & Elevation

| Token | Use Case | Example |
|-------|----------|---------|
| `--shadow-sm` | Subtle hover states | Buttons |
| `--shadow-md` | Cards, dropdowns | Default elevation |
| `--shadow-lg` | Elevated cards | Important content |
| `--shadow-xl` | Modals, overlays | Maximum elevation |
| `--shadow-2xl` | Hero elements | Dramatic effect |
| `--shadow-brand` | Branded focus states | Primary buttons |
| `--shadow-inner` | Inset effects | Pressed buttons |

### Z-Index Scale

| Token | Value | Use Case |
|-------|-------|----------|
| `--z-behind` | -1 | Background elements |
| `--z-base` | 0 | Default |
| `--z-dropdown` | 10 | Dropdown menus |
| `--z-sticky` | 20 | Sticky headers |
| `--z-fixed` | 30 | Fixed elements |
| `--z-modal-backdrop` | 40 | Modal backdrop |
| `--z-modal` | 50 | Modal content |
| `--z-popover` | 60 | Popovers |
| `--z-tooltip` | 70 | Tooltips |
| `--z-toast` | 80 | Toast notifications |

---

## Components

The design system includes 16 fully-styled components in `components.css`:

### Button

**Variants:** Primary, Secondary, Outline, Ghost, Danger
**Sizes:** xs, sm, (default), lg, xl

```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-danger">Delete</button>

<button class="btn btn-sm btn-primary">Small</button>
<button class="btn btn-lg btn-primary">Large</button>
```

### Badge

**Variants:** Default, Primary, Success, Warning, Error, Info
**Sizes:** sm, (default), lg
**Special:** Dot variant

```html
<span class="badge badge-success">Paid</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-error">Failed</span>

<span class="badge badge-dot badge-success"></span>
```

### Card

**Variants:** Default, Elevated, Interactive
**Sections:** Header, Body, Footer

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Card Title</h3>
    <p class="card-description">Description text</p>
  </div>
  <div class="card-body">
    Content goes here
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

### Input

**Types:** Text, Email, Tel, Date, Textarea, Select
**States:** Default, Hover, Focus, Disabled, Error
**Sizes:** sm, (default), lg

```html
<div class="form-group">
  <label class="form-label form-label-required">Email</label>
  <input type="email" class="input" placeholder="email@example.com" />
  <p class="form-hint">We'll never share your email</p>
</div>

<div class="form-group">
  <label class="form-label">Message</label>
  <textarea class="input textarea"></textarea>
  <p class="form-error">This field is required</p>
</div>
```

### Modal

**Sizes:** sm, md (default), lg, xl
**Features:** Focus trap, keyboard nav, scroll lock

```javascript
const modal = new Modal({
  title: 'Confirm Delete',
  content: 'Are you sure?',
  footer: `
    <button class="btn btn-ghost" data-modal-close>Cancel</button>
    <button class="btn btn-danger" data-confirm>Delete</button>
  `,
  size: 'sm',
});

modal.open();
```

### Toast

**Types:** Success, Error, Warning, Info, Loading
**Features:** Auto-dismiss, queue management

```javascript
Toast.success('Registration saved!');
Toast.error('Failed to save registration');
Toast.warning('Registration deadline approaching');
Toast.info('New features available');

// Loading toast (doesn't auto-dismiss)
const loadingId = Toast.loading('Saving...');
// Later:
Toast.dismiss(loadingId);
```

### Dropdown

**Features:** Positioning, keyboard nav, click-outside

```html
<div class="dropdown" data-dropdown>
  <button class="btn btn-primary" data-dropdown-trigger>
    Menu <i data-lucide="chevron-down"></i>
  </button>
  <div class="dropdown-menu" data-dropdown-menu>
    <button class="dropdown-item" data-dropdown-item>Edit</button>
    <button class="dropdown-item" data-dropdown-item>Duplicate</button>
    <div class="dropdown-divider"></div>
    <button class="dropdown-item dropdown-item-danger" data-dropdown-item>Delete</button>
  </div>
</div>
```

### Other Components

- **Alert** - Info, success, warning, error alerts
- **Avatar** - User avatars with sizes and groups
- **Table** - Sortable, striped tables with hover
- **Tabs** - Horizontal tab navigation
- **Progress Bar** - Loading progress with variants
- **Skeleton Loader** - Loading placeholders
- **Empty State** - Zero-state with icon and CTA
- **Divider** - Horizontal/vertical separators

---

## Usage Examples

### Building a Form

```html
<form class="card">
  <div class="card-header">
    <h2 class="card-title">Registration Form</h2>
    <p class="card-description">Enter participant details</p>
  </div>

  <div class="card-body" style="display: flex; flex-direction: column; gap: var(--space-4);">
    <div class="form-group">
      <label class="form-label form-label-required">Full Name</label>
      <input type="text" class="input" required />
    </div>

    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="input" />
      <p class="form-hint">Optional but recommended</p>
    </div>

    <div class="form-group">
      <label class="form-label">Age Division</label>
      <select class="input select">
        <option>6 & Under</option>
        <option>7-9</option>
        <option>10-12</option>
      </select>
    </div>
  </div>

  <div class="card-footer">
    <button type="button" class="btn btn-ghost">Cancel</button>
    <button type="submit" class="btn btn-primary">Submit</button>
  </div>
</form>
```

### Building a Data Table

```html
<div class="table-wrapper">
  <table class="table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Age</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Emma Johnson</td>
        <td>7-9</td>
        <td><span class="badge badge-success">Paid</span></td>
        <td>
          <button class="btn btn-xs btn-ghost">Edit</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Customization

### Admin Customization

Admins can customize branding via **Admin → Settings → Branding**:

1. **Organization Name** - Appears in header and page titles
2. **Tagline** - Subtitle in header
3. **Primary Color** - Buttons, links, active states
4. **Secondary Color** - Accents, highlights
5. **Logo URL** - Header logo (or upload file)

Changes are applied immediately across the entire site.

### Developer Customization

#### Override Tokens

Create a custom CSS file loaded after `design-tokens.css`:

```css
/* custom-tokens.css */
:root {
  /* Override spacing */
  --space-4: 1.25rem;  /* Make base spacing larger */

  /* Add custom colors */
  --color-custom: #ff6b6b;
}
```

#### Extend Components

Add new component variants:

```css
/* custom-components.css */
.btn-custom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.btn-custom:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

### Runtime Customization

Use `BrandingLoader.js` API:

```javascript
// Refresh branding (bypass cache)
await window.GKPBranding.refresh();

// Clear cache
window.GKPBranding.clearCache();

// Listen for branding changes
window.addEventListener('brandingLoaded', (e) => {
  console.log('Branding loaded:', e.detail);
});
```

---

## Accessibility

### Focus States

All interactive elements have visible focus indicators:

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-surface),
              0 0 0 5px var(--ring-color);
}
```

### Reduced Motion

Respects user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### ARIA Attributes

Components include proper ARIA attributes:

- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Dropdowns: `aria-expanded`, `aria-haspopup`
- Buttons: `aria-label` for icon-only buttons
- Alerts: `role="alert"`, `aria-live="polite"`

### Color Contrast

All color combinations meet WCAG 2.1 AA standards:

- Normal text: 4.5:1 minimum contrast
- Large text: 3:1 minimum contrast
- Interactive elements: 3:1 minimum contrast

---

## Migration Guide

### From Old System

1. **Replace hardcoded colors** with design tokens:
   ```css
   /* Before */
   color: #0b5cff;

   /* After */
   color: var(--brand-primary);
   ```

2. **Replace hardcoded spacing** with spacing scale:
   ```css
   /* Before */
   margin: 16px;

   /* After */
   margin: var(--space-4);
   ```

3. **Use component classes** instead of custom styles:
   ```html
   <!-- Before -->
   <button style="background: blue; color: white; padding: 10px 20px; border-radius: 8px;">
     Click me
   </button>

   <!-- After -->
   <button class="btn btn-primary">
     Click me
   </button>
   ```

---

## Resources

- **CSS Files**: `/web/assets/css/`
- **JS Components**: `/web/assets/js/components/`
- **Icon Library**: [Lucide Icons](https://lucide.dev/)
- **Font**: [Inter on Google Fonts](https://fonts.google.com/specimen/Inter)
- **Product Roadmap**: `PRODUCT_ROADMAP.md` (Phase 6A details)

---

## Support

For questions or issues with the design system:

1. Check this documentation
2. Review component examples in the codebase
3. Consult the product roadmap for planned features
4. Report issues via GitHub

---

*Design System v1.0 - February 2026*
