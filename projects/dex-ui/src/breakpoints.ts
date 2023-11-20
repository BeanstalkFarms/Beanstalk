export const size = {
  mobile: "769px",
  tablet: "1024px"
};

const mediaSizes = {
  mobile: 769,
  tablet: 1024,
  desktop: 1200
};

/// we add 1px to the mobile and tablet sizes so that the media queries don't overlap
export const mediaQuery = {
  sm: {
    // 769px & above
    up: `@media (min-width: ${mediaSizes.mobile}px)`,
    // 768px & below
    only: `@media (max-width: ${mediaSizes.mobile - 1}px)`
  },
  md: {
    // 1024px & above
    up: `@media (min-width: ${mediaSizes.tablet}px)`,
    // between 769px & 1024px
    only: `@media (min-width: ${mediaSizes.mobile}px) and (max-width: ${mediaSizes.tablet - 1}px)`,
    // 1024px & below
    down: `@media (max-width: ${mediaSizes.tablet}px)`
  },
  lg: {
    // 1200px & below
    down: `@media (max-width: ${mediaSizes.desktop}px)`,
    // 1200px & above
    only: `@media (min-width: ${mediaSizes.desktop}px)`
  },
  between: {
    // between 769px & 1200px
    smAndLg: `@media (min-width: ${mediaSizes.mobile}px) and (max-width: ${mediaSizes.desktop - 1}px)`
  }
};
