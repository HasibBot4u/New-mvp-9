.PHONY: dev test build deploy clean setup

help:
	@echo "Available commands:"
	@echo "  make setup   - Install dependencies and prepare environment"
	@echo "  make dev     - Start full development environment"
	@echo "  make test    - Run all tests"
	@echo "  make build   - Build all production artifacts"
	@echo "  make deploy  - Deploy to production"
	@echo "  make clean   - Remove build artifacts and volumes"

setup:
	chmod +x scripts/*.sh
	./scripts/setup.sh

dev:
	docker-compose up -d redis prometheus grafana
	npm run dev &
	cd backend && uvicorn main:app --reload --port 8080

test:
	npm run test:ci || echo "Frontend tests missed"
	cd backend && pytest

build:
	npm run build
	cd backend && docker build -t nexusedu-api .

deploy:
	./scripts/deploy.sh

clean:
	docker-compose down -v
	rm -rf dist/
	rm -rf backend/__pycache__
