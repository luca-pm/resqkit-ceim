# ResQKit backend - containerization requested by the mentor's review (see
# ResQKit_Progress_Update.md's overlap table against Matei's backend, which
# already had this). Not previously present in this repo.
FROM python:3.12-slim

WORKDIR /app

# System deps for psycopg/asyncpg/cryptography wheels that sometimes need a
# build toolchain on slim images. Kept minimal on purpose.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

# --host 0.0.0.0 so the port is actually reachable from outside the
# container, matching the same reasoning as app/start.ps1's -Lan flag.
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
