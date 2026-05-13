# Tensar AI-Powered Web Platform

A high-performance, modern e-commerce and technical services platform built as a Single Page Application (SPA). This repository contains the complete frontend architecture and serverless backend API integrations designed for scalable, edge-computed deployments.

## Architecture & Tech Stack
- **Frontend:** React, Vite (SPA)
- **Edge Backend:** Cloudflare Pages Functions
- **Database & Authentication:** Supabase
- **AI Integration:** Groq API for intelligent chat agents
- **CI/CD:** Automated deployments via GitHub Actions to Cloudflare Pages

## Key Features
- **Seamless Edge Computing:** Utilizes Cloudflare Functions (`/functions`) for fast, secure, and serverless API routes without maintaining traditional backend infrastructure.
- **AI Chat Agent:** Integrated conversational agent powered by Groq API (`/api/chat`) to assist customers.
- **Secure Authentication & DB:** Fully integrated with Supabase for user management, profiles, and secure data handling (`/lib` and functions).
- **Automated Deployments:** GitHub workflows automatically build and deploy the application to Cloudflare on every push, ensuring rapid delivery.
- **Legacy Admin Panel Support:** Automatically generates isolated administrative configurations during build processes while keeping operations secure on the edge.

## Project Structure
- `src/` & `app/`: Vite and React Router entry points containing the core page logic.
- `components/`: Reusable React UI components.
- `functions/`: Serverless endpoints for Cloudflare Pages handling API logic (e.g., checkout, chat, account).
- `lib/`: Reusable utility functions and Supabase client configurations.
- `public/`: Static assets and routing rules (`_headers`, `_redirects`).
- `.github/workflows/`: CI/CD pipelines for automated security checks and deployments.

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- Cloudflare and Supabase accounts

### Local Development
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   Copy `.env.example` to `.env.local` and configure your Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and Groq API keys.
3. Start the development server:
   ```bash
   npm run dev
   ```

### Deployment
The project is configured for automated CI/CD via GitHub Actions. Push changes to the `main` branch to trigger a build and deployment to Cloudflare Pages. 

For manual deployments:
```bash
npm run deploy:cloudflare
```

## Security Posture
All sensitive operations (such as database writes that bypass RLS) are strictly handled within Cloudflare Functions using the `SUPABASE_SERVICE_ROLE_KEY`, keeping the frontend client completely secure. Static assets are served with optimized `Cache-Control` headers.

## License
Distributed under the MIT License.
