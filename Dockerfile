FROM python:3.10-slim

WORKDIR /app

# Gerekli sistem kütüphaneleri (gerekirse)
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları kopyala ve yükle
COPY requirements.txt package.json package-lock.json ./
RUN pip install --no-cache-dir -r requirements.txt
RUN npm install

# Tüm kodları kopyala
COPY . .

# Port ayarı (Render için)
ENV PORT=10000
EXPOSE 10000

# Botu çalıştır
CMD ["python", "-u", "bot.py"]
