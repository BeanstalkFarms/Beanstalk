import { SupportedChainId } from './chains';

export const DEPLOYMENT_BLOCKS = {
  [SupportedChainId.MAINNET]: {
    BEANSTALK_GENESIS_BLOCK:  12974075, // beanstalk initial launch
    BIP10_COMMITTED_BLOCK:    14148509, // marketplace live
    EXPLOIT_BLOCK:            14602789, // 
    FERTILIZER_LAUNCH_BLOCK:  14915800, // first FERT purchase
  }
};
