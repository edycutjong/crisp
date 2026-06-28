.PHONY: help e2e lighthouse security-scan test quality build typecheck format lint ci

help:
	@echo "Crisp Build & Verification Harness"
	@echo "──────────────────────────────────────────────"
	@echo "make quality        - Run code formatting & ESLint quality checks"
	@echo "make typecheck      - Run compiler type checking"
	@echo "make test           - Run JS cryptographic protocol tests"
	@echo "make e2e            - Run Playwright E2E tests"
	@echo "make lighthouse     - Run Lighthouse CI audit metrics"
	@echo "make security-scan  - Run npm vulnerability audit & license compliance audit"
	@echo "make build          - Build Next.js production dashboard"
	@echo "make ci             - Run all CI checks (lint, typecheck, coverage, contracts)"

quality:
	npm run format:check && npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

build:
	npm run build

e2e:
	@echo "🎭 Running Playwright E2E tests (demo mode)..."
	npm run e2e

lighthouse:
	@echo "🔦 Running Lighthouse CI audit..."
	npm run lighthouse

security-scan:
	@echo "=== NPM AUDIT ==="
	npm run audit || true
	@echo ""
	@echo "=== LICENSE CHECK ==="
	npx license-checker --production --failOn "GPL-3.0;AGPL-3.0" --summary || true

ci:
	@echo "🧹 Running code quality and audit checks..."
	npm run ci
	@echo "🦀 Running Rust contract unit tests..."
	cd contracts/crisp_oracle && cargo test
	@echo "✅ All CI checks passed!"
