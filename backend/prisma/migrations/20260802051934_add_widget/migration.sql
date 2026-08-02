-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('SEARCH', 'CATEGORIES', 'RECENT_POSTS', 'HTML');

-- CreateTable
CREATE TABLE "widgets" (
    "id" TEXT NOT NULL,
    "type" "WidgetType" NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'sidebar',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_roles" (
    "widgetId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "widget_roles_pkey" PRIMARY KEY ("widgetId","roleId")
);

-- AddForeignKey
ALTER TABLE "widget_roles" ADD CONSTRAINT "widget_roles_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_roles" ADD CONSTRAINT "widget_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
