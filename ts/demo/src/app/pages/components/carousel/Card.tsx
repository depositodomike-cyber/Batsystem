// Import Dependencies
import { register } from "swiper/element/bundle";

// Local Imports
import { randomId } from "@/utils/randomId";
import { useLocaleContext } from "@/app/contexts/locale/context";

// ----------------------------------------------------------------------

register();

const images = [
  { id: randomId(), img: "/images/objects/object-9.jpg" },
  { id: randomId(), img: "/images/objects/object-3.jpg" },
  { id: randomId(), img: "/images/objects/object-2.jpg" },
  { id: randomId(), img: "/images/objects/object-6.jpg" },
];

export function Card() {
  const { direction } = useLocaleContext();

  return (
    <div className="w-10/12 max-w-md">
      {/* @ts-expect-error - Swiper web components */}
      <swiper-container
        effect="cards"
        navigation="true"
        grabCursor="true"
        slides-per-view="1"
        dir={direction}
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
