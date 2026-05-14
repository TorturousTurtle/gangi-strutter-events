# Competition Registration Platform

A web-based registration system for competition events (baton twirling, dance, gymnastics, etc.).

## Quick Start

### 1. Environment Setup

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Database credentials
DB_HOST=localhost
DB_NAME=your_database
DB_USER=your_user
DB_PASS=your_password

# Admin login credentials
ADMIN_USER=admin
ADMIN_PASS=your_secure_password

# Stripe keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 2. Database Setup

Import the database schema:

```bash
mysql -u your_user -p your_database < schema.sql
```

### 3. Running Locally

Using PHP's built-in server:

```bash
cd web
php -S localhost:8000
```

Then visit:
- Public site: http://localhost:8000
- Admin panel: http://localhost:8000/admin/

## Project Structure

```
├── server/
│   ├── config.php          # Application configuration (loads from .env)
│   └── lib/
│       └── Env.php         # Environment variable loader
├── web/
│   ├── api/                # PHP API endpoints
│   ├── admin/              # Admin interface
│   └── assets/             # CSS, JS, images
├── .env                    # Your local config (git-ignored)
└── .env.example            # Template for .env
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_HOST` | Database server hostname | Yes |
| `DB_NAME` | Database name | Yes |
| `DB_USER` | Database username | Yes |
| `DB_PASS` | Database password | Yes |
| `DB_CHARSET` | Database charset (default: utf8mb4) | No |
| `ADMIN_USER` | Admin panel username | Yes |
| `ADMIN_PASS` | Admin panel password | Yes |
| `STRIPE_SECRET_KEY` | Stripe secret API key | For payments |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | For payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | For payments |
| `APP_ENV` | Environment (production/development) | No |
| `APP_URL` | Application base URL | No |
| `APP_DEBUG` | Enable debug mode (true/false) | No |

## Security Notes

- Never commit `.env` to version control
- Use strong passwords for admin and database accounts
- In production, ensure the `server/` directory is not web-accessible
- Rotate credentials if they were ever exposed
