// From: https://github.com/layonez/use-request-animation-frame/blob/main/src/index.tsx

import * as React from "react";

type Config = {
  duration?: number;
  shouldAnimate?: boolean;
};

/**
 * @param nextAnimationFrameHandler Function to be called before the browser performs the next repaint. The number of callbacks is usually 60 times per second, but will generally match the display refresh rate in most web browsers.
 * @param duration Animation duration. If present, affects `progress` value passed to `nextAnimationFrameHandler` (0 < `progress` <=1). Default value: POSITIVE_INFINITY - for infinite animation.
 * @param shouldAnimate Turn animation on/off. Default value: true - enable animation from the first render
 *
 * @description keep your `nextAnimationFrameHandler` as simple and performant as possible with the least amount of dependencies and transformations. It will be called frequently and this can lead to bad UX
 */
const useRequestAnimationFrame = (
  nextAnimationFrameHandler: (progress: number) => void,
  { duration = Number.POSITIVE_INFINITY, shouldAnimate = true }: Config
) => {
  const frame = React.useRef(0);
  const firstFrameTime = React.useRef(performance.now());

  const animate = React.useCallback(
    (now: number) => {
      // calculate at what time fraction we are currently of whole time of animation
      let timeFraction = (now - firstFrameTime.current) / duration;
      if (timeFraction > 1) {
        timeFraction = 1;
      }

      if (timeFraction <= 1) {
        nextAnimationFrameHandler(timeFraction);

        // request next frame only in cases when we not reached 100% of duration
        if (timeFraction != 1) frame.current = requestAnimationFrame(animate);
      }
    },
    [duration, nextAnimationFrameHandler]
  );

  React.useEffect(() => {
    if (shouldAnimate) {
      firstFrameTime.current = performance.now();
      frame.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frame.current);
    }

    return () => cancelAnimationFrame(frame.current);
  }, [animate, shouldAnimate]);
};

export default useRequestAnimationFrame;
