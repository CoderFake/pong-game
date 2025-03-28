FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt && \
    apt-get update && \
    apt-get install -y netcat-openbsd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


COPY . /app/

RUN mkdir -p /app/media /app/static

COPY docker/app/entrypoint.sh /app/docker/app/entrypoint.sh
RUN chmod +x /app/docker/app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker/app/entrypoint.sh"]

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]