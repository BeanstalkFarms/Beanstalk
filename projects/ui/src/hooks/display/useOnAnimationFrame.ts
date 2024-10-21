import { useState, useEffect } from "react";

export default function useOnAnimationFrame() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsReady(true);
    });
  }, []);

  return isReady;
}
