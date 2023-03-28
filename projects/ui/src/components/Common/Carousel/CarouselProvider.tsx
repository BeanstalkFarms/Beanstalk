import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
  useContext,
  useMemo,
} from 'react';

import { SpringRef, useSpringRef, useTransition } from 'react-spring';
import { Lookup } from '@react-spring/types';
import { FC } from '~/types';

export type SlideDirection = 'right' | 'left';

export interface CarouselConfigProps {
  // disable translateX animation
  disableSlide?: boolean;
  // disable opacity animation
  disableFade?: boolean;
  // duration of animation in ms
  duration?: number;
  // override all and use only custom animation transitions
  override?:
    | any
    | ((props?: { direction: SlideDirection; page: number }) => any);
}

export interface CarouselProps {
  children: React.ReactNode;
  total: number;
}

interface CarouselContextReturn {
  springRef: SpringRef<Lookup<any>>;
  page: number;
  direction: SlideDirection;
  total: number;
  updateStep: (newStep: number) => void;
}

interface CarouselState {
  page: number;
  direction: SlideDirection;
}

const useCarouselController = ({
  total,
}: {
  total: number;
}): CarouselContextReturn => {
  const [{ page, direction }, setState] = useState<CarouselState>({
    page: 0,
    direction: 'right',
  });
  const springRef: SpringRef<Lookup<any>> = useSpringRef();

  const updateStep = useCallback(
    (val: number) => {
      if (val < 0 || val >= total) return;
      setState({
        direction: val > page ? 'right' : 'left',
        page: val,
      });
    },
    [page, total]
  );

  useEffect(() => {
    springRef.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return { springRef, total, page, direction, updateStep };
};

const CarouselContext = createContext<CarouselContextReturn | undefined>(
  undefined
);

export const CarouselProvider: FC<CarouselProps> = ({ total, children }) => (
  <CarouselContext.Provider value={useCarouselController({ total })}>
    {children}
  </CarouselContext.Provider>
);

export const useCarousel = () => {
  const carouselContext = useContext(CarouselContext);
  if (!carouselContext) {
    throw new Error(
      'No CarouselContext.Provider found when calling useCarousel.'
    );
  }
  return carouselContext;
};

export const useCarouselConfig = ({
  disableSlide = false,
  disableFade = false,
  duration = 200,
  override = undefined,
}: CarouselConfigProps) => {
  const { direction, springRef, page } = useCarousel();

  const overrideConfig = useMemo(() => {
    if (!override) return undefined;
    if (override.config instanceof Function) {
      return override.config({ direction: direction, page: page });
    }
    return override.config;
  }, [direction, override, page]);

  const config = useMemo(() => {
    if (overrideConfig) return { ...overrideConfig };

    const NO_TRANSITION = 'translateX(0%)';

    return {
      initial: {
        opacity: 1,
        transform: NO_TRANSITION,
      },
      from: {
        opacity: !disableFade ? 0 : 1,
        transform: !disableSlide
          ? `translateX(${direction === 'right' ? '100%' : '-100%'})`
          : NO_TRANSITION,
      },
      enter: {
        opacity: 1,
        transform: NO_TRANSITION,
      },
      leave: {
        opacity: !disableFade ? 0 : 1,
        transform: !disableSlide
          ? `translateX(${direction === 'right' ? '-100%' : '100%'})`
          : NO_TRANSITION,
      },
      exitBeforeEnter: true,
      config: { duration: duration },
    };
  }, [direction, disableFade, disableSlide, duration, overrideConfig]);

  const transitions = useTransition(page, {
    ref: springRef,
    keys: null,
    ...config,
  });

  return transitions;
};
