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

# Không copy node_modules từ stage build sang runtime — trên VPS production, "COPY --from"
# node_modules dạng symlink của pnpm giữa các stage đã từng khiến require() một số gói
# (vd multer) báo "Cannot find module" dù cùng image, cùng cây phụ thuộc, chạy tốt ở máy dev.
# Cài lại trực tiếp trong stage runtime để node_modules được tạo mới, tự chứa 100% trong
# đúng layer sẽ chạy — image nặng hơn một chút (2 lần install) nhưng chắc chắn resolve đúng.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# prisma/seed.ts chạy qua ts-node (không qua dist) và import trực tiếp từ src/ để dùng
# chung danh sách permission với app — cần copy cả src/ để lệnh "prisma db seed" chạy
# được trong image production, không chỉ ở máy dev.
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
# Prisma Client (query engine) được sinh dựa trên node_modules cụ thể của stage này.
RUN pnpm exec prisma generate
EXPOSE 4000
CMD ["node", "dist/main.js"]
