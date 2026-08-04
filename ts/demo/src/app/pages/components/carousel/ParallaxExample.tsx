// Import Dependencies
import { useRef, useLayoutEffect } from "react";
import { register } from "swiper/element/bundle";
import type { SwiperContainer } from "swiper/element";
import invariant from "tiny-invariant";

// Local Imports
import { useThemeContext } from "@/app/contexts/theme/context";
import { useLocaleContext } from "@/app/contexts/locale/context";

// ----------------------------------------------------------------------

register();

export function ParallaxExample() {
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
        class="h-64 overflow-hidden rounded-lg"
        speed="600"
        parallax="true"
        navigation="true"
        dir={direction}
        style={
          {
            "--swiper-navigation-size": "32px",
            "--swiper-theme-color": primary[400],
            "--swiper-pagination-color": primary[600],
          } as React.CSSProperties
        }
      >
        <div
          slot="container-start"
          className="parallax-bg absolute top-0 h-full rounded-lg bg-cover bg-center ltr:left-0 rtl:right-0"
          style={{
            backgroundImage: `url('/images/objects/object-2.jpg')`,
            width: "130%",
          }}
          data-swiper-parallax="-23%"
        ></div>

        {/* @ts-expect-error - Swiper web components */}

        <swiper-slide class="px-8 py-6 lg:px-12">
          <div
            className="title text-2xl font-light text-white"
            data-swiper-parallax="-300"
          >
            Slide 1
          </div>
          <div
            className="subtitle mt-1 grow text-xl text-white"
            data-swiper-parallax="-200"
          >
            Subtitle
          </div>
          <div className="text mt-4 text-white" data-swiper-parallax="-100">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ab at,
              consectetur cupiditate debitis expedita fugit, modi nemo nobis
              odit perferendis quaerat quia reiciendis repudiandae rerum sed?
            </p>
          </div>
          {/* @ts-expect-error - Swiper web components */}
        </swiper-slide>

        {/* @ts-expect-error - Swiper web components */}

        <swiper-slide class="px-8 py-6 lg:px-12">
          <div
            className="title text-2xl font-light text-white"
            data-swiper-parallax="-300"
          >
            Slide 2
          </div>
          <div
            className="subtitle mt-1 grow text-xl text-white"
            data-swiper-parallax="-200"
          >
            Subtitle
          </div>
          <div className="text mt-4 text-white" data-swiper-parallax="-100">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ab at,
              consectetur cupiditate debitis expedita fugit, modi nemo nobis
              odit perferendis quaerat quia reiciendis repudiandae rerum sed?
            </p>
          </div>
          {/* @ts-expect-error - Swiper web components */}
        </swiper-slide>

        {/* @ts-expect-error - Swiper web components */}

        <swiper-slide class="px-8 py-6 lg:px-12">
          <div
            className="title text-2xl font-light text-white"
            data-swiper-parallax="-300"
          >
            Slide 3
          </div>
          <div
            className="subtitle mt-1 grow text-xl text-white"
            data-swiper-parallax="-200"
          >
            Subtitle
          </div>
          <div className="text mt-4 text-white" data-swiper-parallax="-100">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ab at,
              consectetur cupiditate debitis expedita fugit, modi nemo nobis
              odit perferendis quaerat quia reiciendis repudiandae rerum sed?
            </p>
          </div>
          {/* @ts-expect-error - Swiper web components */}
        </swiper-slide>

        {/* @ts-expect-error - Swiper web components */}
      </swiper-container>
    </div>
  );
}
