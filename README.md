# Mars Mission Fund

A sample crowdfunding application for coding workshops.
Mars Mission Fund is a fictional product that channels collective capital toward missions, technologies, and teams taking humanity to Mars.

The project is designed to teach software engineering practices using production-grade specifications, architecture patterns, and development workflows.

## What This Repo Contains

This repository includes:

- **Product specifications** covering vision, brand, engineering standards, architecture, security, and domain workflows (see [specs/README.md](./specs/README.md))
- **Application source code** for a TypeScript full-stack crowdfunding platform
- **Infrastructure configuration** for local development via Docker Compose

The specifications are intentionally production-grade.
They serve as working documentation and as templates demonstrating how real-world specs should be structured.
Each spec includes a "Local demo scope" note identifying what matters for the workshop versus what is theatre.

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Language | TypeScript (frontend and backend) |
| Runtime | Node.js 22.x LTS |
| Frontend | React 19.x |
| Backend | Express 5.x |
| Database | PostgreSQL (Aurora in production, Docker locally) |
| Architecture | Hexagonal (Ports and Adapters), CQRS / Event Sourcing |
| Testing | Vitest, Playwright, Testing Library, SuperTest |
| Auth | Clerk |
| Payments | Stripe (stubbed locally) |

For the full technology inventory, see [specs/tech/tech-stack.md](./specs/tech/tech-stack.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 22.x LTS
- [npm](https://www.npmjs.com/) 10.x
- [Docker](https://www.docker.com/) and Docker Compose
- Git

## Getting Started

```bash
# Clone the repository
git clone https://github.com/LeeCampbell/MarsMissionFund.git
cd MarsMissionFund

# Install dependencies
npm install

# Start local infrastructure (PostgreSQL, etc.)
docker compose up -d

# Run database migrations
npm run migrate

# Start the development server
npm run dev
```

> **Note:** External services (Stripe, Clerk, Veriff, AWS SES) are stubbed or mocked for local development.
> See `.env.example` for required environment variables.

## Project Structure

```text
specs/              Product and technical specifications (start here)
src/                Application source code
e2e/                Playwright end-to-end tests
```

For the full specification hierarchy and reading order, see [specs/README.md](./specs/README.md).

## Specifications

The [specs/](./specs/) directory contains a layered specification system:

- **L1 Strategic** -- Product vision and mission
- **L2 Standards** -- Brand and engineering standards
- **L3 Technical** -- Architecture, security, frontend, data, audit, and tech stack
- **L4 Domain** -- Account, campaign, donor, payments, and KYC workflows

Read [specs/README.md](./specs/README.md) before implementing any feature.
It includes the full dependency graph, agent protocol, and cross-cutting concern index.

## Quality Gates

- Unit test coverage: 80%+ required
- Integration tests must pass
- E2E tests must pass
- ESLint and Prettier enforced
- Markdown linting via markdownlint-cli2

## Contributing

- Do not commit directly to `main` -- use feature branches
- Branch naming: `feat/`, `fix/`, `chore/` prefixes
- Push feature branches and open PRs against `main`

## Licence

This project is for educational purposes as part of a coding workshop.
