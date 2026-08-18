"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import {
  Autoplay,
  Pagination,
  Thumbs,
  EffectFade,
  EffectCube,
  EffectCoverflow,
  EffectCreative,
} from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper/types";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import "swiper/css/effect-cube";
import "swiper/css/effect-coverflow";
import "swiper/css/thumbs";
import { toAbsoluteUploadUrl } from "@/lib/upload";
import type { Slider, SliderSlide } from "@/lib/types";

// Swiper không có effect "zoom" dựng sẵn (module Zoom của Swiper là pinch-to-zoom ảnh, khác nghĩa
// "Zoom" trong yêu cầu — hiệu ứng chuyển cảnh phóng to/thu nhỏ) — dùng EffectCreative cấu hình tay
// scale+opacity để tạo hiệu ứng "zoom crossfade" giữa 2 slide, cách làm chuẩn khi cần zoom transition
// với Swiper (xem docs EffectCreative).
const EFFECT_BY_TRANSITION: Record<
  Slider["transitionStyle"],
  "slide" | "fade" | "cube" | "coverflow" | "creative"
> = {
  SLIDE: "slide",
  FADE: "fade",
  ZOOM: "creative",
  CUBE: "cube",
  COVERFLOW: "coverflow",
};

// Render carousel công khai — dùng ở trang chủ (widget) và hydrate embed trong bài viết
// (prose-content.tsx mount component này vào div[data-slider-embed] sau khi dangerouslySetInnerHTML).
export function SliderCarousel({ slider }: { slider: Slider }) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperClass | null>(null);
  const slides = slider.slides;
  if (slides.length === 0) return null;

  const effect = EFFECT_BY_TRANSITION[slider.transitionStyle];
  const showThumbs = slider.bulletStyle === "THUMBNAILS" && slides.length > 1;
  const loop = slider.loop && slides.length > 1;

  return (
    <div className="slider-carousel not-prose my-4 flex flex-col gap-2">
      <Swiper
        modules={[Autoplay, Pagination, Thumbs, EffectFade, EffectCube, EffectCoverflow, EffectCreative]}
        effect={effect}
        creativeEffect={
          effect === "creative"
            ? {
                prev: { shadow: true, scale: 0.85, opacity: 0 },
                next: { scale: 1.15, opacity: 0 },
              }
            : undefined
        }
        coverflowEffect={
          effect === "coverflow"
            ? { rotate: 30, stretch: 0, depth: 100, modifier: 1, slideShadows: true }
            : undefined
        }
        loop={loop}
        autoplay={
          slider.autoplay ? { delay: slider.autoplayDelayMs, disableOnInteraction: false } : false
        }
        pagination={
          slider.bulletStyle === "DOTS"
            ? { clickable: true }
            : slider.bulletStyle === "NUMBERS"
              ? { type: "fraction" }
              : false
        }
        thumbs={showThumbs ? { swiper: thumbsSwiper } : undefined}
        className="slider-carousel-main aspect-video w-full overflow-hidden rounded-lg"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id}>
            <SlideContent slide={slide} />
          </SwiperSlide>
        ))}
      </Swiper>

      {showThumbs && (
        <Swiper
          modules={[Thumbs]}
          onSwiper={setThumbsSwiper}
          watchSlidesProgress
          slidesPerView={Math.min(slides.length, 6)}
          spaceBetween={8}
          className="slider-carousel-thumbs h-16 w-full"
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id} className="cursor-pointer overflow-hidden rounded-md opacity-50 [&.swiper-slide-thumb-active]:opacity-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={toAbsoluteUploadUrl(slide.imageUrl)}
                alt={slide.caption ?? ""}
                className="h-full w-full object-cover"
              />
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
}

function SlideContent({ slide }: { slide: SliderSlide }) {
  const image = (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={toAbsoluteUploadUrl(slide.imageUrl)}
        alt={slide.caption ?? ""}
        className="h-full w-full object-cover"
      />
      {slide.caption && (
        <span className="absolute inset-x-0 bottom-0 bg-black/50 px-3 py-1.5 text-sm text-white">
          {slide.caption}
        </span>
      )}
    </div>
  );
  return slide.linkUrl ? (
    <a href={slide.linkUrl} className="block h-full w-full">
      {image}
    </a>
  ) : (
    image
  );
}
