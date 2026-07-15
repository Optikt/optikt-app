# Optikt App

Optikt App is an optical store management system built to support real day-to-day operations in a single place. It centralizes inventory, products, lenses, quotes, sales, suppliers, and role-based workflows so the business does not depend on disconnected spreadsheets or generic admin tools.

## Why this project exists

Optical stores usually need more than a simple stock tracker. They work with products, lenses, supplier pricing, prescriptions, quotes, and sales flows that have to stay consistent across the business. This project was created to cover those operational needs with a web application designed for actual store usage, not as a generic demo.

## What the app does

- Product and inventory management
- Lens catalog management
- Customer and supplier management
- Quote and sales workflows
- Pricing and operational tracking
- Role-based access and business logic

## Tech stack

- SvelteKit 2 + Svelte 5
- TypeScript
- Tailwind CSS + shadcn-svelte (bits-ui)
- Drizzle ORM + PostgreSQL
- Zod for validation
- Playwright + Vitest for testing
- Docker for containerized deployment

## Local development

### Prerequisites

- Node.js 20+
- pnpm
- A PostgreSQL database

### 1. Install dependencies

```sh
pnpm install
```

### 2. Configure environment variables

Create a local environment file from the example:

```sh
cp .env.example .env
```

Current required variables:

```env
DATABASE_URL="postgres://user:password@host:port/db-name"
DATABASE_URL_DOCKER="postgres://user:password@host.docker.internal:port/db-name"
ORIGIN="localhost:3000"
```

Update them with real values for your local setup.

### 3. Prepare the database

If you want the project to apply migrations and seed the initial admin user, run:

```sh
pnpm db:bootstrap
```

Other useful database commands:

```sh
pnpm db:push
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

### 4. Start the development server

```sh
pnpm dev
```

The app will be available at `http://localhost:5173` by default.

## Quality checks

Run the main validation commands before shipping changes:

```sh
pnpm check
pnpm lint
pnpm test
```

You can also build and preview a production bundle locally:

```sh
pnpm build
pnpm preview
```

## Docker

This project uses `@sveltejs/adapter-node` and ships a multi-stage production image.

### Build the image locally

```sh
docker build -t optikt-app .
```

The image build injects a temporary `DATABASE_URL` only for the build step so `pnpm build` does not need a live database connection.

### Run the app container against an existing database

The repository includes two compose files for running the app container with environment variables from a file:

- `docker-compose.yml` uses `.env`
- `docker-compose-dev.yml` uses `.env.dev`

Example:

```sh
docker build -t optikt-app .
docker compose -f docker-compose-dev.yml up -d
```

In that mode, the app container connects to the database defined by `DATABASE_URL_DOCKER`.

### Run the production stack with PostgreSQL

For a self-contained deployment with the app and PostgreSQL together:

```sh
docker compose -f docker-compose-prod.yml up -d
```

This stack starts:

- `postgres` on PostgreSQL 16
- `optikt-app` on port `3000`

The production container entrypoint waits for the database, applies migrations, and runs the bootstrap script automatically.

### Production environment notes

- Set `ORIGIN` to the real public URL
- Use a strong `DB_PASSWORD`
- Review the default bootstrap behavior before exposing the app publicly

## Releasing the Docker image

Publishing to Docker Hub is handled manually from GitHub Actions through `.github/workflows/docker-build.yml`.

Typical flow:

1. Open GitHub Actions and run the Docker workflow.
2. Select the `main` branch.
3. Choose the version bump: `patch`, `minor`, or `major`.
4. The workflow updates `package.json`, creates the release commit and tag, then builds and pushes the image.

Required repository secrets:

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

## Repository structure

- `src/routes` - app routes and pages
- `src/lib/components` - reusable UI and domain components
- `src/lib/remote` - remote queries, forms, and commands
- `src/lib/server` - server-side auth, guards, database, and audit logic
- `src/lib/schemas` - Zod validation schemas
- `drizzle` - database schema and migrations

## Notes

- Package manager for this repository is `pnpm`
- Styling is done with Tailwind CSS
- The app is intended for business workflows and operational management, not fiscal invoicing
