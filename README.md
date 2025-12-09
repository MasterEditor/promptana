# Promptana

A web application for storing, structuring, executing, and improving AI prompts. Promptana enables users to create prompts, organize them with tags and catalogs, search across prompts, run prompts through OpenRouter, and generate AI-driven improvement suggestions.

[![Next.js](https://img.shields.io/badge/Next.js-16.0.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ECF8E?logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

---

## Project Description

Promptana is a single-user web application designed for developers and prompt engineers who need a reliable place to store, find, run, and iteratively improve their AI prompts.

### Key Features

- **Prompt Management** — Create, read, update, and delete prompts with metadata (title, description, tags, catalog)
- **Organization** — Organize prompts using tags and catalogs for easy discovery
- **Full-text Search** — Search across prompt content, titles, tags, and catalog names with relevance ranking
- **Execution Playground** — Run prompts through OpenRouter (server-side) and view responses directly in the UI
- **AI Improvement Suggestions** — Generate AI-driven improvement suggestions and save them as new versions
- **Version History** — Track prompt evolution with version history, diffs, and restore functionality
- **Retention Policies** — Configure automatic pruning of old versions (14 days, 30 days, or always keep)
- **Quota Management** — Daily limits for runs and improvements to control costs

---

## Tech Stack

### Core

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router and API routes |
| **TypeScript** | Type-safe JavaScript |
| **React 19** | UI library |
| **Tailwind CSS 4** | Utility-first CSS framework |
| **Shadcn/ui** | Accessible UI component library |
| **Supabase** | Authentication and PostgreSQL database |
| **Postgres tsvector** | Full-text search |

### Testing

| Technology | Purpose |
|------------|---------|
| **Jest 29** | Unit test runner |
| **React Testing Library** | React component testing |
| **Playwright 1.40** | End-to-end testing (Chrome, Firefox, WebKit) |

### Development Tools

| Technology | Purpose |
|------------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |

---

## Getting Started Locally

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Supabase account** (for authentication and database)
- **OpenRouter API key** (for prompt execution)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/promptana.git
   cd promptana
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the project root:

   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # OpenRouter
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

4. **Set up the database**

   If using Supabase CLI:

   ```bash
   npx supabase db push
   ```

   Or apply migrations manually from the `supabase/migrations` folder.

5. **Run the development server**

   ```bash
   npm run dev
   ```

6. **Open the application**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint for code linting |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run unit tests with Jest |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run end-to-end tests with Playwright |
| `npm run test:e2e:ui` | Run Playwright tests with UI mode |
| `npm run test:e2e:debug` | Run Playwright tests in debug mode |
| `npm run test:e2e:report` | Show Playwright test report |
| `npm run test:e2e:codegen` | Open Playwright codegen for recording tests |

---

## Project Scope

### In Scope (MVP)

- Single-user account model
- Email-based authentication via Supabase Auth
- Server-side OpenRouter integration with a single server key
- Prompt CRUD operations with tags and catalogs
- Full-text search across prompts
- Run/Playground functionality for prompt execution
- AI-driven improvement suggestions
- Versioning with configurable retention policies
- Daily quotas for runs and improvements
- Clipboard export functionality
- Instrumentation for KPI measurement

### Out of Scope (MVP)

- Multi-user collaboration, sharing, or team permissions
- User-provided LLM keys or client-side OpenRouter usage
- Advanced import/export (file-based)
- Complex analytics dashboards
- Fine-grained ACLs and role-based access control
- Marketplace or public prompt gallery
- External programmatic API access

---

## Project Status

**Version:** 0.1.0 (MVP Development)

This project is currently in active development. The MVP focuses on core functionality for a single-user prompt management experience.

### Success Metrics (Targets)

- **Improve-to-save rate:** ≥80% of improvement actions result in saved versions
- **Prompt trial rate:** ≥70% of created prompts are run at least once
- **Time to first OpenRouter result:** <4 seconds average
- **OpenRouter error rate:** <5% of calls
- **Operational cost:** ≤$100/month for infrastructure and API usage

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

