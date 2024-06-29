import { useState, useEffect, useRef } from "react";

// Define a type for the dimensions
export type ElementDimensions = {
  width: number;
  height: number;
};

// Hook to get element dimensions using a ref
function useElementDimensions(): [React.RefObject<HTMLDivElement>, ElementDimensions] {
  const ref = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ElementDimensions>({
    width: 0, // Default width
    height: 0 // Default height
  });

  useEffect(() => {
    // Function to update dimensions
    const updateDimensions = () => {
      if (!ref.current) return;

      setDimensions({
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight
      });
    };

    // Update dimensions initially and whenever the window resizes
    window.addEventListener("resize", updateDimensions);
    updateDimensions(); // Initial dimensions update

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []); // Effect runs only once on mount

  return [ref, dimensions];
}

export default useElementDimensions;
