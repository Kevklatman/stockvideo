# Stock Video Platform

A full-stack application for buying, selling, and managing stock videos.

## Project Structure

This project consists of two main components:

- **Client**: A Next.js frontend application
- **Server**: An Express.js backend API with TypeScript and TypeORM

## Prerequisites

- Node.js (v16+)
- PostgreSQL
- Redis
- AWS S3 bucket (for video storage)
- Stripe account (for payments)

## Environment Setup

### Server Environment Variables

Create a `.env` file in the server directory with the following variables:

```
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=stock_video_db

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# AWS Configuration
AWS_REGION=your_aws_region
AWS_BUCKET=your_s3_bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Client Environment Variables

Create a `.env.local` file in the client directory with the following variables:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Installation

### Server Setup

```bash
cd server
npm install
npm run dev
```

### Client Setup

```bash
cd client
npm install
npm run dev
```

## Authentication

The platform uses JWT-based authentication with the following requirements:

- Password must be at least 8 characters long
- Password must contain uppercase letters
- Password must contain lowercase letters
- Password must contain numbers
- Password must contain special characters (!@#$%^&*)

## Features

- User authentication (register, login)
- Video upload and management
- Video browsing and searching
- Secure video playback
- Payment processing with Stripe
- Creator accounts with revenue tracking

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user

### Videos

- `GET /api/videos` - Get all videos
- `GET /api/videos/:id` - Get a specific video
- `POST /api/videos` - Upload a new video
- `PUT /api/videos/:id` - Update a video
- `DELETE /api/videos/:id` - Delete a video

### Purchases

- `POST /api/purchases` - Create a new purchase
- `GET /api/purchases` - Get user purchases

## Development

### Database Migrations

```bash
cd server
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
```

## Deployment

The application can be deployed to any hosting service that supports Node.js applications.

## License

[MIT](LICENSE)
