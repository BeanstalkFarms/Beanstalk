import { ethers } from 'ethers';

export default interface EstimatesGas {
  estimateGas(): Promise<ethers.BigNumber>;
}
