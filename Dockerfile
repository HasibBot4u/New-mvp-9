# NexusEdu backend image.
#
# The default image is minimal (no ffmpeg) because the upload worker
# intentionally skips transcoding on Render free tier (IS_FREE_TIER=true).
# To enable server-side thumbnail/transcode processing, build with:
#   docker build --build-arg INSTALL_FFMPEG=1 -t nexusedu-backend .
FROM python:3.11-slim

ARG INSTALL_FFMPEG=0
WORKDIR /app

# Install FFmpeg only when explicitly requested (needed for non-free-tier
# video processing in workers/upload_worker.py).
RUN if [ "$INSTALL_FFMPEG" = "1" ]; then \
      apt-get update && apt-get install -y --no-install-recommends ffmpeg && \
      rm -rf /var/lib/apt/lists/*; \
    fi

# Install python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application code
COPY backend ./backend

# Command to run the application using shell form for $PORT expansion
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
