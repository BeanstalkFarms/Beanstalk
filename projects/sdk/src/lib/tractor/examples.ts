// This test uses the Tractor SDK and core Tractor code. It represents how an end user would interact with Tractor.

import { ethers } from "ethers";
import { Blueprint, DraftAction } from "./types";
import { Drafter } from "./drafter";

// TODO use whatever SDK standard is.
const RATIO_FACTOR = ethers.BigNumber.from(10).pow(18);

// Create a Blueprint to Mow the publishers stalk.
// This function represents only one approach to implement a Mow Blueprint and is inherently biased.
function createBlueprint_mow(publisher: string) {
  const rewardRatio = RATIO_FACTOR.div(100); // 1%

  const blueprint: Blueprint = <Blueprint>{
    publisher: publisher,
    maxNonce: ethers.constants.MaxUint256,
    startTime: ethers.BigNumber.from(Math.floor(Date.now() / 1000)),
    endTime: ethers.constants.MaxUint256
  };

  // Sequence of actions.
  let draft: DraftAction[] = [];
  draft.push(Drafter.balanceOfStalkDraft(0));
  draft.push(Drafter.mowDraft(1));
  draft.push(Drafter.balanceOfStalkDraft(2));
  draft.push(Drafter.subReturnsDraft(2, 0));
  draft.push(Drafter.scaleReturnDraft(3, rewardRatio, RATIO_FACTOR));
  draft.push(Drafter.transferBeansReturnDraft(4));

  Drafter.embedDraft(blueprint, draft);
  return blueprint;
}
