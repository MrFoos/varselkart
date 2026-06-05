BACKEND_PORT  = 8300
FRONTEND_PORT = 5300
DB            = ./varselkart.db
VENV          = .venv/bin

.PHONY: dev backend frontend install clean

dev: ## Start backend + frontend (to bakgrunns-prosesser, logger til terminalen)
	@echo "→ Backend:  http://localhost:$(BACKEND_PORT)"
	@echo "→ Frontend: http://localhost:$(FRONTEND_PORT)"
	@trap 'kill 0' INT; \
	  DATABASE_PATH=$(DB) PYTHONPATH=backend \
	    $(VENV)/uvicorn app.main:app --port $(BACKEND_PORT) --reload 2>&1 | sed 's/^/[backend] /' & \
	  python3 -m http.server $(FRONTEND_PORT) --directory frontend 2>&1 | sed 's/^/[frontend] /' & \
	  wait

backend: ## Start kun backend
	DATABASE_PATH=$(DB) PYTHONPATH=backend \
	  $(VENV)/uvicorn app.main:app --port $(BACKEND_PORT) --reload

frontend: ## Start kun frontend
	python3 -m http.server $(FRONTEND_PORT) --directory frontend

install: ## Installer Python-avhengigheter
	python3 -m venv $(VENV)/..
	$(VENV)/pip install -r backend/requirements.txt

clean: ## Slett database og __pycache__
	rm -f $(DB) $(DB)-wal $(DB)-shm
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

help: ## Vis denne hjelpen
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*##"}{printf "  %-12s %s\n", $$1, $$2}'
