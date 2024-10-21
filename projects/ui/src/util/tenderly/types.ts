import { SupportedChainId } from '~/constants';

export interface TenderlySimulateTxnParams {
  /**
   * Network ID
   */
  chainId: SupportedChainId;
  /**
   * Address initiating the transaction
   */
  from: string;
  /**
   * Recipient address of the transaction
   */
  to: string;
  /**
   * Call data string
   */
  callData: string;
  /**
   * Type of simulation to run. Applicable only in production.
   */
  simulationType?: 'full' | 'quick' | 'abi';
  /**
   * Amount of Ether (in wei) sent along with the transaction.
   */
  value?: string;
  /**
   * Amount of gas provided for the simulation.
   */
  gas?: number;
  /**
   * Number of the block to be used for the simulation.
   */
  blockNumber?: number;
}

/**
 * Tenderly simulate transaction payload
 *
 * @notes NOT for virtual testnet
 *
 * @see https://docs.tenderly.co/reference/api#/operations/simulateTransaction
 */
export interface TenderlySimulatePayload {
  /**
   * ID of the network on which the simulation is being run.
   */
  network_id: string;
  /**
   * Address initiating the transaction
   */
  from: string;
  /**
   * Recipient address of the transaction
   */
  to: string;
  /**
   * Calldata string
   */
  input: string;
  /**
   * Amount of gas provided for the simulation.
   */
  gas?: number;
  /**
   * Number of the block to be used for the simulation.
   */
  block_number?: number;
  /**
   * Index of the transaction within the block.
   */
  transaction_index?: number;
  /**
   * String representation of a number that represents price of the gas in wei.
   */
  gas_price?: string;
  /**
   * Flag that enables precise gas estimation.
   */
  estimate_gas?: boolean;
  /**
   * Amount of Ether (in wei) sent along with the transaction.
   */
  value?: string;
  /**
   * Flag indicating whether to save the simulation in dashboard UI.
   */
  save?: boolean;
  /**
   * Flag indicating whether to save failed simulation in dashboard UI.
   */
  save_failed?: boolean;
  /**
   *
   */
  simulation_type: 'full' | 'quick' | 'abi';
}

/**
 * Tenderly simulate transaction payload ONLY for virtual testnet
 *
 * @see https://docs.tenderly.co/reference/api#/operations/simulateTx
 */
export interface TenderlyVnetSimulationPayload {
  callArgs: {
    /**
     * Address initiating the transaction
     */
    from: string;
    /**
     * Recipient address of the transaction
     */
    to: string;
    /**
     * Amount of gas provided for the simulation.
     */
    gas?: string;
    /**
     * String representation of a number that represents price of the gas in wei.
     */
    gasPrice?: string;
    /**
     * Amount of Ether (in wei) sent along with the transaction.
     */
    data: string;
    /**
     * Amount of Ether (in wei) sent along with the transaction.
     */
    value?: string;
  };
  /**
   * Number of the block to be used for the simulation.
   */
  blockNumber?: string;
  blockOverrides?: {
    number: string;
    timestamp: string;
  };
  stateOverrides?: {
    [address: string]: {
      balance: string;
    };
  };
}
