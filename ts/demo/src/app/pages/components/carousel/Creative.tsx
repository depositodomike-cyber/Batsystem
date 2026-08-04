// Import Dependencies
import { useRef, useLayoutEffect } from "react";
import { register } from "swiper/element/bundle";
import type { SwiperContainer } from "swiper/element";

// Local Imports
import { randomId } from "@/utils/randomId";
import { useLocaleContext } from "@/app/contexts/locale/context";
import invariant from "tiny-invariant";

// ----------------------------------------------------------------------

register();

const images = [
  { id: randomId(), img: "/images/objects/object-11.jpg" },
  { id: randomId(), img: "/images/objects/object-3.jpg" },
  { id: randomId(), img: "/images/objects/object-2.jpg" },
  { id: randomId(), img: "/images/objects/object-9.jpg" },
];

export function Creative() {
  const { direction } = useLocaleContext();
  const carouselRef = useRef<SwiperContainer | null>(null);

  useLayoutEffect(() => {
    invariant(carouselRef.current, "carouselRef is null");

    const carouselParams = {
      effect: "creative",
      creativeEffect: {
        prev: {
          shadow: true,
          translate: ["-125%", 0, -800],
          rotate: [0, 0, -90],
        },
        next: {
          shadow: true,
          translate: ["125%", 0, -800],
          rotate: [0, 0, 90],
        },
      },
    };

    Object.assign(carouselRef.current, carouselParams);

    setTimeout(() => {
      carouselRef.current?.initialize();
    });
  }, []);

  return (
    <div className="max-w-md">
      {/* @ts-expect-error - Swiper web components */}
      <swiper-container
        navigation="true"
        dir={direction}
        ref={carouselRef}
        init="false"
      >
        {images.map(({ img, id }) => (
          // @ts-expect-error - Swiper web components
          <swiper-slide key={id}>
            <img
              className="h-full w-full rounded-lg object-cover"
              src={img}
              alt="object"
              loading="lazy"
            />
            {/* @ts-expect-error - Swiper web components */}
          </swiper-slide>
        ))}
        {/* @ts-expect-error - Swiper web components */}
      </swiper-container>
    </div>
  );
}
