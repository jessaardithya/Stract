# Contributing to Stract

Thanks for your interest! Here's how to contribute.

## Branch Strategy

```
main        ← production-ready; protected
  └── develop      ← integration branch; all PRs merge here first
        └── feature/xxx   ← one branch per feature
        └── fix/xxx       ← bug fixes
        └── chore/xxx     ← tooling, cleanup, deps
```

## Development Workflow

1. **Branch from `develop`**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Make your changes** (frontend in `stract-frontend/`, backend in `stract-backend/`).

3. **Verify before committing**:
   ```bash
   # Backend
   cd stract-backend && go build ./...

   # Frontend
   cd stract-frontend && npx tsc --noEmit
   ```

4. **Commit using conventional commits**:
   ```
   feat: add project intake forms
   fix: resolve analytics GROUP BY error
   chore: update dependencies
   refactor: move handlers to feature packages
   ```

5. **Open a PR** to `develop`, fill in the PR template.

6. **`develop` → `main`** is done periodically when stable.

## Local Setup

### Backend
```bash
cd stract-backend
cp .env.example .env   # fill in Supabase keys
go run ./cmd/api/.
```

### Frontend
```bash
cd stract-frontend
cp .env.example .env.local   # fill in NEXT_PUBLIC_ keys
npm install
npm run dev
```

## Code Style
- **Go**: standard `gofmt`. No linter overrides.
- **TypeScript**: strict mode enabled. No `any` types.
- **Components**: one component per file, co-locate hooks near their component.

## Database (Supabase)
Migrations are raw SQL run in the Supabase SQL editor. Document schema changes in your PR description.
