FROM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.json ./
RUN npm ci
ARG VITE_FINFLOW_MODE=api
ARG VITE_AUTH_MODE=Development
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ENV VITE_FINFLOW_MODE=$VITE_FINFLOW_MODE VITE_AUTH_MODE=$VITE_AUTH_MODE VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
RUN npm run typecheck && npm run build
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/build /usr/share/nginx/html
EXPOSE 8080
