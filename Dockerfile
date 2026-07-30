FROM python:3.11-slim

WORKDIR /app

# Install python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application code
COPY backend ./backend

# Command to run the application using shell form for $PORT expansion
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
