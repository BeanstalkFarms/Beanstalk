import { useEffect, useState } from "react";
import { size } from "src/breakpoints";

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.matchMedia(`(max-width: ${size.mobile})`).matches);
  // Media query
  useEffect(() => {
    window.matchMedia(`(max-width: ${size.mobile})`).addEventListener("change", (event) => setIsMobile(event.matches));

    return () => {
      window.matchMedia(`(max-width: ${size.mobile})`).removeEventListener("change", (event) => setIsMobile(event.matches));
    };
  }, []);

  return isMobile;
};

export default useIsMobile;
