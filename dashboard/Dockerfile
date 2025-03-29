FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Create a production image
FROM nginx:alpine

# Copy custom nginx configuration to listen on port 3000
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the build files to the nginx directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 3000
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"] 