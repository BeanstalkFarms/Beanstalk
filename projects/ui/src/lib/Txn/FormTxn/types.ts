import { FarmToMode } from '@beanstalk/sdk';

export enum FormTxn {
  MOW = 'MOW',
  PLANT = 'PLANT',
  ENROOT = 'ENROOT',
  HARVEST = 'HARVEST',
  RINSE = 'RINSE',
  CLAIM = 'CLAIM',
}

export type FormTxnBundlerInterface = {
  preset: string | number;
  primary: FormTxn[] | undefined;
  secondary: FormTxn[] | undefined;
  implied?: FormTxn[] | undefined;
  exclude?: FormTxn[] | undefined;
  transferToMode?: FarmToMode | undefined;
};

export type FormTxnMap<T = FormTxn> = { [key in FormTxn]: T };
