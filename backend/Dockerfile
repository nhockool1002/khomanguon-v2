FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec prisma generate
RUN pnpm run build

# pnpm không hoist gói ra node_modules gốc như npm/yarn — Prisma Client sinh ra nằm sâu
# trong node_modules/.pnpm/@prisma+client@<hash>/node_modules/.prisma, đường dẫn đổi theo
# version nên không copy chọn lọc được đáng tin cậy. Copy nguyên node_modules đã build thay
# vì cài lại --prod riêng ở stage runtime — image nặng hơn một chút nhưng chắc chắn khớp
# 100% với những gì `pnpm run build` vừa chạy qua.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/main.js"]
