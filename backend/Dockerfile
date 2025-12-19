# Isteğiniz üzerine, güncel LTS (Long Term Support) ve Alpine olmayan
# standart Debian (bookworm) imajını kullanıyoruz.
FROM node:22-bookworm-slim AS base

RUN apt-get update -y \
&& apt-get install -y openssl

WORKDIR /usr/src/app

# Sadece package.json degistiginde npm install'u tekrar calistir
COPY package*.json ./

COPY prisma/schema.prisma ./prisma/

# Tum proje dosyalarini kopyala
COPY . .


RUN npm install



# Prisma Client'i olustur
RUN npx prisma generate
# Not: prisma generate'i postinstall script'ine ekledik,
# npm install calistiginda otomatik calisacak.

# Uygulamanin calisacagi port
EXPOSE 3000

# Gelistirme ortami icin 'npm run dev' calistir
# (nodemon ile anlik degisiklikleri yakalar)
CMD [ "npm", "run", "dev" ]