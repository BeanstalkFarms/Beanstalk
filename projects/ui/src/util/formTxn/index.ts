import { BeanstalkSDK, FarmToMode, StepGenerator } from '@beanstalk/sdk';
import ethers from 'ethers';

import { DepositCrate } from '~/state/farmer/silo';

export enum FormTxn {
  MOW = 'MOW',
  PLANT = 'PLANT',
  ENROOT = 'ENROOT',
  HARVEST = 'HARVEST',
  RINSE = 'RINSE',
  CLAIM = 'CLAIM',
}

export type FormTxnMap<T> = { [key in FormTxn]: T };
export type PartialFormTxnMap<T> = Partial<FormTxnMap<T>>;

export type FormTxnParamsMap = {
  [FormTxn.RINSE]: { tokenIds: string[]; toMode?: FarmToMode };
  [FormTxn.HARVEST]: { plotIds: string[]; toMode?: FarmToMode };
  [FormTxn.CLAIM]: { token: string; seasons: string[]; toMode?: FarmToMode };
  [FormTxn.MOW]: { account: string };
  [FormTxn.PLANT]: {};
  [FormTxn.ENROOT]: { crates: Record<string, DepositCrate[]> };
};

export interface FormTxnAction {
  estimateGas: () => Promise<ethers.BigNumber>;
  getSteps: () => StepGenerator[];
}

export type FormTxnFunction<T extends FormTxn> = (
  sdk: BeanstalkSDK,
  args: FormTxnParamsMap[T]
) => FormTxnStrategy<T>;

export const FormTxnBuilderPresets: {
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

export type FormTxnBuilderInterface = {
  preset: keyof typeof FormTxnBuilderPresets;
  /**
   * actions that are required to be performed BEFORE the main action of the form
   */
  primary: FormTxn[] | undefined;
  /**
   * actions that have no effect on the main action of the form
   */
  secondary: FormTxn[] | undefined;
  /**
   * actions implied by main action of the form
   * e.g. if the main action is Deposit, 'Mow' is performed automatically
   */
  implied?: FormTxn[];
  /**
   * actions to exclude from the options
   */
  exclude?: FormTxn[];
  /**
   *
   */
  transferToMode?: FarmToMode;
};

export abstract class FormTxnStrategy<T extends FormTxn> {
  constructor(
    protected _sdk: BeanstalkSDK,
    protected _params: FormTxnParamsMap[T]
  ) {
    this._sdk = _sdk;
    this._params = _params;
  }

  abstract getSteps(): StepGenerator[];

  abstract estimateGas(): Promise<ethers.BigNumber>;
}
