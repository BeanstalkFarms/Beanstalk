import { ChainResolver } from '@beanstalk/sdk-core';
import {
  TenderlySimulatePayload,
  TenderlySimulateTxnParams,
  TenderlyVnetSimulationPayload,
} from './types';

const TENDERLY_API_KEY = import.meta.env.VITE_TENDERLY_ACCESS_KEY;

const TENDERLY_ACCOUNT_SLUG = import.meta.env.VITE_TENDERLY_ACCOUNT_SLUG;

const TENDERLY_PROJECT_SLUG = import.meta.env.VITE_TENDERLY_PROJECT_SLUG;

const TENDERLY_VNET_ID = import.meta.env.VITE_TENDERLY_VNET_ID;

const isDevMode = import.meta.env.DEV;

const baseEndpoint = 'https://api.tenderly.co/api/v1/account/';

const tenderlyEndpoint = `${baseEndpoint}/${TENDERLY_ACCOUNT_SLUG}/project/${TENDERLY_PROJECT_SLUG}`;

const testnetEndpoint = `${tenderlyEndpoint}/vnetId/${TENDERLY_VNET_ID}`;

type RequestInit = {
  signal?: AbortSignal;
};

const baseHeaders = new Headers({
  'Content-Type': 'application/json',
  'X-Access-Key': TENDERLY_API_KEY,
});

const tenderlyVnetSimulateTxn = async (
  payload: TenderlySimulateTxnParams,
  requestInit?: RequestInit
) => {
  const endpoint = `${testnetEndpoint}/transactions/simulate`;

  const params: TenderlyVnetSimulationPayload = {
    callArgs: {
      from: payload.from,
      to: payload.to,
      gas: payload.gas?.toString(),
      data: payload.callData,
      value: payload.value,
    },
  };

  if (payload.blockNumber) {
    params.blockNumber = payload.blockNumber.toString();
  }

  const options = {
    ...requestInit,
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify(params),
  };

  return fetch(endpoint, options);
};

const tenderlyProdSimulateTxn = async (
  payload: TenderlySimulateTxnParams,
  requestInit?: RequestInit
) => {
  const endpoint = `${tenderlyEndpoint}/simulate`;

  const params: TenderlySimulatePayload = {
    network_id: payload.chainId.toString(),
    from: payload.from,
    to: payload.to,
    input: payload.callData,
    gas: payload.gas,
    simulation_type: payload.simulationType || 'full',
    value: payload.value,
    block_number: payload.blockNumber,
  };

  const options = {
    ...requestInit,
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify(params),
  };

  return fetch(endpoint, options);
};

export const tenderlySimulateTxn = async (
  payload: TenderlySimulateTxnParams,
  requestInit?: RequestInit
) => {
  const requestFn =
    isDevMode && ChainResolver.isTestnet(payload.chainId)
      ? tenderlyVnetSimulateTxn
      : tenderlyProdSimulateTxn;

  try {
    return requestFn(payload, requestInit).then((response) => {
      if (!response.ok) {
        throw new Error(`Error simulating transaction: ${response.status}`);
      }

      const remaining = response.headers.get('X-Tdly-Limit');
      const resetTimeStamp = response.headers.get('X-Tdly-Reset-Timestamp');

      console.debug(
        `[TENDERLY]: ${remaining} requests remaining. Reset at ${resetTimeStamp}`
      );

      const data = response.json();

      console.debug(`[TENDERLY] SUCCESS. response:`, response);

      return {
        requestInfo: {
          remaining,
          resetTimeStamp,
        },
        ...data,
      };
    });
  } catch (error) {
    console.error('Error simulating transaction', error);
    throw error;
  }
};
