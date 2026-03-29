# Preprio - Makefile for Testing
# Usage:
#   make test           - Run all tests (unit + integration)
#   make test-unit      - Run only unit tests

.PHONY: test test-unit test-integration help

# Default target
help:
	@echo "Preprio Test Commands:"
	@echo "  make test              - Run all tests (unit + integration)"
	@echo "  make test-unit         - Run only unit tests"
	@echo "  make test-integration  - Run only integration tests (if available)"


# Run all tests
test: test-unit
	@echo "✅ All tests completed"

# Run all unit tests
test-unit:
	@echo "🧪 Running all unit tests..."
	@source .env.local && deno test --allow-all --no-check tests/unit/test_edge_functions/*.ts

# Run integration tests (placeholder for future)
test-integration:
	@echo "⚠️  Integration tests not yet implemented"
	@echo "Unit tests cover Edge Function integration with database"
