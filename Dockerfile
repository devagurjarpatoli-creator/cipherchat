FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json from the server folder into the working directory
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the workspace files
COPY . .

# Start the server
CMD ["node", "server/server.js"]