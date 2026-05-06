.PHONY: dev test build deploy clean setup

help:
	@echo "Available commands:"
	@echo "  make setup   - Install dependencies and prepare environment via setup.py"
	@echo "  make dev     - Start full development environment via setup.py"
	@echo "  make test    - Run all tests"
	@echo "  make build   - Build all production artifacts"
	@echo "  make deploy  - Deploy to production"
	@echo "  make clean   - Remove build artifacts and volumes"

setup:
	python3 scripts/setup.py

dev:
	@echo "Starting development environment..."
	@npm run dev & cd backend && uvicorn main:app --reload --port 8000
	@wait

test:
	npm run test:ci || echo "Frontend tests missed"
	cd backend && pytest

build:
	npm run build
	cd backend && docker build -t nexusedu-api .

deploy:
	./scripts/deploy.sh

clean:
	docker-compose down -v || true
	rm -rf dist/
	rm -rf backend/__pycache__
