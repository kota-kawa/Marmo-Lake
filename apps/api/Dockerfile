FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/apps/api

COPY apps/api ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

RUN adduser --disabled-password --gecos "" --home /nonexistent --no-create-home marmo \
    && mkdir -p /data/uploads /data/backups \
    && chown -R marmo:marmo /data

USER marmo

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
