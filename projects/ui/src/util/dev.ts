import BN from 'bignumber.js';

interface WindowExtended extends Window {
  devtoolsFormatters?: Array<{
    header: (obj: any) => (string | null) | (Node[] | null);
    hasBody: (obj: any) => boolean;
  }>;
}

export const runOnDev = () => {
  if (!import.meta.env.VITE_SHOW_DEV_CHAINS) return;

  // useful in logging BigNumberJS objects in the console.
  if (typeof window !== 'undefined') {
    if (!(window as WindowExtended)?.devtoolsFormatters) {
      (window as WindowExtended).devtoolsFormatters = [];
    }
    (window as WindowExtended).devtoolsFormatters?.push({
      header: (obj: any) => {
        if (BN.isBigNumber(obj)) {
          return ['div', {}, obj.toString()] as Node[];
        }
        return null;
      },
      hasBody: () => false,
    });
  }
};
