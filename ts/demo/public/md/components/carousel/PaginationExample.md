```tsx
// Import Dependencies
import { useRef, useLayoutEffect } from "react";
import { register } from "swiper/element/bundle";
import type { SwiperContainer } from "swiper/element";

// Local Imports
import { randomId } from "@/utils/randomId";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useLocaleContext } from "@/app/contexts/locale/context";
import invariant from "tiny-invariant";

// ----------------------------------------------------------------------

register();

const images = [
  { id: randomId(), img: "/images/objects/object-16.jpg" },
  { id: randomId(), img: "/images/objects/object-3.jpg" },
  { id: randomId(), img: "/images/objects/object-2.jpg" },
  { id: randomId(), img: "/images/objects/object-9.jpg" },
];

export function PaginationExample() {
  const { primaryColorScheme: primary } = useThemeContext();
  const { direction } = useLocaleContext();
  const carouselRef = useRef<SwiperContainer | null>(null);

  useLayoutEffect(() => {
    invariant(carouselRef.current, "carouselRef is null");

    const params = {
      pagination: {
        clickable: true,
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
        slides-per-view="1"
        dir={direction}
        space-between="16"
        style={
          {
            "--swiper-theme-color": primary[400],
            "--swiper-pagination-color": primary[600],
          } as React.CSSProperties
        }
      >
        {images.map(({ img, id }) => (
          // @ts-expect-error - Swiper web components
          <swiper-slide key={id}>
            <img alt="object" src={img} loading="lazy" className="rounded-lg" />
            {/* @ts-expect-error - Swiper web components */}
          </swiper-slide>
        ))}
        {/* @ts-expect-error - Swiper web components */}
      </swiper-container>
    </div>
  );
}

```
