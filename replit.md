# FITAL Email API Gateway

## Overview
Production-ready Email API Gateway service using AWS SES for transactional email operations. This is an internal JSON-only API service for FITAL applications - no dashboard or UI components.

## Project Structure
```
├── server/
│   ├── index.ts           # Express server entry point
│   ├── routes.ts          # All API endpoints
│   ├── db.ts              # PostgreSQL connection
│   ├── storage.ts         # Database operations
│   ├── services/
│   │   ├── ses.service.ts         # AWS SES integration
│   │   ├── template.service.ts    # Handlebars templates
│   │   └── validation.service.ts  # Email validation
│   └── middleware/
│       ├── auth.middleware.ts     # API key authentication
│       └── rateLimit.middleware.ts # Rate limiting
├── shared/
│   └── schema.ts          # Database schema & Zod validation
└── README.md              # Complete API documentation
```

## API Endpoints

### Email Operations (require x-api-key)
- `POST /api/v1/email/send` - Send text email
- `POST /api/v1/email/send-html` - Send HTML email
- `POST /api/v1/email/send-template` - Send using template
- `POST /api/v1/email/send-bulk` - Bulk send (max 100)
- `POST /api/v1/email/send-attachment` - Send with attachments
- `GET /api/v1/email/status/:messageId` - Get email status
- `GET /api/v1/email/stats` - Get sending statistics
- `POST /api/v1/email/validate` - Validate email address

### Templates & Webhooks
- `GET /api/v1/templates` - List available templates
- `POST /api/v1/webhooks` - Register webhook
- `GET /api/v1/webhooks` - List webhooks
- `DELETE /api/v1/webhooks/:id` - Deactivate webhook

### Admin (require x-master-key)
- `POST /api/v1/admin/api-keys` - Create API key
- `GET /api/v1/admin/api-keys` - List API keys
- `DELETE /api/v1/admin/api-keys/:id` - Deactivate API key
- `GET /api/v1/admin/logs` - View email logs

### Health
- `GET /api/v1/health` - Health check (no auth)

## Database Schema
- `api_keys` - API key management
- `email_logs` - Email history & tracking
- `webhooks` - Webhook registrations
- `bounce_list` - Suppression list
- `email_templates` - Template metadata

## Email Templates
- `welcome` - New user welcome
- `password_reset` - Password reset with code
- `invoice` - Payment invoice
- `notification` - General notification
- `otp` - OTP verification code

## Required Environment Variables
```
# AWS SES
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@domain.com
SES_FROM_NAME=FITAL Email Service

# Security
API_MASTER_KEY=your_master_key

# Database
DATABASE_URL=postgresql://...
```

## Rate Limits
- 100 emails/minute per API key
- 1000 requests/minute global
- 300 read requests/minute

## Development
```bash
npm run dev     # Start development server
npm run db:push # Push database schema
```

## Recent Changes
- 2024-11-30: Initial implementation with all 10+ endpoints
- AWS SES integration with Nodemailer for attachments
- Handlebars templates with 5 pre-built designs
- PostgreSQL storage with Drizzle ORM
- Rate limiting with express-rate-limit
- API key authentication system
