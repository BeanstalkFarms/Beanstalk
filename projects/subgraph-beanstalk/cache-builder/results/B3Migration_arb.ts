/* This is a generated file */

import { BigInt } from "@graphprotocol/graph-ts";

class FieldInitialValues {
  numberOfSowers: i32;
  numberOfSows: i32;
  sownBeans: BigInt;
  harvestedPods: BigInt;
}

class PodMarketplaceInitialValues {
  filledListedPods: BigInt;
  expiredListedPods: BigInt;
  cancelledListedPods: BigInt;
  filledOrderBeans: BigInt;
  filledOrderedPods: BigInt;
  cancelledOrderBeans: BigInt;
  podVolume: BigInt;
  beanVolume: BigInt;
}

class UnripeTokenInitialValues {
  tokenType: string;
  totalChoppedAmount: BigInt;
  totalChoppedBdv: BigInt;
  totalChoppedBdvReceived: BigInt;
}

export const SEASON_INITIAL = 24484;

export const FIELD_INITIAL_VALUES: FieldInitialValues = {
  numberOfSowers: 0,
  numberOfSows: 19172,
  sownBeans: BigInt.fromString("33592460721984"),
  harvestedPods: BigInt.fromString("61126608133951")
};

export const POD_MARKETPLACE_INITIAL_VALUES: PodMarketplaceInitialValues = {
  filledListedPods: BigInt.fromString("49222911145993"),
  expiredListedPods: BigInt.fromString("7065428228776"),
  cancelledListedPods: BigInt.fromString("60134193309316"),
  filledOrderBeans: BigInt.fromString("762556935865"),
  filledOrderedPods: BigInt.fromString("14851692494599"),
  cancelledOrderBeans: BigInt.fromString("1308742101463"),
  podVolume: BigInt.fromString("64074603640592"),
  beanVolume: BigInt.fromString("6508703985303")
};

export const UNRIPE_TOKENS_INITIAL_VALUES: UnripeTokenInitialValues[] = [
  {
    tokenType: "urbean",
    totalChoppedAmount: BigInt.fromString("24665725897573"),
    totalChoppedBdv: BigInt.fromString("5882168812974"),
    totalChoppedBdvReceived: BigInt.fromString("1334001323440")
  },
  {
    tokenType: "urlp",
    totalChoppedAmount: BigInt.fromString("7250545162321"),
    totalChoppedBdv: BigInt.fromString("2529372423798"),
    totalChoppedBdvReceived: BigInt.fromString("508153566375")
  }
];
