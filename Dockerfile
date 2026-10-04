FROM node:18-alpine

# Set working directory to the server folder directly
WORKDIR /usr/src/app/server

# Copy server package.json and package-lock.json into the working directory
COPY server/package*.json ./

# Install server dependencies
RUN npm install

# Copy Prisma schema directly into the server directory
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the application code
COPY . /usr/src/app/

# Start the application
CMD ["node", "server.js"]
