import { FormTxn } from './types';

export const FormTxnBundlerPresets: {
  [key: string]: {
    primary: FormTxn[];
    secondary: FormTxn[];
  };
} = {
  claim: {
    primary: [FormTxn.RINSE, FormTxn.HARVEST],
    secondary: [FormTxn.MOW, FormTxn.PLANT, FormTxn.ENROOT],
  },
  enroot: {
    primary: [FormTxn.ENROOT],
    secondary: [FormTxn.MOW, FormTxn.PLANT, FormTxn.RINSE, FormTxn.HARVEST],
  },
  rinseHarvest: {
    primary: [FormTxn.RINSE, FormTxn.HARVEST],
    secondary: [FormTxn.MOW, FormTxn.PLANT, FormTxn.ENROOT],
  },
  plant: {
    primary: [FormTxn.PLANT],
    secondary: [FormTxn.MOW, FormTxn.ENROOT, FormTxn.RINSE, FormTxn.HARVEST],
  },
  noPrimary: {
    primary: [],
    secondary: [
      FormTxn.MOW,
      FormTxn.PLANT,
      FormTxn.ENROOT,
      FormTxn.RINSE,
      FormTxn.HARVEST,
    ],
  },
};
