# Product Roadmap: Multi-Tenant Competition Registration Platform

> Transform from a single-client app into a packageable SaaS platform for competition organizers.

---

## Table of Contents

1. [Vision & Goals](#vision--goals)
2. [Phase 1: Configuration Foundation](#phase-1-configuration-foundation)
3. [Phase 2: Branding & Theming](#phase-2-branding--theming)
4. [Phase 3: Form Customization](#phase-3-form-customization)
5. [Phase 4: Reporting & Analytics](#phase-4-reporting--analytics)
6. [Phase 5: Payment Integration](#phase-5-payment-integration)
7. [Phase 6: App Optimizations](#phase-6-app-optimizations)
8. [Phase 7: Community-Driven Features](#phase-7-community-driven-features)
9. [Phase 8: Multi-Tenancy & Onboarding](#phase-8-multi-tenancy--onboarding)
10. [Phase 9: Advanced Features](#phase-9-advanced-features)
10. [Technical Debt & Cleanup](#technical-debt--cleanup)
11. [Pricing Implementation](#pricing-implementation)

---

## Vision & Goals

### Vision
A white-label competition registration platform that any organization (baton twirling, dance, gymnastics, cheerleading, martial arts, etc.) can customize and deploy for their events.

### Goals
- **Configurable**: All client-specific elements externalized to configuration
- **Brandable**: Full visual customization without code changes
- **Flexible**: Adaptable registration forms for different competition types
- **Scalable**: Support multiple tenants on shared infrastructure
- **Maintainable**: Single codebase serves all clients

### Target Markets
- Baton twirling competitions
- Dance competitions & recitals
- Gymnastics meets
- Cheerleading competitions
- Martial arts tournaments
- Talent shows & pageants
- Youth sports leagues

---

## Phase 1: Configuration Foundation ✅

**Priority: Critical | Effort: Medium | Status: COMPLETE**

### 1.1 Environment Variables ✅

Move all secrets and environment-specific config to `.env`:

```bash
# .env.example
# Database
DB_HOST=localhost
DB_NAME=competition_events
DB_USER=app_user
DB_PASS=
DB_CHARSET=utf8mb4

# Admin Authentication
ADMIN_USER=admin
ADMIN_PASS=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Application
APP_ENV=production
APP_URL=https://example.com
APP_DEBUG=false

# Email (future)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

**Tasks:**
- [x] Create `.env.example` template
- [x] Create `server/lib/Env.php` to load environment variables
- [x] Update `server/config.php` to read from `.env`
- [x] Add `.env` to `.gitignore`
- [x] Document environment setup in README

### 1.2 Tenant Configuration File

Create `config/tenant.json` for all client-specific settings:

```json
{
  "organization": {
    "name": "GKP Events",
    "legalName": "Gangi Kupras Productions LLC",
    "tagline": "Competition Registration Made Simple",
    "website": "https://gkpevents.com",
    "supportEmail": "support@gkpevents.com",
    "timezone": "America/New_York"
  },
  "branding": {
    "logo": "/assets/images/logo.png",
    "favicon": "/assets/images/favicon.ico",
    "colors": {
      "primary": "#0b5cff",
      "primaryHover": "#0849c6",
      "accent": "#7c3aed",
      "accentHover": "#6d28d9",
      "success": "#10b981",
      "warning": "#f59e0b",
      "error": "#ef4444",
      "background": "#f8fafc",
      "surface": "#ffffff",
      "text": "#1e293b",
      "textMuted": "#64748b"
    },
    "fonts": {
      "heading": "Inter, system-ui, sans-serif",
      "body": "Inter, system-ui, sans-serif"
    }
  },
  "terminology": {
    "participant": "Twirler",
    "participantPlural": "Twirlers",
    "instructor": "Coach",
    "instructorPlural": "Coaches",
    "group": "Team",
    "groupPlural": "Teams",
    "event": "Event",
    "eventPlural": "Events",
    "competition": "Competition",
    "competitionPlural": "Competitions"
  },
  "defaults": {
    "ageDivisions": [
      { "id": "0-6", "label": "6 & Under", "minAge": 0, "maxAge": 6 },
      { "id": "7-9", "label": "7-9", "minAge": 7, "maxAge": 9 },
      { "id": "10-12", "label": "10-12", "minAge": 10, "maxAge": 12 },
      { "id": "13-15", "label": "13-15", "minAge": 13, "maxAge": 15 },
      { "id": "16+", "label": "16 & Over", "minAge": 16, "maxAge": null }
    ],
    "genderOptions": [
      { "value": "female", "label": "Female" },
      { "value": "male", "label": "Male" },
      { "value": "nonbinary", "label": "Non-binary" },
      { "value": "prefer_not_to_say", "label": "Prefer not to say" },
      { "value": "other", "label": "Other" }
    ]
  },
  "features": {
    "facilityFee": true,
    "optionalProduct": true,
    "duetTrioRegistration": false,
    "coachSelection": true,
    "multipleCoaches": true,
    "waitlist": false,
    "earlyBirdPricing": false,
    "lateFee": false,
    "groupDiscounts": false,
    "promoCode": false
  },
  "fees": {
    "processingFeePercent": 2.9,
    "processingFeeFlat": 0.30,
    "passProcessingFeeToCustomer": true
  },
  "registration": {
    "requirePhone": true,
    "requireEmail": true,
    "requireDateOfBirth": true,
    "requireGender": true,
    "requireCoach": true,
    "requireTeam": true,
    "allowOtherCoach": true,
    "maxEventsPerRegistrant": null,
    "minEventsPerRegistrant": 1
  },
  "legal": {
    "termsUrl": "/terms",
    "privacyUrl": "/privacy",
    "waiverRequired": false,
    "waiverText": ""
  }
}
```

**Tasks:**
- [ ] Create `config/tenant.example.json`
- [ ] Create `server/lib/Tenant.php` class to load and access config
- [x] Create `web/api/config.php` endpoint to serve safe config to frontend *(created in Phase 2)*
- [ ] Update all hardcoded references to use tenant config

*Note: Phase 1.2 deferred - tenant config partially implemented via `web/api/config.php` with defaults.*

### 1.3 Feature Flags ✅

Create `config/features.json` for toggleable functionality:

```json
{
  "registration": {
    "enabled": true,
    "requirePayment": true,
    "allowDraftSave": true,
    "confirmationEmail": true
  },
  "admin": {
    "exportCsv": true,
    "exportPdf": false,
    "judgingSheets": true,
    "scoreLabels": true,
    "financialReports": true,
    "emailBlast": false
  },
  "integrations": {
    "stripe": true,
    "paypal": false,
    "square": false,
    "mailchimp": false,
    "googleAnalytics": false
  }
}
```

**Tasks:**
- [x] Create `config/features.json`
- [x] Create `server/lib/Features.php` class
- [ ] Add feature checks throughout codebase (incremental)
- [ ] Create admin UI to toggle features (Phase 7)

---

## Phase 2: Branding & Theming ✅

**Priority: High | Effort: Medium | Status: COMPLETE**

### 2.1 CSS Custom Properties

Convert hardcoded colors to CSS variables in `web/assets/css/theme.css`:

```css
:root {
  /* Primary colors - loaded from config */
  --color-primary: #0b5cff;
  --color-primary-hover: #0849c6;
  --color-accent: #7c3aed;
  --color-accent-hover: #6d28d9;

  /* Status colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* Neutral colors */
  --color-background: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-border: #e2e8f0;

  /* Typography */
  --font-heading: Inter, system-ui, sans-serif;
  --font-body: Inter, system-ui, sans-serif;

  /* Spacing */
  --spacing-unit: 0.25rem;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

**Tasks:**
- [x] Create `web/assets/css/theme.css`
- [x] Create JS function to inject CSS variables from config (`branding.js`)
- [x] Update `custom.css` to use CSS variables
- [ ] Remove hardcoded colors from inline styles (incremental)

### 2.2 Dynamic Header/Footer ✅

**Tasks:**
- [x] Create `web/assets/js/branding.js` to populate header/footer from config
- [x] Update `layout.js` to load branding after fragments
- [x] Create `web/api/config.php` to serve branding config

### 2.3 Asset Management ✅

**Tasks:**
- [x] Create default asset directory structure (`web/assets/images/default/`)
- [x] Add `/assets/images/custom/` to `.gitignore`
- [x] Move logo to `images/default/logo.png`

### 2.4 Email Templates

*Deferred - no email system implemented yet.*

**Tasks:**
- [ ] Create email template system with variable substitution
- [ ] Create base email layout with branding
- [ ] Create registration confirmation template
- [ ] Create payment receipt template

---

## Phase 3: Form Customization ✅

**Priority: High | Effort: High | Status: COMPLETE**

### 3.1 Field Configuration Schema ✅

Created `config/fields.json` with full field schema supporting:
- Core fields (first_name, last_name, date_of_birth, gender, age_division, email, etc.)
- Custom fields stored in `custom_data_json` column (emergency_contact, medical_notes, t-shirt size)
- Field types: text, email, tel, date, select, textarea, checkbox, coach-select
- Terminology placeholders: `{{instructor}}`, `{{group}}`, `{{participant}}`
- Field properties: enabled, required, order, width, storage type, validation rules
- Section grouping with collapsible sections

**Database Strategy: Fixed Core + JSON Blob**
- Core queryable fields remain as dedicated columns
- Custom/optional fields stored in `custom_data_json` (JSON column)
- Migration: `server/migrations/001_add_custom_data_json.sql`

Example field schema:

```json
{
  "registrationFields": [
    {
      "id": "first_name",
      "type": "text",
      "label": "First Name",
      "required": true,
      "enabled": true,
      "order": 1,
      "validation": {
        "minLength": 1,
        "maxLength": 100
      }
    },
    {
      "id": "last_name",
      "type": "text",
      "label": "Last Name",
      "required": true,
      "enabled": true,
      "order": 2
    },
    {
      "id": "date_of_birth",
      "type": "date",
      "label": "Date of Birth",
      "required": true,
      "enabled": true,
      "order": 3,
      "validation": {
        "minAge": 3,
        "maxAge": 99
      }
    },
    {
      "id": "gender",
      "type": "select",
      "label": "Gender",
      "required": true,
      "enabled": true,
      "order": 4,
      "options": "genderOptions"
    },
    {
      "id": "age_division",
      "type": "select",
      "label": "Age Division",
      "required": true,
      "enabled": true,
      "order": 5,
      "options": "ageDivisions",
      "autoCalculate": true
    },
    {
      "id": "coach_selections",
      "type": "multiselect",
      "label": "{{instructor}}",
      "required": true,
      "enabled": true,
      "order": 6,
      "options": "coaches",
      "allowOther": true
    },
    {
      "id": "team_name",
      "type": "text",
      "label": "{{group}} Name",
      "required": true,
      "enabled": true,
      "order": 7
    },
    {
      "id": "email",
      "type": "email",
      "label": "Email Address",
      "required": true,
      "enabled": true,
      "order": 8
    },
    {
      "id": "home_phone",
      "type": "tel",
      "label": "Phone Number",
      "required": true,
      "enabled": true,
      "order": 9
    },
    {
      "id": "emergency_contact",
      "type": "text",
      "label": "Emergency Contact Name",
      "required": false,
      "enabled": false,
      "order": 10
    },
    {
      "id": "emergency_phone",
      "type": "tel",
      "label": "Emergency Contact Phone",
      "required": false,
      "enabled": false,
      "order": 11
    },
    {
      "id": "medical_notes",
      "type": "textarea",
      "label": "Medical Notes / Allergies",
      "required": false,
      "enabled": false,
      "order": 12
    },
    {
      "id": "tshirt_size",
      "type": "select",
      "label": "T-Shirt Size",
      "required": false,
      "enabled": false,
      "order": 13,
      "options": [
        { "value": "ys", "label": "Youth Small" },
        { "value": "ym", "label": "Youth Medium" },
        { "value": "yl", "label": "Youth Large" },
        { "value": "as", "label": "Adult Small" },
        { "value": "am", "label": "Adult Medium" },
        { "value": "al", "label": "Adult Large" },
        { "value": "axl", "label": "Adult XL" },
        { "value": "axxl", "label": "Adult XXL" }
      ]
    }
  ]
}
```

### 3.2 Dynamic Form Renderer ✅

Created `web/assets/js/lib/FormBuilder.js` class:

```javascript
class FormBuilder {
  constructor(config, options) { ... }      // Config + runtime data (coaches, etc.)
  render() { ... }                          // Generate HTML from field schema
  mount(container) { ... }                  // Render + wire event handlers
  getValues(container) { ... }              // Extract form values
  separateStorage(values) { ... }           // Returns { columnData, customData }
  validate(values) { ... }                  // Validate against field rules
  replaceTerm(text) { ... }                 // {{placeholder}} substitution
}
```

**Files created/updated:**
- `web/assets/js/lib/FormBuilder.js` - Dynamic form renderer class
- `web/api/fields.php` - API endpoint for field configuration
- `web/api/register.php` - Updated to return fieldsConfig and handle custom_data_json
- `web/register.html` - Simplified with FormBuilder mount point
- `web/assets/js/register.js` - Rewritten to use FormBuilder

**Tasks:**
- [x] Create `FormBuilder.js` class
- [x] Support all field types: text, email, tel, date, select, checkbox, textarea, coach-select
- [x] Implement terminology substitution (`{{instructor}}` → "Coach")
- [x] Implement conditional fields (show field B if field A = X)
- [x] Create admin UI for field configuration
- [x] Store field config in database per competition (via `fields_config_json` override)

### 3.3 Custom Fields Support ✅ (Partial)

Custom fields are defined in `config/fields.json` with `storage: "custom"`:

```json
{
  "id": "emergency_contact",
  "type": "text",
  "label": "Emergency contact name",
  "required": false,
  "enabled": false,
  "storage": "custom",
  "width": "half"
}
```

Fields with `storage: "custom"` are automatically:
- Rendered by FormBuilder when `enabled: true`
- Collected via `FormBuilder.separateStorage()`
- Stored in `registrations.custom_data_json` column

**Tasks:**
- [x] Schema support for custom fields (`storage: "custom"`)
- [x] FormBuilder separates column vs custom data
- [x] Backend stores custom data in `custom_data_json`
- [x] Add `fields_config_json` column to competitions table (per-competition overrides)
- [x] Create admin UI for adding/editing custom fields
- [x] Include custom fields in exports and reports

### 3.4 Event Categories ✅

Group events into categories for better organization:

```json
{
  "eventCategories": [
    {
      "id": "solo",
      "name": "Solo Events",
      "events": ["basic_strut", "fancy_strut", "solo_twirl"]
    },
    {
      "id": "team",
      "name": "Team Events",
      "events": ["duet", "trio", "team_twirl"]
    },
    {
      "id": "specialty",
      "name": "Specialty Events",
      "events": ["modeling", "photogenic"]
    }
  ]
}
```

**Tasks:**
- [x] Add event categories to database schema (`server/migrations/003_add_event_categories.sql`)
- [x] Update registration form to group events by category
- [x] Update admin event management UI (category dropdown per event)

### 3.5 Event Groups ✅

Sub-group related events under a shared header within a category (e.g., "2-Baton" group containing Part 1, Part 2, Part 3):

```
SOLO EVENTS (category)
├── Basic Strut ..................... $15
├── Fancy Strut ..................... $20
│
├── 2-BATON (event group)
│   ├── 2-Baton Part 1 .............. $25
│   ├── 2-Baton Part 2 .............. $25
│   └── 2-Baton Part 3 .............. $25
│
└── Solo Twirl ...................... $20
```

**Tasks:**
- [x] Add `event_group` column to database schema (`server/migrations/004_add_event_groups.sql`)
- [x] Update admin event management UI (group text field per event)
- [x] Update registration form to display sub-groups within categories

---

## Phase 4: Reporting & Analytics ✅

**Priority: High | Effort: High | Status: COMPLETE**

### 4.1 Report Configuration

Define available reports:

```json
{
  "reports": {
    "registrantList": {
      "name": "Registrant List",
      "description": "List of all registrants with contact info",
      "formats": ["screen", "print", "csv", "pdf"],
      "columns": ["name", "age_division", "coach", "team", "events", "total"]
    },
    "judgingSheets": {
      "name": "Judging Sheets",
      "description": "Check-in and judging sheets by coach",
      "formats": ["print", "pdf"],
      "groupBy": ["coach", "age_division", "event"]
    },
    "scoreLabels": {
      "name": "Score Sheet Labels",
      "description": "Labels for score sheets",
      "formats": ["print", "pdf"],
      "labelSize": "avery5160"
    },
    "financialSummary": {
      "name": "Financial Summary",
      "description": "Revenue breakdown by event and fees",
      "formats": ["screen", "csv", "pdf"]
    },
    "coachRoster": {
      "name": "Coach Roster",
      "description": "Registrants grouped by coach",
      "formats": ["screen", "print", "csv"]
    },
    "eventBreakdown": {
      "name": "Event Breakdown",
      "description": "Registrant count per event",
      "formats": ["screen", "csv"]
    },
    "ageDistribution": {
      "name": "Age Distribution",
      "description": "Registrants by age division",
      "formats": ["screen", "chart"]
    }
  }
}
```

### 4.2 New Reports to Implement

**Financial Summary Report:**
```
┌─────────────────────────────────────────────────────────┐
│ FINANCIAL SUMMARY - Spring Competition 2026            │
├─────────────────────────────────────────────────────────┤
│ Event Revenue                                          │
│   Basic Strut (45 @ $15)                    $675.00    │
│   Fancy Strut (38 @ $20)                    $760.00    │
│   Solo Twirl (52 @ $25)                   $1,300.00    │
│   ...                                                  │
│ ───────────────────────────────────────────────────────│
│ Event Subtotal                            $4,235.00    │
│ Facility Fees (72 @ $10)                    $720.00    │
│ T-Shirts (45 @ $18)                         $810.00    │
│ ───────────────────────────────────────────────────────│
│ Gross Revenue                             $5,765.00    │
│ Processing Fees Collected                   $198.42    │
│ Processing Fees Paid                       ($198.42)   │
│ ───────────────────────────────────────────────────────│
│ Net Revenue                               $5,765.00    │
└─────────────────────────────────────────────────────────┘
```

**Coach Roster Report:**
```
┌─────────────────────────────────────────────────────────┐
│ COACH: Sarah Johnson (SJ)                    12 twirlers│
├─────────────────────────────────────────────────────────┤
│ Name              │ Age │ Events                        │
│ ──────────────────┼─────┼───────────────────────────────│
│ Emma Smith        │ 7-9 │ Basic, Fancy, Solo           │
│ Olivia Brown      │10-12│ Basic, Fancy, Solo, Model    │
│ ...               │     │                              │
└─────────────────────────────────────────────────────────┘
```

**Event Schedule Report:**
```
┌─────────────────────────────────────────────────────────┐
│ EVENT SCHEDULE - Estimated                             │
├─────────────────────────────────────────────────────────┤
│ Basic Strut - 6 & Under (8 entries)        ~16 min     │
│ Basic Strut - 7-9 (12 entries)             ~24 min     │
│ Basic Strut - 10-12 (15 entries)           ~30 min     │
│ ...                                                    │
│ ───────────────────────────────────────────────────────│
│ Total Entries: 245                                     │
│ Estimated Duration: 8.5 hours                          │
└─────────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Create report framework with common rendering logic
- [ ] Implement Financial Summary report
- [ ] Implement Coach Roster report
- [ ] Implement Event Schedule/Breakdown report
- [ ] Implement Age Distribution chart
- [ ] Add PDF export using browser print or library
- [ ] Add Excel export option (xlsx)

### 4.3 Dashboard Analytics

Add analytics widgets to admin dashboard:

```javascript
// Registration trends chart
// Revenue by event pie chart
// Age division breakdown
// Registration timeline (cumulative)
// Comparison with previous competitions
```

**Tasks:**
- [ ] Add Chart.js or similar library
- [ ] Create registration trends line chart
- [ ] Create revenue breakdown pie chart
- [ ] Create age distribution bar chart
- [ ] Add comparison to previous events (if available)

### 4.4 Export Improvements

Enhance CSV/Excel exports:

**Tasks:**
- [ ] Add column selection UI before export
- [ ] Add date range filtering
- [ ] Add grouping options (by coach, by event, etc.)
- [ ] Include calculated fields (age at competition date)
- [ ] Add Excel formatting (headers, column widths)

---

## Phase 5: Payment Integration ✅

**Priority: High | Effort: Medium | Status: COMPLETE**

### 5.1 Multi-Provider Payment System ✅

Implemented a flexible payment provider architecture supporting multiple providers:

**Providers Implemented:**
- [x] **Stripe** - Full Checkout Session flow with webhooks
- [x] **PayPal** - OAuth + Orders API with webhooks
- [x] **Square** - Payment Links API with webhooks
- [x] **Manual (Pay Later)** - Registration without immediate payment

**Architecture:**
```
PaymentProviderInterface
├── createPaymentSession(registration, pricing, urls)
├── handleWebhook(payload, headers)
├── verifyWebhookSignature(payload, headers)
├── getPaymentStatus(transactionId)
├── getClientConfig() → public keys for frontend
└── isConfigured() → bool

Implementations:
├── StripeProvider
├── PayPalProvider
├── SquareProvider
└── ManualProvider (Pay Later)
```

### 5.2 Admin Settings UI ✅

Added Settings tab (7th tab) in admin with:
- [x] Payment provider selection dropdown
- [x] Stripe configuration (mode, keys, webhook secret)
- [x] PayPal configuration (mode, client ID/secret)
- [x] Square configuration (mode, app ID, access token, location ID)
- [x] Test Connection buttons for credential validation
- [x] Pay Later toggle with custom instructions

### 5.3 Encrypted Credential Storage ✅

- [x] AES-256-GCM encryption for sensitive credentials
- [x] `ENCRYPTION_KEY` environment variable
- [x] `settings` table with encrypted/plain value columns
- [x] Masked display of secrets in admin UI

### 5.4 Payment Tracking ✅

- [x] `payment_transactions` table for audit trail
- [x] `payment_status`, `payment_provider`, `payment_transaction_id` columns on registrations
- [x] Payment status badges in admin registrant views

### 5.5 Dynamic Payment Page ✅

- [x] Fetches payment config from `/api/payment/config.php`
- [x] Shows appropriate button based on active provider
- [x] "Pay Later" button when enabled
- [x] Handles provider-specific checkout flows

### 5.6 Future Enhancements

**Tasks (deferred):**
- [ ] Multi-provider checkout (allow user to choose between Stripe/PayPal/Square)
- [ ] Generate receipt PDF on successful payment
- [ ] Send confirmation email with receipt attached
- [ ] Add refund functionality in admin
- [ ] Support Stripe Connect for multi-tenant

### Files Created in Phase 5

| File | Purpose |
|------|---------|
| `server/lib/Encryption.php` | AES-256-GCM encrypt/decrypt |
| `server/lib/Settings.php` | Settings manager with encryption |
| `server/lib/PaymentProvider/PaymentProviderInterface.php` | Provider contract |
| `server/lib/PaymentProvider/AbstractPaymentProvider.php` | Shared logic |
| `server/lib/PaymentProvider/PaymentProviderFactory.php` | Provider instantiation |
| `server/lib/PaymentProvider/StripeProvider.php` | Stripe implementation |
| `server/lib/PaymentProvider/PayPalProvider.php` | PayPal implementation |
| `server/lib/PaymentProvider/SquareProvider.php` | Square implementation |
| `server/lib/PaymentProvider/ManualProvider.php` | Pay Later handler |
| `web/api/payment/create-session.php` | Unified payment initiation |
| `web/api/payment/config.php` | Public payment config |
| `web/api/settings/get.php` | Admin settings read |
| `web/api/settings/save.php` | Admin settings write |
| `web/api/settings/test-connection.php` | Credential testing |
| `web/api/stripe/webhook.php` | Stripe webhooks |
| `web/api/paypal/webhook.php` | PayPal webhooks |
| `web/api/square/webhook.php` | Square webhooks |
| `web/assets/js/admin/tabs/settings.js` | Settings tab module |
| `server/migrations/005_payment_provider_integration.sql` | DB migration |

### Files Updated in Phase 5

| File | Changes |
|------|---------|
| `web/admin/index.html` | Added Settings tab |
| `web/assets/js/admin.js` | Import settings module |
| `web/payment.html` | Dynamic provider support, Pay Later |
| `web/api/register.php` | Handle payment_status columns |
| `web/api/admin-list.php` | Return payment status |
| `web/assets/js/admin/tabs/registrants.js` | Payment status badges |
| `.env.example` | Added ENCRYPTION_KEY |

---

## Phase 6: Design & Optimization

> **Research-Informed Approach**: This phase incorporates insights from competitive analysis (TourPro, EntryEeze, DanceComp Genie, Twirlmate), award-winning UI patterns (Linear, Stripe, Apple Design Awards), and baton twirling community research. The goal is to create an experience that feels like it was built by someone who understands the sport.

---

## Phase 6A: Design System & Visual Identity ✅

**Priority: High | Effort: Medium | Status: COMPLETE**

> The baton twirling community is detail-oriented and visually-driven. Sparkle, presentation, and aesthetics matter. The app should feel premium and polished.

### 6A.1 Design Tokens & CSS Variables ✅

**Status: COMPLETE**

Created comprehensive design system in `web/assets/css/design-tokens.css`:
- ✅ Brand colors (admin-customizable: `--brand-primary`, `--brand-secondary`)
- ✅ Semantic colors (success, warning, error, info)
- ✅ Neutral palette (50-950 scale based on Tailwind Zinc)
- ✅ Typography scale (xs to 5xl, font weights, line heights, letter spacing)
- ✅ Spacing scale (4px base unit, 0 to 24)
- ✅ Border radius scale (sm to 3xl, full)
- ✅ Shadow system (sm to 2xl, brand-colored shadows, focus rings)
- ✅ Transition durations and easing functions
- ✅ Z-index scale for stacking order
- ✅ Breakpoint reference values
- ✅ Focus-visible styles for accessibility
- ✅ Reduced motion support

Created theme mapping layer in `web/assets/css/theme.css`:
- ✅ Maps design tokens to application-specific semantic variables
- ✅ Backward compatibility with existing CSS
- ✅ Utility classes (backgrounds, text colors, borders, spacing, typography, shadows)
- ✅ Header/footer semantic color variables

### 6A.2 Admin Branding Settings ✅ (Partial)

**Status: Basic UI complete, file upload pending**

**Completed:**
- ✅ Branding API endpoint (`web/api/branding/config.php`)
- ✅ Settings database integration via `Settings.php`
- ✅ Admin UI in Settings tab (7th tab):
  - Organization name and tagline inputs
  - Primary and secondary color pickers
  - Logo URL input (text field)
  - Live preview with sample buttons
  - Color presets with baton twirling-inspired palette:
    - Rose Gold (`#b76e79`), Royal Purple (`#7c3aed`), Midnight Navy (`#1e3a8a`)
    - Champagne Gold (`#d4af37`), Hot Pink (`#ec4899`), Emerald (`#10b981`)
    - Coral (`#f97316`), Sapphire (`#2563eb`)
- ✅ Runtime branding application via `BrandingLoader.js`
- ✅ Local storage caching (5 min TTL) for instant load

**Pending:**
- [ ] File upload functionality for logos/favicon
  - [ ] Create upload endpoint with image validation (type, size, dimensions)
  - [ ] Store uploads in `/web/assets/uploads/` directory
  - [ ] Generate optimized versions (thumbnail, @2x retina)
  - [ ] Add file picker UI (drag-and-drop support)
  - [ ] Image preview before upload
- [ ] Dark mode logo variant support

### 6A.3 Component Library ✅ (CSS Complete, JS Pending)

**Status: CSS components complete, JS modules not yet created**

Created comprehensive component library in `web/assets/css/components.css`:

**Completed Components (CSS):**
- ✅ **Buttons** - Primary, secondary, outline, ghost, danger variants + sizes (xs, sm, lg, xl)
- ✅ **Badges** - Status badges with semantic colors + dot variant
- ✅ **Cards** - Default, elevated, interactive with header/body/footer
- ✅ **Inputs** - Text, textarea, select with validation states + sizes
- ✅ **Form Groups** - Labels, hints, errors, required indicators
- ✅ **Alerts** - Info, success, warning, error with icons
- ✅ **Avatars** - User avatars with sizes + avatar groups
- ✅ **Tables** - Sortable, striped, with hover states
- ✅ **Tabs** - Horizontal tabs with active state
- ✅ **Dropdown/Menu** - Positioned menus with dividers
- ✅ **Modal** - Backdrop, sizes (sm/lg/xl), header/body/footer
- ✅ **Loading/Spinner** - Spinner with sizes + skeleton loaders
- ✅ **Toast** - Notification toast with slide-in animation
- ✅ **Empty State** - Centered empty state with icon/title/description/CTA
- ✅ **Progress Bar** - Progress bar with semantic color variants
- ✅ **Divider** - Horizontal/vertical dividers with optional text

**Pending:**
- [ ] Create JS modules in `web/assets/js/components/`:
  - [ ] `Modal.js` - Programmatic modal control with focus trap
  - [ ] `Toast.js` - Toast notification system with queue
  - [ ] `Dropdown.js` - Dropdown positioning and click-outside handling
  - [ ] `Table.js` - Sortable/filterable table with pagination
  - [ ] `Tooltip.js` - Tooltip positioning
- [ ] Add illustrations to empty state component
- [ ] Create loading skeletons for admin tables and cards

### 6A.4 Typography & Iconography ✅

**Status: COMPLETE**

**Font Loading:**
- ✅ Inter font family loaded via Google Fonts in all HTML files
- ✅ Optimized with `preconnect` for faster loading
- ✅ Weight range: 400, 500, 600, 700, 800
- ✅ `display=swap` for FOUT prevention

**Icon System:**
- ✅ Lucide Icons integrated via CDN
- ✅ Used in thank-you page (check, clock, home, plus icons)
- ✅ Included in `_template.html` for consistent access
- ✅ Initialized via `lucide.createIcons()`

**Pending:**
- [ ] Standardize icon usage across all pages (currently only on thank-you page)
- [ ] Create icon helper functions for consistent usage

### 6A.5 Runtime Branding System ✅

**Status: COMPLETE**

Created dual branding system:

**BrandingLoader.js** (`web/assets/js/branding-loader.js`):
- ✅ Fetches branding config from `/api/branding/config.php`
- ✅ Applies CSS custom properties at runtime
- ✅ Local storage caching (5 min TTL)
- ✅ Cache-first strategy for instant page load
- ✅ Exposes `window.GKPBranding` API:
  - `load()` - Load branding with cache
  - `refresh()` - Force refresh (bypass cache)
  - `clearCache()` - Clear cached branding
- ✅ Auto-loads on DOMContentLoaded
- ✅ Updates favicon dynamically
- ✅ Dispatches `brandingLoaded` event for components

**Branding.js** (`web/assets/js/branding.js`):
- ✅ Fetches full tenant config from `/api/config.php`
- ✅ Applies CSS variables (colors, fonts)
- ✅ Populates header/footer with org details
- ✅ Updates page title with org name
- ✅ Provides config access API:
  - `init()` - Initialize branding
  - `getConfig()` - Get current config
  - `term(key, fallback)` - Get terminology term
  - `featureEnabled(path, default)` - Check feature flags
- ✅ Hex to RGB conversion for `rgba()` usage

### 6A.6 Summary ✅

**Completion Status: 100%**

| Task | Status | Notes |
|------|--------|-------|
| Design tokens CSS | ✅ Complete | Comprehensive 360+ line token system |
| Theme CSS mapping | ✅ Complete | Backward compatibility + utilities |
| Component library CSS | ✅ Complete | 16 components, 1000+ lines |
| Component library JS | ✅ Complete | Toast, Modal, Dropdown, FileUpload, SkeletonLoader |
| Branding API | ✅ Complete | Settings integration working |
| Admin branding UI | ✅ Complete | Color picker, live preview, file upload ready |
| BrandingLoader.js | ✅ Complete | Runtime CSS injection with caching |
| Branding.js | ✅ Complete | Config access and application |
| Inter font | ✅ Complete | Loaded in all pages with optimization |
| Lucide icons | ✅ Complete | Integrated via CDN |
| File upload | ✅ Complete | Upload endpoint + FileUpload component |
| Loading skeletons | ✅ Complete | SkeletonLoader component with 6 variants |
| Toast JS system | ✅ Complete | Full notification system with queue |
| Design system docs | ✅ Complete | Comprehensive DESIGN_SYSTEM.md (27 pages) |

**Files Created in Phase 6A:**

| File | Lines | Purpose |
|------|-------|---------|
| `web/assets/css/design-tokens.css` | 364 | CSS custom properties foundation |
| `web/assets/css/theme.css` | 179 | Semantic variable mapping |
| `web/assets/css/components.css` | 1007 | Component library styles |
| `web/assets/js/branding-loader.js` | 150 | Runtime CSS injection |
| `web/assets/js/branding.js` | 299 | Config access and branding |
| `web/assets/js/components/Toast.js` | 315 | Toast notification system |
| `web/assets/js/components/Modal.js` | 427 | Modal dialog component |
| `web/assets/js/components/Dropdown.js` | 349 | Dropdown menu component |
| `web/assets/js/components/FileUpload.js` | 383 | File upload with drag-drop |
| `web/assets/js/components/SkeletonLoader.js` | 214 | Loading placeholders |
| `web/api/branding/config.php` | 48 | Branding configuration API |
| `web/api/upload/image.php` | 184 | Image upload endpoint |
| `DESIGN_SYSTEM.md` | 789 | Complete design system docs |

**Total: 4,708 lines of production-ready code**

---

## Phase 6A.5: Site Shell & Visual Refresh ✅

**Priority: High | Effort: Medium | Status: COMPLETE**

> The design system foundation is in place. Now apply it to transform the site's visual appearance from functional to professional.

### 6A.5.1 Header Redesign ✅

**Status: COMPLETE**

Implemented modern header (`web/_fragments/header.html`):
- ✅ Gradient background using brand colors
- ✅ Logo with fallback to trophy icon
- ✅ Clean borderless navigation links with hover underline effect
- ✅ Mobile hamburger menu with slide-out drawer
- ✅ Sticky positioning
- ✅ Lucide icons for navigation items
- ✅ `brandingLoaded` event listener for dynamic branding updates

### 6A.5.2 Footer Redesign ✅

**Status: COMPLETE**

Implemented professional multi-column footer (`web/_fragments/footer.html`):
- ✅ 3-column grid layout (brand, quick links, support)
- ✅ Logo with fallback to trophy icon
- ✅ Organization name and tagline
- ✅ Quick links with Lucide icons
- ✅ Support section with contact and trust badges
- ✅ Bottom bar with copyright (dynamic year) and "Powered by" attribution
- ✅ Responsive grid (1 column mobile → 2 tablet → 3 desktop)
- ✅ Dark theme (neutral-900 background)
- ✅ `brandingLoaded` event listener for dynamic branding updates

### 6A.5.3 Landing Page Hero ✅

**Status: COMPLETE**

Implemented compelling hero section (`web/index.html`):
- ✅ Gradient background with subtle pattern overlay
- ✅ "Registration Open" badge with animated dot
- ✅ Dynamic title from branding settings
- ✅ Tagline with CTA button
- ✅ Competition card with image, meta, and register button
- ✅ Features grid (Quick Registration, Secure Payments, Instant Confirmation)
- ✅ Responsive layout across all breakpoints
- ✅ `brandingLoaded` event listener for dynamic updates

### 6A.5.4 Competition Card Component ✅

**Status: COMPLETE**

Created reusable competition card styles:
- ✅ Card with image, body, meta, and footer sections
- ✅ Meta items with icons (location, date, deadline)
- ✅ Hover effects with elevation change
- ✅ Register button with brand colors
- ✅ Responsive image sizing

### 6A.5.5 Page Redesigns ✅

**Status: COMPLETE**

All public pages redesigned with consistent styling:

**Register Page (`web/register.html`):**
- ✅ Page header with gradient background
- ✅ Form cards with headers and sections
- ✅ Consistent spacing and typography
- ✅ Design tokens integration

**Payment Page (`web/payment.html`):**
- ✅ Page header with gradient background
- ✅ Payment cards with order summary
- ✅ Provider-specific button styling
- ✅ Secure payment badges

**Thank You Page (`web/thank-you.html`):**
- ✅ Success card with icon and message
- ✅ Registration ID display
- ✅ Action buttons (Home, Register Another)
- ✅ Pending payment state support

### 6A.5.6 Visual Polish ✅

**Status: COMPLETE**

Applied consistent styling throughout:
- ✅ **Transitions**: Subtle hover/focus animations (150-200ms)
- ✅ **Shadows**: Consistent elevation system (sm, md, lg)
- ✅ **Border radius**: Consistent rounding (lg for cards, md for buttons)
- ✅ **Color usage**: Primary for CTAs, neutral for structure
- ✅ **Typography**: Clear hierarchy (headings, body, captions)
- ✅ **Spacing**: Consistent vertical rhythm using spacing scale

### 6A.5.7 Tasks

- [x] Update header fragment (`web/_fragments/header.html`) with modern design
- [x] Build mobile navigation drawer with slide-out animation
- [x] Update footer fragment (`web/_fragments/footer.html`) with multi-column layout
- [x] Ensure branding settings apply to header/footer components
- [x] Redesign payment page (`web/payment.html`)
- [x] Redesign landing page hero section
- [x] Create competition card component
- [x] Update register page visual design
- [x] Update thank-you page visual design
- [x] Add page transition animations (via CSS transitions on interactive elements)
- [x] Responsive behavior verified across breakpoints

---

## Phase 6B: Registration Flow Redesign

**Priority: High | Effort: High | Status: COMPLETE**

> Based on e-commerce checkout UX research: 35% conversion increase possible from UX improvements. The "one thing per page" pattern reduces cognitive load. Multi-step forms with progress indicators increase completion rates.

### 6B.0 Completed Items (Foundation)

- ✅ Progress stepper CSS component (`.progress-stepper`, `.progress-step`, `.progress-connector`)
- ✅ Step states: inactive, active, completed (with checkmark icon)
- ✅ Mobile responsive stepper (labels hidden on small screens)
- ✅ Registration form CSS classes (`.reg-form-card`, `.reg-form-input`, etc.)
- ✅ Event options responsive grid styling
- ✅ Cost summary styling

### 6B.1 Multi-Step Wizard Architecture (TODO)

```
Registration Flow (5 steps)
═══════════════════════════════════════════════════════════════

Step 1: PARTICIPANT
┌─────────────────────────────────────────────────────────────┐
│  ● Participant → ○ Coach → ○ Events → ○ Extras → ○ Review  │
│  ━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                             │
│  Who's competing today?                                     │
│                                                             │
│  [First Name]              [Last Name]                      │
│  [Date of Birth]           → Auto-shows: "Age Division: 7-9"│
│  [Gender ▼]                                                 │
│                                                             │
│  Contact Information                                        │
│  [Email]                   [Phone]                          │
│                                                             │
│                            [Continue →]                     │
│                                                             │
│  💾 Your progress is automatically saved                    │
└─────────────────────────────────────────────────────────────┘

Step 2: COACH & TEAM (conditional fields)
┌─────────────────────────────────────────────────────────────┐
│  ✓ Participant → ● Coach → ○ Events → ○ Extras → ○ Review  │
│                                                             │
│  Who's your coach?                                          │
│                                                             │
│  [Search or select coach ▼]                                 │
│    ├── Sarah Johnson (SJ) - Premier Twirlers               │
│    ├── Mike Chen (MC) - Starlight Academy                  │
│    └── + Add new coach                                      │
│                                                             │
│  Team/Studio Name (optional)                                │
│  [Team name]                                                │
│                                                             │
│                   [← Back]    [Continue →]                  │
└─────────────────────────────────────────────────────────────┘

Step 3: EVENTS (categorized selection)
┌─────────────────────────────────────────────────────────────┐
│  ✓ Participant → ✓ Coach → ● Events → ○ Extras → ○ Review  │
│                                                             │
│  Select events for Emma (7-9 Division)                      │
│                                                             │
│  SOLO EVENTS                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] Basic Strut                              $15.00 │   │
│  │ [✓] Fancy Strut                              $20.00 │   │
│  │ [ ] Military Strut                           $20.00 │   │
│  │ [✓] Solo Twirl                               $25.00 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  SPECIALTY EVENTS                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [ ] 2-Baton                                  $25.00 │   │
│  │ [ ] Dance Twirl                              $25.00 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Selected: 3 events                        Subtotal: $60.00 │
│                                                             │
│                   [← Back]    [Continue →]                  │
└─────────────────────────────────────────────────────────────┘

Step 4: EXTRAS (add-ons)
┌─────────────────────────────────────────────────────────────┐
│  ✓ Participant → ✓ Coach → ✓ Events → ● Extras → ○ Review  │
│                                                             │
│  Add extras (optional)                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎽 Competition T-Shirt                              │   │
│  │    Youth sizes available                     $18.00 │   │
│  │    [Select size ▼]  [ ] Add to order               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📸 Photo Package                                    │   │
│  │    Professional action shots                 $35.00 │   │
│  │    [ ] Add to order                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                   [← Back]    [Continue →]                  │
└─────────────────────────────────────────────────────────────┘

Step 5: REVIEW & PAY
┌─────────────────────────────────────────────────────────────┐
│  ✓ Participant → ✓ Coach → ✓ Events → ✓ Extras → ● Review  │
│                                                             │
│  Review your registration                                   │
│                                                             │
│  PARTICIPANT                                    [Edit ✎]   │
│  Emma Johnson (Age 8, 7-9 Division)                         │
│  emma.parent@email.com • (555) 123-4567                     │
│                                                             │
│  COACH                                          [Edit ✎]   │
│  Sarah Johnson (SJ) - Premier Twirlers                      │
│                                                             │
│  EVENTS                                         [Edit ✎]   │
│  • Basic Strut ................ $15.00                      │
│  • Fancy Strut ................ $20.00                      │
│  • Solo Twirl ................. $25.00                      │
│                         Subtotal: $60.00                    │
│                      Facility Fee: $10.00                   │
│  ─────────────────────────────────────                      │
│                            TOTAL: $70.00                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [💳 Pay with Card]  [PayPal]  [Pay Later]          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  By registering, you agree to the competition rules.        │
└─────────────────────────────────────────────────────────────┘
```

### 6B.2 Mobile-First Design

- Card-based "one question per screen" on mobile
- Larger touch targets (min 44px)
- Sticky bottom navigation bar
- Swipe gestures for back/forward (optional)
- Auto-scroll to errors

### 6B.3 Smart Form Features

- **Auto-save**: Save progress to localStorage, resume later
- **Age auto-calculation**: Show division immediately when DOB entered
- **Coach search**: Typeahead with recent/popular coaches
- **Event categories**: Collapsible sections, "select all in category"
- **Running total**: Always visible price summary
- **Inline validation**: Check fields as user types
- **Error recovery**: Clear error messages with fix suggestions

### 6B.4 Tasks

**Foundation (Complete):**
- [x] Create ProgressIndicator/stepper CSS component
- [x] Registration form styling classes
- [x] Event grid responsive layout

**Wizard Architecture (Complete):**
- [x] Design wizard step state management (JS module)
- [x] Split register.html into 5 step templates/views
- [x] Build step navigation (back/forward/jump to step)
- [x] Create WizardController.js to manage step transitions
- [x] Implement URL-based step tracking (`?step=participant`)

**Step 1 - Participant:**
- [x] Isolate participant fields into Step 1 view
- [x] Auto-calculate age division when DOB entered
- [x] Inline validation on field blur

**Step 2 - Coach & Team:**
- [x] Coach selection with checkboxes (multi-select)
- [x] "Other coach" inline option
- [x] Team name field

**Step 3 - Events:**
- [x] Categorized event selection (grouped by category/sub-group)
- [x] Running subtotal display
- [x] Responsive two-column grid on desktop

**Step 4 - Extras:**
- [x] Optional add-on cards with checkbox
- [x] Facility fee information display

**Step 5 - Review & Pay:**
- [x] Summary cards with [Edit] links back to each step
- [x] Full cost breakdown (subtotal, add-ons, fees, total)
- [x] Proceeds to payment page on submit

**Cross-Cutting:**
- [x] Implement auto-save to localStorage via WizardController
- [x] Add form validation with inline error display
- [x] Create mobile-responsive wizard layout
- [x] Mobile sticky footer with total and Continue button
- [x] Desktop sidebar with running total visible on all steps
- [ ] Add "Register Another" flow for families (deferred)
- [ ] A/B test single-page vs multi-step (deferred)

---

## Phase 6C: Admin Console Redesign

**Priority: High | Effort: High | Status: COMPLETE**

> Inspired by Linear's minimal, keyboard-first design and Stripe's clean dashboard. Surface key metrics first. Use empty states to guide new users.

### 6C.0 Admin Sidebar Navigation ✅

**Status: COMPLETE**

Implemented modern sidebar navigation (`web/admin/index.html`):
- ✅ Fixed 260px sidebar with dark theme (neutral-900)
- ✅ Organization branding header with logo and name
- ✅ Grouped navigation sections:
  - Dashboard: Overview
  - Registrations: All Registrants, Edit Registrant
  - Competition: Current Event, Event Options
  - Reports: Reports & Exports
  - Settings (standalone)
- ✅ "View Public Site" link in sidebar footer
- ✅ Top bar with page title and competition selector
- ✅ Mobile responsive with hamburger toggle and slide-out drawer
- ✅ Overlay backdrop for mobile navigation
- ✅ URL parameter sync (`?tab=registrants`)
- ✅ Competition dropdown sync between top bar and Event tab
- ✅ `brandingLoaded` event listener for dynamic branding

### 6C.1 Dashboard Home (New)

Replace current overview with a proper dashboard:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ☰  GKP Events Admin                         [?] [Settings] [Logout] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Spring Competition 2026                    [Change competition ▼]   │
│  March 15, 2026 • Registration closes in 12 days                     │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │       72       │  │    $5,280      │  │      85%       │         │
│  │  Registrations │  │    Revenue     │  │   Paid Rate    │         │
│  │   ↑ 8 today    │  │  ↑ $640 today  │  │   61 of 72     │         │
│  │   [View all →] │  │  [Report →]    │  │   [11 pending] │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│                                                                      │
│  ┌─────────────────────────────────────┬────────────────────────┐   │
│  │ RECENT REGISTRATIONS                │ EVENTS BREAKDOWN       │   │
│  │                                     │                        │   │
│  │  Emma Johnson         2 min ago     │ ████████░░ Solo    45  │   │
│  │  7-9 • Solo, Fancy    $45 ● Paid    │ ██████░░░░ Strut   32  │   │
│  │                                     │ ████░░░░░░ Dance   22  │   │
│  │  Olivia Smith         15 min ago    │ ██░░░░░░░░ Model   12  │   │
│  │  10-12 • Basic        $25 ○ Pending │                        │   │
│  │                                     │                        │   │
│  │  [View all registrations →]         │ [Full breakdown →]     │   │
│  └─────────────────────────────────────┴────────────────────────┘   │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  [📋 Registrations] [🎯 Events] [👥 Coaches] [📊 Reports] [⚙ Settings]│
└──────────────────────────────────────────────────────────────────────┘
```

### 6C.2 Empty States

When no data exists, guide the user:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                        [illustration]                           │
│                                                                 │
│                   No registrations yet                          │
│                                                                 │
│  Registrations will appear here once participants sign up.      │
│  Share your registration link to get started.                   │
│                                                                 │
│  Registration URL:                                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ https://yoursite.com/register?c=spring2026    [Copy 📋]  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Preview Registration Page →]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6C.3 Keyboard Navigation

Linear-inspired keyboard shortcuts for power users:

| Shortcut | Action |
|----------|--------|
| `g` then `r` | Go to Registrations |
| `g` then `e` | Go to Events |
| `g` then `c` | Go to Coaches |
| `g` then `s` | Go to Settings |
| `j` / `k` | Move down/up in lists |
| `Enter` | Open selected item |
| `e` | Edit selected item |
| `d` | Delete (with confirmation) |
| `/` | Focus search |
| `?` | Show keyboard shortcuts |
| `Esc` | Close modal/cancel |

### 6C.4 Data Tables Redesign

```
┌─────────────────────────────────────────────────────────────────────┐
│ Registrations                                          72 total     │
├─────────────────────────────────────────────────────────────────────┤
│ [🔍 Search...]  [Age: All ▼]  [Status: All ▼]  [Coach: All ▼]      │
├─────────────────────────────────────────────────────────────────────┤
│ [ ] │ Name           │ Age  │ Events        │ Total  │ Status │ ⋮  │
│─────┼────────────────┼──────┼───────────────┼────────┼────────┼────│
│ [ ] │ Emma Johnson   │ 7-9  │ Solo, Fancy   │ $45.00 │ ● Paid │ ⋮  │
│ [✓] │ Olivia Smith   │10-12 │ Basic, Model  │ $35.00 │○ Pend… │ ⋮  │
│ [ ] │ Sophia Brown   │ 6&U  │ Solo          │ $25.00 │ ● Paid │ ⋮  │
├─────────────────────────────────────────────────────────────────────┤
│ [With 1 selected: Mark Paid ▼]     Showing 1-25 of 72  [< 1 2 3 >] │
└─────────────────────────────────────────────────────────────────────┘
```

Features:
- Sortable columns (click header)
- Bulk actions (select multiple)
- Inline quick actions menu (⋮)
- Pagination with page size selector
- Persistent filter state in URL

### 6C.5 Tasks

- [x] Implement sidebar navigation layout
- [x] Create navigation sections with Lucide icons
- [x] Build mobile responsive sidebar with slide-out drawer
- [x] Sync competition dropdown between sidebar and Event tab
- [x] Design new dashboard layout with metric cards
- [x] Create Stat/MetricCard component (CSS + JS)
- [x] Build empty state components with copy URL feature
- [x] Implement keyboard navigation system (g+key, ?, Escape)
- [x] Add command palette (Cmd+K) for quick navigation
- [x] Redesign data tables with sorting/filtering
- [x] Add bulk actions to registrations table
- [x] Fix admin tab switching (CSS display property conflicts)
- [x] Fix Edit Registrants scrollable layout (flex with fixed header)
- [x] Fix empty state single source of truth (dashboard vs registrants module)
- [x] Align Current Event buttons with competition dropdown
- [x] Fix Event Options "Select All" checkbox column alignment
- [x] Add explanatory help text for table columns
- [x] Implement URL-based filter persistence
- [x] Add real-time updates (polling with visual indicator)
- [x] Create loading skeletons for all sections
- [x] Add "Quick Actions" dropdown in header

---

## Phase 6D: Code Restructuring & Performance ✅

**Priority: Medium | Effort: High | Status: COMPLETE**

### 6D.1 JavaScript Architecture ✅ COMPLETE

```
/web/assets/js/
├── /lib/                      # Core utilities
│   ├── api.js                 # Fetch wrapper with auth, error handling
│   ├── store.js               # Simple state management
│   ├── router.js              # Client-side routing (admin SPA)
│   ├── validators.js          # Form validation rules
│   └── formatters.js          # Date, currency, phone formatting
│
├── /components/               # Reusable UI components
│   ├── Button.js
│   ├── Modal.js
│   ├── Toast.js
│   ├── DataTable.js
│   ├── ProgressBar.js
│   └── ...
│
├── /pages/                    # Page controllers
│   ├── home.js
│   ├── register.js
│   ├── payment.js
│   └── thank-you.js
│
├── /admin/                    # Admin modules
│   ├── app.js                 # Admin app entry point
│   ├── /tabs/
│   │   ├── dashboard.js
│   │   ├── registrants.js
│   │   ├── events.js
│   │   ├── coaches.js
│   │   ├── reports.js
│   │   └── settings.js
│   └── /components/
│       └── ... admin-specific components
│
└── branding.js                # Runtime CSS variable injection
```

### 6D.2 PHP Architecture ✅ COMPLETE

```
/server/
├── /lib/
│   ├── Env.php                # Environment loader ✅
│   ├── Database.php           # PDO wrapper with helpers ✅
│   ├── Settings.php           # Settings manager ✅
│   ├── Encryption.php         # AES encryption ✅
│   ├── Features.php           # Feature flags ✅
│   ├── Validator.php          # Input validation ✅
│   ├── Response.php           # JSON response helpers ✅
│   │
│   ├── /PaymentProvider/      # Payment providers ✅
│   │   ├── PaymentProviderInterface.php
│   │   ├── AbstractPaymentProvider.php
│   │   ├── PaymentProviderFactory.php
│   │   ├── StripeProvider.php
│   │   ├── PayPalProvider.php
│   │   ├── SquareProvider.php
│   │   └── ManualProvider.php
│   │
│   └── /Branding/
│       └── BrandingService.php  # Load & cache brand settings ✅
│
├── /migrations/
│   └── ...
│
└── autoload.php               # PSR-4 autoloader ✅
```

### 6D.3 Performance Optimizations ✅ COMPLETE

**Database:**
- [x] Add indexes: `registrations(competition_id)`, `registrations(created_at)`, `coaches(is_active)` ✅
- [x] Implement pagination (25/50/100 per page) ✅
- [x] Schema cache to eliminate SHOW COLUMNS queries (12+ → 1 query) ✅
- [ ] Add query result caching with Redis/APCu (if available) — deferred
- [x] Optimize N+1 queries in list endpoints ✅

**Frontend:**
- [x] Lazy load admin tabs (load data on tab switch) ✅
- [ ] Implement virtual scrolling for large lists — deferred
- [x] Add debounce to search inputs ✅ (already implemented)
- [ ] Minify JS/CSS for production — deferred (build pipeline)
- [x] Enable gzip compression (.htaccess for Apache) ✅
- [x] Use `loading="lazy"` for images ✅

**API:**
- [x] Add ETag caching for config endpoints ✅
- [x] Implement response compression (Response.php + .htaccess) ✅
- [x] Add rate limiting (10 req/min per IP on register.php) ✅

### 6D.4 Tasks

- [x] Create PSR-4 autoloader for PHP ✅
- [x] Create JS lib modules (api, store, router, validators, formatters) ✅
- [x] Create central API client with error handling ✅
- [x] Create PHP utility classes (Database, Validator, Response, BrandingService) ✅
- [ ] Add TypeScript types (JSDoc or .d.ts files) — deferred
- [x] Implement lazy loading for admin tabs ✅
- [x] Add database indexes (migration 007) ✅
- [ ] Set up build pipeline (esbuild or Vite) — deferred
- [ ] Add source maps for debugging — deferred
- [x] Implement pagination on admin-list endpoint ✅
- [x] Add response caching headers (ETag) ✅
- [x] Create SchemaCache.php for column existence checks ✅
- [x] Create RateLimiter.php for IP-based rate limiting ✅
- [x] Add .htaccess for Apache compression/caching ✅

### 6D.5 JavaScript Library (Completed)

**Created `/web/assets/js/lib/` modules:**

| File | Purpose |
|------|---------|
| `api.js` | Central API client with error handling, resource methods |
| `store.js` | Simple reactive state management with subscriptions |
| `router.js` | Client-side hash routing for SPA navigation |
| `validators.js` | Form validation rules (required, email, minLength, etc.) |
| `formatters.js` | Formatting utilities (money, date, phone, escapeHtml) |
| `FormBuilder.js` | Dynamic form renderer (from Phase 3) |
| `WizardController.js` | Multi-step wizard state management (from Phase 6B) |

**Files updated to use API client:**
- `admin.js` - Imports api, configures error handler, polling uses `api.registrations.list()`
- `register.js` - Uses `window.api.registrations.getConfig()`
- `home.js` - Uses `window.api.competitions.getPublic()`
- `branding.js` - Uses `window.api.config.app()`
- `branding-loader.js` - Uses `window.api.config.branding()`
- `editRegistrants.js` - Uses api for all CRUD operations

### 6D.6 PHP Library (Completed)

**Created `/server/lib/` classes:**

| File | Purpose |
|------|---------|
| `Database.php` | PDO singleton with helper methods (fetchAll, insert, transaction) |
| `Response.php` | JSON response helpers (success, error, paginated, validationError) |
| `Validator.php` | Fluent input validation (required, email, min, pattern, etc.) |
| `Branding/BrandingService.php` | Load/cache branding config, generate CSS variables |
| `autoload.php` | PSR-4 compatible class autoloader |

**Existing classes (from earlier phases):**
- `Env.php` - Environment variable loader
- `Settings.php` - Database settings manager with encryption
- `Encryption.php` - AES-256 encryption for sensitive values
- `Features.php` - Feature flag management
- `PaymentProvider/*` - Payment provider abstraction layer

### 6D.7 Performance Files (Feb 2026)

**New PHP classes created:**

| File | Purpose |
|------|---------|
| `server/lib/SchemaCache.php` | Caches column existence checks (1 query vs 12+) |
| `server/lib/RateLimiter.php` | File-based token bucket rate limiting |
| `server/migrations/007_add_performance_indexes.sql` | Database indexes for common queries |
| `web/.htaccess` | Apache gzip compression, caching headers, security headers |

**Files modified:**

| File | Changes |
|------|---------|
| `web/api/admin-list.php` | Uses SchemaCache, adds pagination support |
| `web/api/config.php` | ETag caching with 304 Not Modified |
| `web/api/fields.php` | ETag caching with 304 Not Modified |
| `web/api/branding/config.php` | ETag caching with 304 Not Modified |
| `web/api/register.php` | Rate limiting (10 req/min per IP) |
| `server/lib/Response.php` | Gzip compression for responses > 1KB |
| `web/assets/js/admin/tabs/dataTable.js` | Pagination UI controls |
| `web/assets/js/admin/tabs/registrants.js` | Pagination data handling |
| `web/assets/js/lib/api.js` | Pagination params for registrations.list() |
| `web/assets/js/admin.js` | Lazy tab loading with invalidation |
| `web/admin/index.html` | Pagination container element |
| `web/index.html` | Image lazy loading attribute |
| `web/assets/css/custom.css` | Pagination control styles |

---

## Phase 6E: Security & Quality ✅

**Priority: Medium | Effort: Medium | Status: COMPLETE**

### 6E.1 Security Hardening ✅

- [x] Replace Basic Auth with session-based authentication
  - `server/lib/Session.php` — 8-hour sessions, secure cookies, session ID regeneration
  - `web/api/auth/login.php` — POST login with rate limiting (5/15min per IP)
  - `web/api/auth/logout.php` — POST logout
  - `web/api/auth/check.php` — GET auth status
  - `web/admin/login.html` — Login page UI
  - Backward compatible: Basic Auth still works as fallback
- [x] Add CSRF tokens to all forms
  - `server/lib/Csrf.php` — Token generation/validation via X-CSRF-Token header
  - `web/assets/js/lib/api.js` — Auto-includes CSRF header on POST/PUT/DELETE
  - `require_admin_auth_with_csrf()` function for protected endpoints
- [x] Implement Content Security Policy headers
  - Added to `web/.htaccess`
  - Note: 'unsafe-inline' required for existing inline styles/scripts
- [x] Add rate limiting on auth endpoints
  - Login: 5 attempts per 15 minutes per IP
- [x] Audit for SQL injection (parameterized queries) — already good throughout
- [x] Add audit logging for admin actions
  - `server/lib/AuditLog.php` — Logs login/logout, competition/registration changes
  - `server/migrations/009_audit_log.sql` — audit_log table
- [x] Bcrypt password hashing
  - `server/hash-password.php` — CLI tool to generate hashes
  - `ADMIN_PASS_HASH` env var (plaintext `ADMIN_PASS` deprecated)
- [ ] Implement secure password reset flow — deferred (no user accounts exist)

### 6E.2 Error Handling ✅

- [x] Create consistent error response format
  - All errors include `request_id` for correlation
  - `server/lib/Response.php` — Added `getRequestId()` method
- [x] Log errors to file with rotation
  - `server/lib/Logger.php` — PSR-3 compatible, daily rotation, 10MB max size
- [ ] Add frontend global error handler — existing onError handler sufficient
- [ ] Create user-friendly error pages (404, 500) — deferred
- [ ] Add error reporting to admin dashboard — deferred

### 6E.3 Testing ✅

- [x] Set up PHPUnit for API endpoint tests
  - `composer.json` — PHPUnit 10.5 dev dependency
  - `phpunit.xml` — Configuration
  - `tests/bootstrap.php` — Test environment setup
  - `tests/API/AuthTest.php` — Auth endpoint tests
  - `tests/Unit/CsrfTest.php` — CSRF unit tests
  - `tests/Unit/ResponseTest.php` — Response unit tests
- [ ] Write tests for payment flow — deferred (ongoing work)
- [ ] Set up Jest for frontend unit tests — deferred
- [ ] Write tests for form validation — deferred
- [ ] Add Playwright E2E tests for critical flows — deferred
- [ ] Set up CI pipeline (GitHub Actions) — deferred

**Files Created:**
| File | Purpose |
|------|---------|
| `server/lib/Session.php` | Session management with secure config |
| `server/lib/Csrf.php` | CSRF token generation/validation |
| `server/lib/AuditLog.php` | Audit trail logger |
| `server/lib/Logger.php` | File-based logging with rotation |
| `server/hash-password.php` | CLI tool to generate bcrypt hashes |
| `server/migrations/009_audit_log.sql` | Audit log table |
| `web/api/auth/login.php` | Login endpoint |
| `web/api/auth/logout.php` | Logout endpoint |
| `web/api/auth/check.php` | Auth status check |
| `web/admin/login.html` | Login page UI |
| `composer.json` | PHPUnit dev dependency |
| `phpunit.xml` | PHPUnit configuration |
| `tests/bootstrap.php` | Test environment setup |
| `tests/API/AuthTest.php` | Auth endpoint tests |

**Files Modified:**
| File | Changes |
|------|---------|
| `.env.example` | Added ADMIN_PASS_HASH |
| `server/config.php` | Load pass_hash from env |
| `web/api/admin_auth.php` | Session auth + CSRF validation |
| `web/api/util.php` | CORS with credentials support |
| `web/.htaccess` | Added CSP header |
| `web/assets/js/lib/api.js` | Auth methods, CSRF header |
| `web/admin/index.html` | Auth check, logout link |
| `server/lib/Response.php` | Request ID in errors |

---

## Phase 6F: Home Page Enhancements

**Priority: Medium | Effort: Low**

> Currently the home page only displays the single active competition. Organizations often want to showcase upcoming competitions to build anticipation and allow early planning.

### 6F.1 Multi-Competition Display ✅

**Status: COMPLETE (February 4, 2026)**

Display multiple competitions on the home page while maintaining "active" status for registration:

```
┌──────────────────────────────────────────────────────────────────────┐
│  UPCOMING COMPETITIONS                                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ [IMAGE]                                                        │ │
│  │ Spring Competition 2026                    ● REGISTRATION OPEN │ │
│  │ March 15-17, 2026 • Tampa Convention Center                    │ │
│  │ Registration deadline: March 1, 2026                           │ │
│  │                                        [Register Now →]        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ [IMAGE]                                                        │ │
│  │ Summer Twirl Classic 2026                  ○ COMING SOON       │ │
│  │ July 15-17, 2026 • Tampa Convention Center                     │ │
│  │ Registration opens: May 1, 2026                                │ │
│  │                                        [View Details →]        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ [IMAGE]                                                        │ │
│  │ Fall Championship 2026                     ○ COMING SOON       │ │
│  │ October 20-22, 2026 • Orlando Sports Complex                   │ │
│  │ Registration opens: August 1, 2026                             │ │
│  │                                        [View Details →]        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Features:**
- [x] Add `show_on_home` boolean column to competitions table
- [x] Add `display_order` integer column for sorting
- [x] Admin toggle: "Show on home page" checkbox per competition
- [x] Admin number input for display order
- [x] Only one competition can have `is_current = 1` (active for registration)
- [x] Non-active competitions show "Coming Soon" badge
- [x] Non-active competitions show "Registration opens soon" instead of register button
- [x] Competition card shows status badge: "Registration Open", "Coming Soon", "Closed"

**Files Created:**
| File | Purpose |
|------|---------|
| `server/migrations/010_multi_competition_display.sql` | Add show_on_home and display_order columns |
| `web/api/competitions.home.php` | Public endpoint for home page competitions |

**Files Modified:**
| File | Changes |
|------|---------|
| `web/api/competitions.get.php` | Return showOnHome and displayOrder |
| `web/api/competitions.save.php` | Accept/save showOnHome and displayOrder |
| `web/api/competitions.list.php` | Return showOnHome and displayOrder |
| `web/assets/js/lib/api.js` | Add competitions.getHome() method |
| `web/assets/js/admin/tabs/currentEvent.js` | Handle new form fields |
| `web/admin/index.html` | Add checkboxes for home page visibility |
| `web/index.html` | Multi-card grid layout, status badges |
| `web/assets/js/home.js` | Fetch and render multiple competitions |

### 6F.2 Competition Image Upload ✅

**Status: COMPLETE (February 4, 2026)**

- [x] Add `image_url` column to competitions table (migration 008)
- [x] Image upload UI in admin Current Competition tab
- [x] Preview with upload/remove controls
- [x] Security validation (only `/assets/uploads/` paths allowed)
- [x] Dynamic image display on home page with fallback to default
- [x] Backward-compatible PHP (works before/after migration)

**Files Modified:**
- `server/migrations/008_add_competition_image.sql`
- `web/admin/index.html` — image upload field
- `web/assets/css/custom.css` — image upload styles
- `web/assets/js/admin/tabs/currentEvent.js` — upload handling
- `web/api/competitions.save.php` — accept/save image_url
- `web/api/competitions.get.php` — return image_url
- `web/api/competition.public.php` — return image_url
- `web/assets/js/home.js` — display dynamic image
- `web/index.html` — add id to image element

### 6F.3 Future Enhancements

- [ ] Competition details page (for non-active competitions)
- [ ] "Notify me when registration opens" email capture
- [ ] Countdown timer to registration opening
- [ ] Social sharing buttons per competition
- [ ] Past competitions archive section

---

## Phase 7: Community-Driven Features

**Priority: Medium | Effort: High**

> Based on baton twirling community research: The coach-parent-athlete triad is central to the sport. Parents are deeply involved, often multi-generational. Advancement tracking runs on an honor system. Coaches manage multiple athletes across many events.

### 7.1 Coach Portal

Separate authenticated area for coaches to manage their athletes:

```
Coach Portal
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  Welcome back, Sarah Johnson (SJ)                           │
│  Premier Twirlers • 12 active athletes                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  UPCOMING COMPETITIONS                                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Spring Competition 2026        March 15              │ │
│  │ 8 athletes registered          [Register More →]     │ │
│  │                                                       │ │
│  │ Summer Showcase 2026           June 22               │ │
│  │ Registration opens March 1     [Notify Me]           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  MY ATHLETES                                                │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [Search...] [Age ▼] [Level ▼]        [+ Add Athlete] │ │
│  │                                                       │ │
│  │ Emma Johnson      7-9    Intermediate    8 events    │ │
│  │ Olivia Smith      10-12  Advanced        12 events   │ │
│  │ Sophia Brown      6&U    Beginner        3 events    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [📋 My Athletes] [🏆 Registrations] [📊 Win Tracking]     │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Bulk registration (register multiple athletes at once)
- Athlete roster management
- Registration history by athlete
- Team/group registration support
- Exportable roster for competition day

### 7.2 Family Accounts

Support parents registering multiple children:

```
Family Registration Flow
═══════════════════════════════════════════════════════════════

Step 1: CREATE/LOGIN FAMILY ACCOUNT
┌─────────────────────────────────────────────────────────────┐
│  Register your family                                       │
│                                                             │
│  Parent/Guardian Information                                │
│  [Name]  [Email]  [Phone]                                  │
│                                                             │
│  Your Athletes                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Emma Johnson         Age 8       [Edit] [Remove]      │ │
│  │ Lily Johnson         Age 6       [Edit] [Remove]      │ │
│  │                                                       │ │
│  │ [+ Add Another Child]                                 │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 💰 SIBLING DISCOUNT                                   │ │
│  │ 10% off facility fees for 2nd child                   │ │
│  │ 15% off facility fees for 3rd+ child                  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Step 2: REGISTER FOR COMPETITION
┌─────────────────────────────────────────────────────────────┐
│  Spring Competition 2026                                    │
│                                                             │
│  Select athletes to register:                               │
│  [✓] Emma Johnson (8) — 7-9 Division                       │
│  [✓] Lily Johnson (6) — 6 & Under Division                 │
│                                                             │
│  [Continue to Event Selection →]                            │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Parent account with multiple children
- Sibling discount automation
- Shared contact info (one entry)
- Registration history across children
- "Register another sibling" quick flow

### 7.3 Win & Advancement Tracking

Help coaches/parents track competitive progress:

```
Athlete Profile: Emma Johnson
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  Emma Johnson                                    Age 8      │
│  7-9 Division • Intermediate Level                          │
│  Coach: Sarah Johnson (SJ)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ADVANCEMENT PROGRESS                                       │
│                                                             │
│  Solo Twirl (Intermediate → Advanced)                       │
│  ████████░░░░░░░░░░░░  5 of 12 wins                        │
│  Next: 7 more 1st place finishes                           │
│                                                             │
│  Basic Strut (Intermediate → Advanced)                      │
│  ████████████░░░░░░░░  8 of 12 wins                        │
│  Next: 4 more 1st place finishes                           │
│                                                             │
│  Fancy Strut (Beginner → Intermediate)                      │
│  ████████████████████  ✓ COMPLETE                          │
│  Advanced to Intermediate on 2/15/2026                      │
│                                                             │
│  ──────────────────────────────────────────────────────────│
│                                                             │
│  COMPETITION HISTORY                           [Export →]   │
│                                                             │
│  Feb 15, 2026 — Winter Classic                             │
│  • Solo Twirl: 1st (counted)                               │
│  • Basic Strut: 2nd                                        │
│  • Fancy Strut: 1st (advancement achieved!)                │
│                                                             │
│  Jan 20, 2026 — New Year Invitational                      │
│  • Solo Twirl: 1st (counted)                               │
│  • Basic Strut: 1st (counted)                              │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Track wins by event type
- Support multiple organization rules (NBTA, USTA, TU, AAU)
- Visual progress toward advancement
- Competition history log
- Exportable records
- Manual entry for external competitions

### 7.4 Competition Day Features

Tools for event-day operations:

**Check-in System:**
```
Check-In Dashboard (Admin/Coach View)
═══════════════════════════════════════════════════════════════

Spring Competition 2026 — Check-In

[🔍 Search by name or coach...]

AWAITING CHECK-IN (24)
┌─────────────────────────────────────────────────────────────┐
│ [ ] Emma Johnson      SJ    7-9    Solo, Strut    [Check In]│
│ [ ] Olivia Smith      MC    10-12  Basic, Model   [Check In]│
│ [ ] Sophia Brown      SJ    6&U    Solo           [Check In]│
└─────────────────────────────────────────────────────────────┘

CHECKED IN (48)
┌─────────────────────────────────────────────────────────────┐
│ [✓] Madison Lee       SJ    7-9    Solo, Fancy    2:34 PM   │
│ [✓] Ava Garcia        MC    10-12  All Events     2:31 PM   │
└─────────────────────────────────────────────────────────────┘

[Bulk check-in by coach ▼]  [Print check-in sheets]
```

**Schedule View:**
```
Live Schedule — Spring Competition 2026
═══════════════════════════════════════════════════════════════

NOW: Basic Strut — 7-9 Division (Event #14)

COMING UP:
  2:45 PM  Fancy Strut — 6&U       12 competitors
  3:15 PM  Fancy Strut — 7-9       18 competitors
  3:50 PM  Solo Twirl — 6&U        8 competitors

[Subscribe to schedule updates 📱]
```

### 7.5 Tasks

**Coach Portal:**
- [ ] Design coach authentication system
- [ ] Create coach registration/claim flow
- [ ] Build coach dashboard
- [ ] Implement bulk athlete registration
- [ ] Add athlete roster management
- [ ] Create team/group registration flow

**Family Accounts:**
- [ ] Design family account data model
- [ ] Create parent account registration
- [ ] Build multi-child registration flow
- [ ] Implement sibling discount logic
- [ ] Add "register another" quick flow

**Win Tracking:**
- [ ] Design win tracking data model
- [ ] Create athlete profile page
- [ ] Build advancement progress visualization
- [ ] Implement org-specific rules (NBTA, USTA, etc.)
- [ ] Add manual win entry for external competitions
- [ ] Create exportable competition history

**Competition Day:**
- [ ] Build check-in dashboard
- [ ] Add QR code check-in option
- [ ] Create live schedule view
- [ ] Implement push notifications for schedule changes
- [ ] Build coach-specific check-in view

---

## Phase 8: Multi-Tenancy & Onboarding

**Priority: Medium | Effort: High | Timeline: Week 8-10**

### 7.1 Deployment Options

**Option A: Single-Tenant Deployments**
- Each client gets separate installation
- Separate database per client
- Config files customized per deployment
- Simpler but requires more DevOps

**Option B: True Multi-Tenant**
- Single codebase, shared database
- Tenant identification via subdomain or path
- All tables include `tenant_id`
- More complex but easier to maintain

**Recommended: Start with Option A**, migrate to B when demand justifies.

### 7.2 Installation Script

Create automated setup:

```bash
#!/bin/bash
# install.sh

echo "Competition Registration Platform Setup"
echo "========================================"

# Prompt for configuration
read -p "Organization name: " ORG_NAME
read -p "Admin email: " ADMIN_EMAIL
read -sp "Admin password: " ADMIN_PASS

# Generate config files
cp .env.example .env
cp config/tenant.example.json config/tenant.json

# Run database migrations
php server/migrate.php

# Create admin user
php server/create-admin.php "$ADMIN_EMAIL" "$ADMIN_PASS"

echo "Setup complete! Visit /admin to get started."
```

**Tasks:**
- [ ] Create database migration system
- [ ] Create `schema.sql` with full database structure
- [ ] Create `install.sh` script
- [ ] Create web-based setup wizard (alternative)
- [ ] Document manual setup process

### 7.3 Admin Settings UI

Add settings management in admin dashboard:

```
Admin → Settings
├── Organization
│   ├── Name, tagline, contact info
│   └── Logo upload
├── Branding
│   ├── Colors (color pickers)
│   └── Custom CSS
├── Registration
│   ├── Required fields toggle
│   ├── Custom fields manager
│   └── Terms/waiver text
├── Payment
│   ├── Stripe keys
│   └── Fee settings
├── Email
│   ├── SMTP settings
│   └── Template customization
└── Users (future)
    └── Admin user management
```

**Tasks:**
- [ ] Create Settings tab in admin
- [ ] Build color picker component
- [ ] Build logo upload with preview
- [ ] Build field toggle interface
- [ ] Store settings in database (overrides config files)

### 7.4 Documentation

Create comprehensive documentation:

```
/docs/
  README.md              # Quick start
  INSTALLATION.md        # Detailed setup
  CONFIGURATION.md       # All config options
  CUSTOMIZATION.md       # Branding & theming
  API.md                 # API reference
  DEPLOYMENT.md          # Production deployment
  TROUBLESHOOTING.md     # Common issues
  CHANGELOG.md           # Version history
```

---

## Phase 9: Advanced Features

**Priority: Low | Effort: High | Timeline: Future**

### 8.1 User Accounts

Allow registrants to create accounts:

- [ ] User registration and login
- [ ] View registration history
- [ ] Edit upcoming registrations
- [ ] Save payment methods
- [ ] Family/household management (register multiple children)

### 8.2 Email Communications

- [ ] Registration confirmation emails
- [ ] Payment receipt emails
- [ ] Reminder emails (registration deadline approaching)
- [ ] Event update notifications
- [ ] Bulk email to all registrants

### 8.3 Waitlist Management

- [ ] Enable waitlist when event is full
- [ ] Automatic promotion when spot opens
- [ ] Waitlist position notifications

### 8.4 Discount & Promo Codes

- [ ] Percentage discounts
- [ ] Fixed amount discounts
- [ ] Early bird pricing (date-based)
- [ ] Multi-event discounts
- [ ] Family discounts

### 8.5 Advanced Registration Types

- [ ] Duet/Trio registration (link multiple registrants)
- [ ] Team registration
- [ ] Spectator tickets
- [ ] Vendor booth registration

### 8.6 Scheduling & Check-in

- [ ] Generate competition schedule from registrations
- [ ] Mobile check-in app
- [ ] QR code on confirmation for quick check-in
- [ ] Real-time check-in status dashboard

### 8.7 Scoring Integration

- [ ] Judge score entry interface
- [ ] Automatic score tabulation
- [ ] Results display
- [ ] Awards determination

---

## Technical Debt & Cleanup

**Priority: Ongoing | Effort: Low-Medium**

### Immediate Cleanup

- [ ] Remove unused Next.js/React dependencies from package.json
- [ ] Remove `server/db.php` (duplicate of `web/api/db.php`)
- [ ] Standardize date format handling (MySQL DATETIME vs JS Date)
- [ ] Fix inconsistent naming (`coach_name` vs `coach_selections_json`)
- [ ] Add proper HTTP status codes to all API responses
- [ ] Standardize API response format: `{ success: bool, data: any, error: string }`

### Code Quality

- [ ] Add ESLint configuration and fix warnings
- [ ] Add PHP CodeSniffer configuration
- [ ] Set up pre-commit hooks (lint, format)
- [ ] Add TypeScript definitions for better IDE support (optional)

### Database

- [ ] Create proper foreign key constraints
- [ ] Add `updated_at` timestamps to all tables
- [ ] Add soft delete (`deleted_at`) instead of hard delete
- [ ] Normalize coach_name field (migrate to coach_selections_json only)

---

## Pricing Implementation

### Subscription Tiers

Implement tiered access in the application:

```php
// server/lib/Subscription.php
class Subscription {
    const TIER_FREE = 'free';
    const TIER_BASIC = 'basic';
    const TIER_PRO = 'pro';
    const TIER_UNLIMITED = 'unlimited';

    const LIMITS = [
        'free' => [
            'competitions_per_year' => 1,
            'registrations_per_competition' => 25,
            'admin_users' => 1,
            'custom_fields' => 0,
            'reports' => ['registrantList', 'csv'],
            'support' => 'community',
        ],
        'basic' => [
            'competitions_per_year' => 4,
            'registrations_per_competition' => 100,
            'admin_users' => 2,
            'custom_fields' => 3,
            'reports' => ['registrantList', 'csv', 'judgingSheets'],
            'support' => 'email',
        ],
        'pro' => [
            'competitions_per_year' => 12,
            'registrations_per_competition' => 500,
            'admin_users' => 5,
            'custom_fields' => 10,
            'custom_branding' => true,
            'reports' => 'all',
            'support' => 'priority',
        ],
        'unlimited' => [
            'competitions_per_year' => null,
            'registrations_per_competition' => null,
            'admin_users' => null,
            'custom_fields' => null,
            'custom_branding' => true,
            'white_label' => true,
            'api_access' => true,
            'reports' => 'all',
            'support' => 'phone',
        ],
    ];
}
```

### Usage Tracking

- [ ] Track registrations per competition
- [ ] Track competitions per year
- [ ] Display usage in admin dashboard
- [ ] Show upgrade prompts when approaching limits
- [ ] Implement soft limits (warn) vs hard limits (block)

---

## Implementation Priority Summary

| Phase | Priority | Effort | Status |
|-------|----------|--------|--------|
| 1. Configuration Foundation | Critical | Medium | ✅ Complete |
| 2. Branding & Theming | High | Medium | ✅ Complete |
| 3. Form Customization | High | High | ✅ Complete |
| 4. Reporting & Analytics | High | High | ✅ Complete |
| 5. Payment Integration | High | Medium | ✅ Complete |
| 6A. Design System | High | Medium | ✅ Complete |
| 6A.5 Site Shell & Visual Refresh | High | Medium | ✅ Complete |
| 6B. Registration Flow Redesign | High | High | ✅ Complete |
| 6C. Admin Console Redesign | High | High | ✅ Complete |
| 6D. Code Restructuring & Performance | Medium | Medium | ✅ Complete |
| 6E. Security & Quality | Medium | Medium | ⬜ Not Started |
| 6F. Home Page Enhancements | Medium | Low | 🔄 In Progress (6F.2 complete) |
| 7. Community Features | Medium | High | ⬜ Not Started |
| 8-9. Multi-Tenancy & Advanced | Low | High | ⬜ Not Started |

---

## Success Metrics

Track these metrics to measure platform success:

- **Adoption**: Number of organizations using the platform
- **Engagement**: Registrations processed per month
- **Revenue**: MRR (Monthly Recurring Revenue)
- **Retention**: Churn rate (organizations that cancel)
- **Satisfaction**: NPS score from customer surveys
- **Performance**: Average page load time, API response time
- **Reliability**: Uptime percentage, error rate

---

## Next Steps

### Database Migrations ✅

All migrations have been applied:

```bash
# Already run - custom fields storage
php server/run-migration.php 001_add_custom_data_json.sql

# Already run - per-competition field overrides
php server/run-migration.php 002_add_fields_config_json.sql

# Already run - event categories (Solo, Team, Specialty)
php server/run-migration.php 003_add_event_categories.sql

# Already run - event sub-groups (e.g., 2-Baton)
php server/run-migration.php 004_add_event_groups.sql

# Already run - payment provider integration (settings, transactions, payment columns)
php server/run-migration.php 005_payment_provider_integration.sql

# Already run - branding settings (logo, colors, organization name)
php server/run-migration.php 006_branding_settings.sql

# Already run - performance indexes
php server/run-migration.php 007_add_performance_indexes.sql

# Already run - competition image field
php server/run-migration.php 008_add_competition_image.sql
```

---

### Completed

- ✅ **Phase 1**: Configuration Foundation (Env vars, feature flags)
- ✅ **Phase 2**: Branding & Theming (CSS variables, dynamic header/footer)
- ✅ **Phase 3**: Form Customization
  - Field Configuration Schema (`config/fields.json`)
  - Dynamic Form Renderer (`FormBuilder.js`)
  - Custom Fields Support with admin UI
  - Conditional Fields (show field B when field A = X)
  - Event Categories (Solo, Team, Specialty grouping)
  - Event Groups (sub-grouping within categories, e.g., "2-Baton")
  - CSV Export with custom fields
- ✅ **Phase 4**: Reporting & Analytics
  - Financial Summary report
  - Coach Roster report
  - Event Breakdown report
  - Dashboard charts (trends, revenue, age distribution)
  - Enhanced CSV/Excel exports
- ✅ **Phase 5**: Payment Integration
  - Multi-provider architecture (Stripe, PayPal, Square, Manual)
  - Admin Settings tab for provider configuration
  - Encrypted credential storage (AES-256-GCM)
  - Payment tracking (transactions table, status on registrations)
  - Pay Later option for deferred payment
  - Webhook handlers for all providers
- ✅ **Phase 6A**: Design System & Visual Identity
  - Design tokens with 360+ CSS custom properties
  - Component library CSS (16 components: buttons, badges, cards, inputs, modals, etc.)
  - Component library JS (Toast, Modal, Dropdown, FileUpload, SkeletonLoader)
  - Theme CSS with utility classes and backward compatibility
  - Runtime branding system (`BrandingLoader.js`, `Branding.js`)
  - Branding API endpoint with Settings integration
  - Admin color picker UI with live preview
  - File upload system with image optimization
  - Inter font loading with preconnect optimization
  - Lucide icon integration
  - Comprehensive design system documentation (789 lines)
- ✅ **Phase 6A.5**: Site Shell & Visual Refresh
  - Header redesign (gradient, borderless nav, mobile drawer)
  - Footer redesign (multi-column, dark theme)
  - Landing page hero with competition card
  - Register page visual redesign
  - Payment page visual redesign
  - Thank-you page visual redesign
  - Features grid component
  - Consistent page headers across all public pages

### Recently Completed

- ✅ **Phase 6C**: Admin Console Redesign - COMPLETE
  - ✅ Sidebar navigation with grouped sections
  - ✅ Mobile responsive sidebar
  - ✅ Competition dropdown sync
  - ✅ Dashboard metric cards with trends
  - ✅ Recent activity feed
  - ✅ Empty states with copy URL feature
  - ✅ Keyboard navigation (g+key, ?, Escape)
  - ✅ Data table sorting (click column headers)
  - ✅ Data table filtering (search, payment status, age division)
  - ✅ Bulk selection and CSV export
  - ✅ Command palette (Cmd+K)
  - ✅ Modernized All Registrants page
  - ✅ Modernized Edit Registrant page
  - ✅ Modernized Current Event page (sectioned form)
  - ✅ Modernized Event Options page
  - ✅ Modernized Reports & Exports page
  - ✅ Modernized Settings page (payment, branding sections)
  - ✅ **Bug Fixes (Feb 2026)**:
    - Fixed tab switching (inline styles were overriding CSS display:none)
    - Fixed Edit Registrants scrolling (flex layout with fixed header, scrollable table)
    - Fixed empty state showing when registrations exist (single source of truth)
    - Fixed Current Event button alignment with competition dropdown
    - Fixed Event Options "Select All" checkbox column alignment
    - Added explanatory help text for table columns (Coaches, Form Fields, Events)
  - ✅ **Phase 6C.5 Polish (Feb 2026)**:
    - URL-based filter persistence (filters/sort saved in URL, survives refresh)
    - Loading skeletons for data tables and dashboard metrics
    - Quick Actions dropdown (export CSV, generate judging sheets, copy URL, etc.)
    - Real-time polling with visual indicator for new registrations

### Up Next

1. ~~**Phase 6B**: Registration Flow Redesign~~ ✅ COMPLETE
   - Multi-step wizard with 5 steps: Participant → Coach → Events → Extras → Review
   - WizardController.js for step state management
   - Auto-save, inline validation, running total
   - Mobile-first responsive layout with desktop sidebar
2. ~~**Phase 6D**: Code Restructuring & Performance~~ ✅ COMPLETE
   - [x] 6D.1 JavaScript Architecture ✅
   - [x] 6D.2 PHP Architecture ✅
   - [x] 6D.3 Performance Optimizations ✅
     - SchemaCache (12+ queries → 1 query)
     - Database indexes (migration 007)
     - Pagination on admin-list endpoint
     - ETag caching on config endpoints
     - Rate limiting on register.php
     - Gzip compression via .htaccess
     - Lazy tab loading in admin
   - [ ] Build pipeline (esbuild/Vite) — deferred to future phase
3. ~~**Phase 6E**: Security & Quality~~ ✅ COMPLETE
   - Session-based auth with login page
   - CSRF protection on mutations
   - CSP headers, audit logging, bcrypt passwords
   - PHPUnit test infrastructure
4. ~~**Phase 6F**: Home Page Enhancements~~ ✅ COMPLETE
   - Multi-competition grid display with status badges
   - Competition images with upload/preview (6F.2)
   - 6F.3 (Details page, notify me, countdown) deferred
5. **Phase 7**: Community-Driven Features ← UP NEXT
   - Coach portal with bulk registration
   - Family accounts with sibling discounts
   - Win & advancement tracking
   - Competition day check-in
5. **Phase 8-9**: Multi-tenancy & Advanced Features

### Backlog

- Multi-provider checkout (let user choose between Stripe/PayPal/Square at payment time)
- Receipt PDF generation
- Confirmation emails with receipt
- Refund functionality in admin
- Judge scoring module
- Video submission for virtual competitions
- Integration with organization membership systems (NBTA, USTA)

---

### Files Created in Phase 3

| File | Purpose |
|------|---------|
| `config/fields.json` | Field schema with 13 fields, 5 sections |
| `web/assets/js/lib/FormBuilder.js` | Dynamic form renderer class with conditional fields |
| `web/api/fields.php` | API endpoint for field config |
| `web/assets/js/admin/tabs/registrationFields/formFields.js` | Admin UI for field configuration |
| `server/migrations/001_add_custom_data_json.sql` | DB migration for custom fields |
| `server/migrations/002_add_fields_config_json.sql` | DB migration for per-competition field overrides |
| `server/migrations/003_add_event_categories.sql` | DB migration for event categories |
| `server/migrations/004_add_event_groups.sql` | DB migration for event sub-groups |

### Files Updated in Phase 3

| File | Changes |
|------|---------|
| `web/api/register.php` | Returns `fieldsConfig`, handles `custom_data_json` |
| `web/register.html` | Simplified with FormBuilder mount point |
| `web/assets/js/register.js` | Rewritten to use FormBuilder |

---

*Last updated: February 4, 2026 (Phase 6F complete - multi-competition home page display with status badges)*

---

## Research References

This roadmap incorporates insights from:

### Competitive Analysis
- [TourPro](https://tourprosoftware.com/) — Dance registration platform
- [EntryEeze](https://www.entryeeze.com/) — Skating/dance competition software
- [DanceComp Genie](https://www.dancecompgenie.com/) — Dance competition management
- [Twirlmate](https://twirlmate.com/) — Baton twirling community platform
- [DanceSync](https://sync.dance/) — Modern dance competition software

### Award-Winning UI Patterns
- [Apple Design Awards 2025](https://developer.apple.com/design/awards/)
- [Webby Awards](https://winners.webbyawards.com/)
- [Linear](https://linear.app/) — Minimal, keyboard-first design
- [Stripe Dashboard](https://stripe.com/) — Clean fintech UI
- [Baymard Institute](https://baymard.com/) — E-commerce checkout UX research

### Baton Twirling Community Research
- [IBTF](https://www.ibtf-batontwirling.org/) — International federation
- [USTA](https://ustwirling.com/) — United States Twirling Association
- [NBTA](https://www.nbtainternational.com/) — National Baton Twirling Association
- [Star Line Baton](https://www.starlinebaton.com/) — Industry trends
- [UNL Research](https://cehs.unl.edu/) — "How to Parent Baton Twirling Talent"
