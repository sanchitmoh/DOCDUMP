# Database Setup Guide

This guide will help you set up the Corporate Digital Library authentication system with database integration and CAPTCHA functionality.

## Prerequisites

1. **MySQL Database** (version 8.0 or higher)
2. **Node.js** (version 18 or higher)
3. **CAPTCHA Service Account** (Google reCAPTCHA or hCaptcha)
4. **Email Service** (Gmail, SendGrid, or similar SMTP service)

## Step 1: Install Dependencies

Run the following command to install the required packages:

```bash
npm install bcryptjs jsonwebtoken mysql2 nodemailer
npm install -D @types/bcryptjs @types/jsonwebtoken @types/nodemailer
```

## Step 2: Database Setup

1. **Create the database:**
   ```sql
   CREATE DATABASE Coprate_Digital_library CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   ```

2. **Run the schema:**
   Execute the SQL commands from `complete_database_schema.sql` in your MySQL database.

3. **Verify tables:**
   ```sql
   USE Coprate_Digital_library;
   SHOW TABLES;
   ```

## Step 3: Environment Configuration

1. **Copy the environment template:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Configure your `.env.local` file:**

### Database Configuration
```env
DATABASE_URL="mysql://username:password@localhost:3306/Coprate_Digital_library"
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=Coprate_Digital_library
```

### JWT Configuration
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

### CAPTCHA Configuration (Choose one)

**Option A: Google reCAPTCHA v3 (Recommended)**
1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Create a new site with reCAPTCHA v3
3. Add your domain (localhost for development)
4. Get your site key and secret key

```env
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
NEXT_PUBLIC_RECAPTCHA_V3=true
```

**Option B: hCaptcha**
1. Go to [hCaptcha Dashboard](https://dashboard.hcaptcha.com/)
2. Create a new site
3. Get your site key and secret key

```env
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
HCAPTCHA_SECRET_KEY=your-hcaptcha-secret-key
```

### Email Configuration

**Option A: Gmail (Easiest for development)**
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: [Google App Passwords](https://myaccount.google.com/apppasswords)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Option B: SendGrid**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Application Configuration
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 4: Test the Setup

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test database connection:**
   Create a test API route to verify database connectivity:
   ```bash
   curl http://localhost:3000/api/auth/me
   ```

3. **Test CAPTCHA:**
   Visit the login or signup pages and verify CAPTCHA loads correctly.

4. **Test email:**
   Try registering a new organization or employee to test OTP email delivery.

## Step 5: Production Deployment

### Security Checklist

1. **Change JWT Secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Use environment variables:**
   - Never commit `.env.local` to version control
   - Use your hosting platform's environment variable system

3. **Database Security:**
   - Use a dedicated database user with minimal permissions
   - Enable SSL connections
   - Use connection pooling

4. **CAPTCHA Configuration:**
   - Add your production domain to CAPTCHA service
   - Update site keys for production

5. **Email Security:**
   - Use dedicated SMTP service (SendGrid, Mailgun, etc.)
   - Implement rate limiting for email sending

### Environment Variables for Production

```env
# Database (use connection string for cloud databases)
DATABASE_URL="mysql://user:pass@host:port/database?ssl=true"

# JWT (generate new secret)
JWT_SECRET=production-secret-key-32-characters-long
JWT_EXPIRES_IN=7d

# CAPTCHA (production keys)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=prod-site-key
RECAPTCHA_SECRET_KEY=prod-secret-key

# Email (production SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=production-api-key

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed:**
   - Check MySQL service is running
   - Verify credentials in `.env.local`
   - Ensure database exists and user has permissions

2. **CAPTCHA Not Loading:**
   - Check site key is correct
   - Verify domain is added to CAPTCHA service
   - Check browser console for errors

3. **Email Not Sending:**
   - Verify SMTP credentials
   - Check spam folder
   - Test with a simple email client first

4. **JWT Token Issues:**
   - Ensure JWT_SECRET is set
   - Check token expiration settings
   - Verify cookie settings for your domain

### Debug Mode

Enable debug logging by adding to `.env.local`:
```env
NODE_ENV=development
DEBUG=true
```

## API Endpoints

The following API endpoints are now available:

- `POST /api/auth/register/organization` - Register new organization
- `POST /api/auth/register/employee` - Register new employee
- `POST /api/auth/verify-otp` - Verify email OTP
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

## Features Implemented

✅ **Database Integration:**
- MySQL connection with connection pooling
- Proper schema with relationships and indexes
- Password hashing with bcrypt
- JWT token authentication

✅ **CAPTCHA Protection:**
- Support for Google reCAPTCHA v3 and hCaptcha
- Rate limiting for authentication attempts
- Configurable CAPTCHA themes and actions

✅ **Email Verification:**
- OTP generation and validation
- HTML email templates
- SMTP configuration for multiple providers
- Resend functionality with rate limiting

✅ **Security Features:**
- Password hashing with salt
- JWT tokens with expiration
- Rate limiting on authentication endpoints
- Input validation with Zod
- SQL injection prevention

✅ **User Experience:**
- Seamless integration with existing UI
- No UI changes required
- Toast notifications for feedback
- Loading states and error handling

## Next Steps

1. **Add Password Reset:** Implement forgot password functionality
2. **Add 2FA:** Implement two-factor authentication
3. **Add Session Management:** Implement session refresh and management
4. **Add Audit Logging:** Log all authentication events
5. **Add Admin Panel:** Create admin interface for user management

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Check the browser console and server logs for errors
4. Test each component (database, CAPTCHA, email) individually