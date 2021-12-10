FROM node:alpine AS BUILD

COPY . /tmp/src
RUN cd /tmp/src && npm ci && npm run build

FROM node:alpine
ENV NODE_ENV=production
ENV NODE_CONFIG_DIR=/data/config
RUN mkdir -p /bot
WORKDIR /bot
COPY --from=BUILD /tmp/src/lib /bot/lib
COPY --from=BUILD /tmp/src/package*.json /bot/
RUN npm ci --production
CMD node lib/index.js
VOLUME ["/data"]
