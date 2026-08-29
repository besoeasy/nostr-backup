FROM node:lts-alpine AS runner

WORKDIR /app

# Install production dependencies only, using the lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the application and entrypoint
COPY bin ./bin
COPY src ./src
COPY entrypoint.sh /usr/local/bin/nostr-backup-entrypoint

RUN chmod +x /usr/local/bin/nostr-backup-entrypoint

# Output directory where backups land (mount a volume here)
ENV OUT_DIR=/backup
ENV FOLDER=/backup
ENV SCHEDULE_MINUTES=45

ENTRYPOINT ["/usr/local/bin/nostr-backup-entrypoint"]
