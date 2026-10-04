FROM node:18-alpine

# Set working directory to the root of the app
WORKDIR /usr/src/app

# Copy server dependency files from the host server directory
COPY server/package*.json ./server/

# Change directory to server and install dependencies
WORKDIR /usr/src/app/server
RUN npm install

# Return to root directory and copy the rest of the application
WORKDIR /usr/src/app
COPY . .

# Generate Prisma client from root context
RUN npx prisma generate --schema=./prisma/schema.prisma

# Start the application
CMD ["node", "server/server.js"]
