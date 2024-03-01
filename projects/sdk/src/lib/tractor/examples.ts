// This test uses the Tractor SDK and core Tractor code. It represents how an end user would interact with Tractor.

import { ethers } from "ethers";
import {
  AdvancedFarmCall,
  Blueprint,
  Draft,
  OperatorPasteInstr,
  encodeBlueprintData,
  encodeOperatorPasteInstrs
} from "./types";
import { Drafter } from "./drafter";

// Create a Blueprint to Mow the publishers stalk.
// This function represents only one approach to implement a Mow Blueprint and is inherently biased.
function createBlueprint_mow(publisher: string) {
  const blueprint: Blueprint = <Blueprint>{
    publisher: publisher,
    maxNonce: ethers.constants.MaxUint256,
    startTime: ethers.BigNumber.from(Math.floor(Date.now() / 1000)),
    endTime: ethers.constants.MaxUint256
  };

  let draft: Draft;

  draft = Drafter.balanceOfStalkDraft(0);
  draft = Drafter.concatDrafts(draft, Drafter.mowDraft(1));
  draft = Drafter.concatDrafts(draft, Drafter.balanceOfStalkDraft(2));
  draft = // need to use clipboard

  Drafter.embedDraft(blueprint, encodeBlueprintData(blueprint, draft));
  return blueprint;
}
