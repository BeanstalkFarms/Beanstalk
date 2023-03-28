import React from 'react';

import { Stack, SxProps, Theme } from '@mui/material';
import { animated } from 'react-spring';
import PaginationControl from '../PaginationControl';
import {
  CarouselConfigProps,
  CarouselProvider,
  useCarousel,
  CarouselProps,
  useCarouselConfig,
} from './CarouselProvider';

export default function Carousel({ total, children }: CarouselProps) {
  return <CarouselProvider total={total}>{children}</CarouselProvider>;
}

interface CarouselPaginationProps {
  wrapperSx?: React.CSSProperties | SxProps<Theme>;
  sx?: React.CSSProperties | SxProps<Theme>;
}

Carousel.Pagination = function NewCarouselPagination({
  wrapperSx,
  sx,
}: CarouselPaginationProps) {
  const { total, page, updateStep } = useCarousel();
  return (
    <Stack sx={{ position: 'relative', ...wrapperSx }}>
      <Stack sx={{ ...sx }}>
        <PaginationControl total={total} page={page} onPageClick={updateStep} />
      </Stack>
    </Stack>
  );
};

interface CarouselElementsProps extends CarouselConfigProps {
  elements: JSX.Element[];
  sx?: React.CSSProperties | SxProps<Theme>;
}

Carousel.Elements = function NewCarouselElements({
  elements,
  sx,
  disableSlide = false,
  disableFade = false,
  duration = 300,
  override = undefined,
}: CarouselElementsProps) {
  const transitions = useCarouselConfig({
    disableSlide,
    disableFade,
    duration,
    override,
  });

  return (
    <Stack width="100%" sx={{ overflow: 'hidden', ...sx }}>
      {transitions((style, i) => (
        <animated.div key={i} style={style}>
          {elements[i]}
        </animated.div>
      ))}
    </Stack>
  );
};
