// Import Dependencies
import { useRef, useLayoutEffect } from "react";
import invariant from "tiny-invariant";
import { register } from "swiper/element/bundle";
import type { SwiperContainer } from "swiper/element";

// Local Imports
import { randomId } from "@/utils/randomId";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useLocaleContext } from "@/app/contexts/locale/context";

// ----------------------------------------------------------------------

register();

const images = [
  { id: randomId(), img: "/images/objects/object-15.jpg" },
  { id: randomId(), img: "/images/objects/object-3.jpg" },
  { id: randomId(), img: "/images/objects/object-2.jpg" },
  { id: randomId(), img: "/images/objects/object-9.jpg" },
];

export function ZoomExample() {
  const { primaryColorScheme: primary } = useThemeContext();
  const { direction } = useLocaleContext();

  const carouselRef = useRef<SwiperContainer | null>(null);

  useLayoutEffect(() => {
    invariant(carouselRef.current, "carouselRef is null");
    const params = {
      pagination: {
        clickable: true,
      },
      zoom: {
        maxRatio: 4,
      },
    };

    Object.assign(carouselRef.current, params);

    setTimeout(() => {
      carouselRef.current?.initialize();
    });
  }, []);

  return (
    <div className="max-w-md">
      {/* @ts-expect-error - Swiper web components */}
      <swiper-container
        ref={carouselRef}
        init="false"
        navigation="true"
        dir={direction}
        space-between="16"
        slides-per-view="1"
        style={
          {
            "--swiper-navigation-size": "32px",
            "--swiper-theme-color": primary[400],
            "--swiper-pagination-color": primary[600],
          } as React.CSSProperties
        }
      >
        {images.map(({ img, id }) => (
          // @ts-expect-error - Swiper web components
          <swiper-slide key={id}>
            <div className="swiper-zoom-container">
              <img
                className="h-full w-full rounded-lg object-cover"
                src={img}
                alt="object"
                loading="lazy"
              />
            </div>
            {/* @ts-expect-error - Swiper web components */}
          </swiper-slide>
        ))}
        {/* @ts-expect-error - Swiper web components */}
      </swiper-container>
    </div>
  );
}
