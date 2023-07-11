import { ChainId } from "@beanstalk/sdk-core";

export const Blocks = {
  [ChainId.MAINNET]: {
    BEANSTALK_GENESIS_BLOCK: 12974075, // beanstalk initial launch
    BIP10_COMMITTED_BLOCK: 14148509, // marketplace live
    EXPLOIT_BLOCK: 14602789, //
    FERTILIZER_LAUNCH_BLOCK: 14915800, // first FERT purchase
    SILOV3_DEPLOYMENT_BLOCK: 17251906 // FIXME: use real block instead of test block
  }
};
