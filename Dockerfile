FROM node:18-alpine

# Install OpenSSL required by Prisma engine on Alpine Linux
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

# Copy all project files into container
COPY . .

# Move into server directory where package.json lives
WORKDIR /usr/src/app/server

# Install server dependencies
RUN npm install

# Generate Prisma client using root schema
RUN npx prisma generate --schema=../prisma/schema.prisma

EXPOSE 10000

# Start server
CMD ["node", "server.js"]