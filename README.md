<div align="center">
  <img src="public/logo.svg" alt="NewTube Logo" width="80" height="80">
  <h1>NewTube</h1>
  <p>A modern video hosting platform built with Next.js, tRPC, and Mux</p>
  
  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#screenshots">Screenshots</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#environment-variables">Environment Setup</a> •
    <a href="#architecture">Architecture</a>
  </p>
</div>

## Overview

NewTube is a YouTube-like platform that allows users to upload, share, and watch videos. It features AI-powered capabilities for content enhancement, an intuitive studio interface for creators, and a responsive design for viewers.

## Features

### For Viewers
- 📱 Responsive design works on desktop and mobile
- 🔍 Browse videos with category filtering
- 👀 Animated thumbnail previews on hover
- 📺 Adaptive video streaming with Mux

### For Creators
- 🎬 Full-featured content studio
- 🔄 Simple drag-and-drop video uploads
- 🎭 Thumbnail management with custom uploads
- 🕶️ Public/private video visibility controls
- 🤖 AI-powered title generation from video transcripts
- 📝 AI-generated video descriptions
- 🎨 AI-created custom thumbnails with DALL-E

### Platform
- 🔐 User authentication with Clerk
- 📊 Content categorization
- 🔍 SEO-optimized content generation
- 🔮 Real-time video status updates

## Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **API Client**: [tRPC](https://trpc.io/) for end-to-end type-safe APIs
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Video Player**: [Mux Player React](https://www.mux.com/)

### Backend
- **API**: [tRPC](https://trpc.io/) with server components
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Neon](https://neon.tech/))
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Video Processing**: [Mux](https://www.mux.com/) for transcoding, streaming, and captions
- **Asset Storage**: [UploadThing](https://uploadthing.com/) for thumbnails and previews
- **Caching/Queues**: [Upstash Redis](https://upstash.com/) for rate limiting and workflows
- **AI Services**: [OpenAI API](https://openai.com/) (GPT-4 and DALL-E 3)

## Screenshots

*[Add screenshots of key interfaces here: Home, Video Player, Studio Dashboard, Upload Flow]*

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/bun
- PostgreSQL database (or Neon account)
- Accounts for: Clerk, Mux, UploadThing, Upstash, and OpenAI

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/newtube.git
   cd newtube
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   # or
   bun install
   ```

3. Set up environment variables (see section below)

4. Run database migrations
   ```bash
   npx drizzle-kit push:pg
   ```

5. Seed the database with categories
   ```bash
   npx tsx src/scripts/seed-categories.ts
   ```

6. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   bun dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Copy the `.env.example` file to `.env.local` and fill in the following variables:

```bash
# Authentication - Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_********************
CLERK_SECRET_KEY=sk_test_********************
CLERK_SIGNING_SECRET=whsec_********************

# Database - Neon
DATABASE_URL=postgresql://username:password@localhost:5432/newtube

# Redis - Upstash
UPSTASH_REDIS_REST_URL=https://******.upstash.io
UPSTASH_REDIS_REST_TOKEN=********************************

# Media Handling - Mux
MUX_TOKEN_ID=************************************
MUX_TOKEN_SECRET=********************************
MUX_WEBHOOK_SECRET=****************************

# File Upload - UploadThing
UPLOADTHING_TOKEN=sk_****************************

# Queue Management - QStash
QSTASH_TOKEN=****************************
QSTASH_CURRENT_SIGNING_KEY=sig_****************************
QSTASH_NEXT_SIGNING_KEY=sig_****************************

# AI Service - OpenAI
OPENAI_API_KEY=sk_****************************
```

### Webhook Setup

For local development of webhooks, you can use ngrok:

```bash
npm run dev:webhook
```

Configure webhook endpoints in your service dashboards:
- Clerk Dashboard: `https://your-ngrok-url/api/users/webhook`
- Mux Dashboard: `https://your-ngrok-url/api/videos/webhook`

## Architecture

NewTube follows a modular architecture organized by domain:

```
src/
├── app/                # Next.js App Router
│   ├── (auth)/         # Authentication routes
│   ├── (home)/         # Public-facing routes
│   ├── (studio)/       # Creator dashboard routes
│   └── api/            # API endpoints and webhooks
├── components/         # Shared UI components
├── db/                 # Database schema and config
├── hooks/              # React hooks
├── lib/                # Utility libraries
├── modules/            # Domain-specific modules
│   ├── auth/           # Authentication components
│   ├── categories/     # Category management
│   ├── home/           # Home page components
│   ├── studio/         # Creator studio
│   └── videos/         # Video player and components
└── trpc/               # tRPC setup and routers
```

### Data Flow

1. **Video Upload**:
   - User initiates upload in Studio
   - Backend creates a video record and Mux upload URL
   - Video is uploaded directly to Mux
   - Mux webhooks update video status
   - System generates thumbnails and previews

2. **AI Content Generation**:
   - User requests AI-generated content
   - Backend sends request to QStash workflow
   - Workflow processes video transcript with OpenAI
   - Generated content updates the video record

3. **Video Playback**:
   - User navigates to video page
   - Client-side MuxPlayer streams video
   - Backend tracks analytics (planned)

## API Endpoints

All API communication is handled through tRPC routers:

- `/api/trpc` - tRPC endpoint
- `/api/uploadthing` - UploadThing file uploads
- `/api/videos/webhook` - Mux webhook receiver
- `/api/users/webhook` - Clerk webhook receiver
- `/api/videos/workflows/*` - Upstash QStash workflows

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<div align="center">
  <p>Built with ❤️ using Next.js, tRPC, and Mux</p>
</div>