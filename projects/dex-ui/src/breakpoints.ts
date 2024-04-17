export const size = {
  mobile: "769px",
  tablet: "1024px"
};

const mediaSizes = {
  mobile: 769,
  tablet: 1024,
  desktop: 1200
};

const BP_GAP = 0.05;

/// we subtract 0.05px to some queries to prevent overlapping
export const mediaQuery = {
  sm: {
    // 769px & above
    up: `@media (min-width: ${mediaSizes.mobile}px)`,
    // 768.95px & below
    only: `@media (max-width: ${mediaSizes.mobile - BP_GAP}px)`
  },
  md: {
    // 1024px & above
    up: `@media (min-width: ${mediaSizes.tablet}px)`,
    // between 769px & 1023.95px
    only: `@media (min-width: ${mediaSizes.mobile}px) and (max-width: ${mediaSizes.tablet - BP_GAP}px)`,
    // 1024px & below
    down: `@media (max-width: ${mediaSizes.tablet - BP_GAP}px)`
  },
  lg: {
    // 1200px & below
    down: `@media (max-width: ${mediaSizes.desktop - BP_GAP}px)`,
    // 1200px & above
    only: `@media (min-width: ${mediaSizes.desktop}px)`
  },
  between: {
    // between 769px & 1199.95px
    smAndLg: `@media (min-width: ${mediaSizes.mobile}px) and (max-width: ${mediaSizes.desktop - BP_GAP}px)`
  }
};
