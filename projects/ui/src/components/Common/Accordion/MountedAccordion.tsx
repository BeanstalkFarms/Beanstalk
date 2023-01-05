import React, { useRef, useEffect, useMemo } from 'react';
import { useSpring, animated, config } from 'react-spring';
import { FC } from '~/types';

type SpringConfig = {
  tension?: number;
  friction?: number;
  duration?: number;
};
const DEFAULT_DURATION = 200;

/**
 * transitions from 0px height to component height & mounts and unmounts according to open prop
 */
const MountedAccordion: FC<{
  open: boolean;
  config?: Partial<SpringConfig>;
  style?: React.CSSProperties;
}> = ({ open, style, children, config: _config }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [transitions, animate] = useSpring(() => ({ height: '0px' }), []);

  const animationConfig: SpringConfig = useMemo(
    () => ({
      ...config.stiff,
      duration: DEFAULT_DURATION,
      ..._config,
    }),
    [_config]
  );

  useEffect(() => {
    animate({
      height: `${open ? ref?.current?.offsetHeight : 0}px`,
      config: animationConfig,
    });
  }, [animate, open, animationConfig]);

  return (
    <animated.div style={{ ...style, ...transitions, overflow: 'hidden' }}>
      <div ref={ref}>{open ? children : null}</div>
    </animated.div>
  );
};

export default MountedAccordion;
