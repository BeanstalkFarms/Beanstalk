import { createAction } from '@reduxjs/toolkit';
import { EthGasPrices, Globals, Settings } from '.';

// export const setAlmanacView = createAction<boolean>(
//   'app/setAlmanacView'
// );

export const setGasPrices = createAction<EthGasPrices | null>(
  'app/setGasPrices'
);

type SettingsPayload<T extends keyof Settings> = {
  key: T;
  value: Settings[T];
};

export const updateSetting =
  createAction<SettingsPayload<keyof Settings>>('app/updateSetting');

type GlobalsPayload<T extends keyof Globals> = {
  key: T;
  value: Globals[T];
};

export const setGlobal =
  createAction<GlobalsPayload<keyof Globals>>('app/setGlobal');
