-- CreateEnum
CREATE TYPE "SliderBulletStyle" AS ENUM ('DOTS', 'NUMBERS', 'THUMBNAILS', 'NONE');

-- CreateEnum
CREATE TYPE "SliderTransitionStyle" AS ENUM ('SLIDE', 'FADE', 'ZOOM', 'CUBE', 'COVERFLOW');

-- CreateTable
CREATE TABLE "sliders" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bulletStyle" "SliderBulletStyle" NOT NULL DEFAULT 'DOTS',
    "transitionStyle" "SliderTransitionStyle" NOT NULL DEFAULT 'SLIDE',
    "autoplay" BOOLEAN NOT NULL DEFAULT true,
    "autoplayDelayMs" INTEGER NOT NULL DEFAULT 4000,
    "loop" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sliders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slider_slides" (
    "id" TEXT NOT NULL,
    "sliderId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slider_slides_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "slider_slides" ADD CONSTRAINT "slider_slides_sliderId_fkey" FOREIGN KEY ("sliderId") REFERENCES "sliders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
