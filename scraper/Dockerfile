FROM mcr.microsoft.com/playwright:v1.47.2-jammy

WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm i --omit=dev

COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npx tsc -p tsconfig.json

ENV PORT=3000
CMD ["node", "dist/server.js"]
