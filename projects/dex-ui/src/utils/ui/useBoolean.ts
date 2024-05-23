import { useState, useMemo } from "react";

export const useBoolean = (
  initialValue?: boolean
): readonly [
  boolean,
  {
    set: (val: boolean) => void;
    toggle: () => void;
  }
] => {
  const [value, setValue] = useState(initialValue ?? false);

  const utils = useMemo(() => {
    const set = (val: boolean) => setValue(val);
    const toggle = () => setValue((prev) => !prev);

    return {
      toggle,
      set
    };
  }, []);

  return [value, utils] as const;
};
