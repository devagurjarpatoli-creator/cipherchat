FROM node:18-alpine

WORKDIR /usr/src/app

# Copy all project files into container
COPY . .

# Move to server folder where package.json lives
WORKDIR /usr/src/app/server

# Install dependencies inside server directory
RUN npm install

# Generate Prisma client using root schema
RUN npx prisma generate --schema=../prisma/schema.prisma

EXPOSE 10000

# Start the server
CMD ["node", "server.js"]
