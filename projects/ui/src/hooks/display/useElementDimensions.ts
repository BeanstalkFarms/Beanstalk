import { useEffect, useState, RefObject } from 'react';

export interface Dimensions {
  width: number;
  height: number;
}

function useElementDimensions(ref: RefObject<HTMLElement>): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (ref.current) {
        const { clientWidth, clientHeight } = ref.current;
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    // Initial calculation
    updateDimensions();

    // Add event listener for window resize
    window.addEventListener('resize', updateDimensions);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [ref]);

  return dimensions;
}

export default useElementDimensions;
