FROM node:18-alpine

# Set working directory directly inside the server folder
WORKDIR /usr/src/app/server

# Copy server package files and install dependencies
COPY server/package*.json ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy all project files
COPY . /usr/src/app/

# Start the application
CMD ["node", "server.js"]
