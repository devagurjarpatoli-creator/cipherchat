FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files from the server folder
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the application files
COPY . .

# Start the application from the server folder
CMD ["node", "server/server.js"]