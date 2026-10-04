FROM node:18-alpine

WORKDIR /usr/src/app

# Copy server package file and install dependencies
COPY server/package*.json ./server/
WORKDIR /usr/src/app/server
RUN npm install

# Return to root directory and copy all source files
WORKDIR /usr/src/app
COPY . .

# Generate Prisma client using root schema
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 10000

# Start server
CMD ["node", "server/server.js"]