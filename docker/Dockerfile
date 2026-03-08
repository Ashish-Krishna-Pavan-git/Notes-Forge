FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NF_PDF_ALLOW_LOW_FIDELITY_FALLBACK=0

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    default-jre-headless \
    fontconfig \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

RUN if [ -f /usr/lib/libreoffice/program/soffice ]; then ln -sf /usr/lib/libreoffice/program/soffice /usr/local/bin/soffice; fi
RUN soffice --version

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
WORKDIR /app/backend

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
