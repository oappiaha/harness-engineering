.PHONY: setup dev test lint typecheck e2e check clean

# TODO: replace placeholders with your stack's commands.
# Examples below are for a Python project; adapt for Node, Go, Rust, etc.

# === Setup ===
setup:
	# TODO: install dependencies
	# Python:  uv venv && uv pip install -e ".[dev]"
	# Node:    npm install
	# Rust:    cargo build
	@echo "TODO: implement 'setup'"
	@exit 1

# === Dev loop ===
dev:
	# TODO: start dev server / watch mode
	@echo "TODO: implement 'dev'"
	@exit 1

# === Tests (per layer) ===
test-unit:
	# TODO: pytest tests/unit -x
	@echo "TODO: implement 'test-unit'"
	@exit 1

test-integration:
	# TODO: pytest tests/integration
	@echo "TODO: implement 'test-integration'"
	@exit 1

e2e:
	# TODO: playwright test  /  pytest tests/e2e  /  curl smoke
	@echo "TODO: implement 'e2e'"
	@exit 1

test: test-unit test-integration

# === Static analysis ===
lint:
	# TODO: ruff check src/  /  npm run lint  /  cargo clippy
	@echo "TODO: implement 'lint'"
	@exit 1

typecheck:
	# TODO: mypy --strict src/  /  tsc --noEmit  /  cargo check
	@echo "TODO: implement 'typecheck'"
	@exit 1

# === The verification command ===
# This is what `pre-stop.sh` runs. The agent cannot terminate if this fails.
# Order matters: cheap checks first.
check: lint typecheck test
	@echo "✓ make check passed"

# === Cleanup ===
clean:
	# TODO: rm -rf build artifacts, caches
	@echo "TODO: implement 'clean'"
