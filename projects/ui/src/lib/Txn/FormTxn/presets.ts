import { FormTxn } from './types';

export const FormTxnBundlerPresets: {
  [key: string]: {
    primary: FormTxn[];
    secondary: FormTxn[];
  };
} = {
  claim: {
    primary: [FormTxn.RINSE, FormTxn.HARVEST, FormTxn.CLAIM],
    secondary: [FormTxn.MOW, FormTxn.PLANT, FormTxn.ENROOT],
  },
  enroot: {
    primary: [FormTxn.ENROOT],
    secondary: [
      FormTxn.MOW,
      FormTxn.PLANT,
      FormTxn.RINSE,
      FormTxn.HARVEST,
      FormTxn.CLAIM,
    ],
  },
  rinseHarvest: {
    primary: [FormTxn.RINSE, FormTxn.HARVEST],
    secondary: [FormTxn.MOW, FormTxn.PLANT, FormTxn.ENROOT, FormTxn.CLAIM],
  },
  plant: {
    primary: [FormTxn.PLANT],
    secondary: [
      FormTxn.MOW,
      FormTxn.ENROOT,
      FormTxn.RINSE,
      FormTxn.HARVEST,
      FormTxn.CLAIM,
    ],
  },
  noPrimary: {
    primary: [],
    secondary: [
      FormTxn.MOW,
      FormTxn.PLANT,
      FormTxn.ENROOT,
      FormTxn.RINSE,
      FormTxn.HARVEST,
      FormTxn.CLAIM,
    ],
  },
};
