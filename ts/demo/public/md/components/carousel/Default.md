```tsx
// Import Dependencies
import { useRef, useLayoutEffect } from "react";
import { register } from "swiper/element/bundle";
import type { SwiperContainer } from "swiper/element";
import invariant from "tiny-invariant";

// Local Imports
import { randomId } from "@/utils/randomId";
import { useLocaleContext } from "@/app/contexts/locale/context";

// ----------------------------------------------------------------------

register();

const images = [
  { id: randomId(), img: "/images/objects/object-17.jpg" },
  { id: randomId(), img: "/images/objects/object-3.jpg" },
  { id: randomId(), img: "/images/objects/object-2.jpg" },
  { id: randomId(), img: "/images/objects/object-9.jpg" },
];

export function Default() {
  const { direction } = useLocaleContext();

  const carouselRef = useRef<SwiperContainer | null>(null);

  useLayoutEffect(() => {
    invariant(carouselRef.current, "carouselRef is null");

    const params = {
      navigation: {
        size: 16,
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
        style={{ "--swiper-navigation-size": "32px" } as React.CSSProperties}
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
