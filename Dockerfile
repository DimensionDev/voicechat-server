FROM node:lts-alpine
WORKDIR /app
COPY . .
RUN npm ci \
    && npm run build \
    && npm ci --production

FROM node:lts-alpine
WORKDIR /app
COPY --from=0 /app/node_modules /app
COPY --from=0 /app/dist /app/dist
EXPOSE 3000
CMD [ "node", "./dist/index.ts" ]
