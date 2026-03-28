# Contributing Guide

## Branch Strategy
- `main` — production-ready; protected, requires PR + passing CI
- `develop` — integration branch
- Feature branches: `feat/<ticket>-short-description`
- Bug fixes: `fix/<ticket>-short-description`

## Pull Request Workflow
1. Branch from `develop` (never directly from `main`).
2. Keep PRs focused — one concern per PR.
3. All PRs require:
   - Passing `ci.yml` (lint, test, Semgrep scan)
   - At least one reviewer approval
   - No HIGH/CRITICAL Semgrep findings unaddressed

## Commit Convention (Conventional Commits)
```
feat(server): add file upload endpoint
fix(client): correct token refresh race condition
chore(infra): bump terraform provider versions
```

## Security Rules
- **Never** commit secrets, API keys, or `.env` files.
- **Never** hardcode GCP project IDs or bucket names — use environment variables.
- All new API endpoints must have Zod schema validation.
- New GCS interactions must use signed URLs, never public ACLs.

## Adding a New Skill
1. Create `server/src/skills/<skillName>.ts` implementing the `Skill` interface.
2. Export a `definition` object (name, description, parameters schema).
3. `ChatAgent` will auto-load it on startup — no manual registration required.

## Testing
- Unit tests: `*.test.ts` alongside source files.
- Integration tests: `server/src/__tests__/integration/`.
- Run: `npm test`

## Code Style
- ESLint + Prettier enforced via pre-commit hook (Husky).
- Strict TypeScript: `"strict": true`, no implicit `any`.
