import { useEffect, useState, MutableRefObject } from 'react';

/**
 * @note unused as of 10/21/2022.
 */
export default function useDimensions(
  container: MutableRefObject<HTMLDivElement | null>
) {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: container.current?.offsetWidth ?? 0,
        height: container.current?.offsetHeight ?? 0,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return size;
}
