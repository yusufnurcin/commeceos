FROM node:20-bookworm-slim AS workspace

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY services ./services
COPY packages ./packages

RUN pnpm install --frozen-lockfile=false

ARG WORKSPACE_PACKAGE
ENV WORKSPACE_PACKAGE=${WORKSPACE_PACKAGE}

EXPOSE 3000 8080 8091 8092 8093 8094 9000

CMD ["sh", "-c", "pnpm --filter ${WORKSPACE_PACKAGE} dev"]
