/* This is a generated file */

import { BigInt, BigDecimal, Bytes, Address } from "@graphprotocol/graph-ts";

class SiloInitialValues {
  beanToMaxLpGpPerBdvRatio: BigInt;
}

class FieldInitialValues {
  numberOfSowers: i32;
  numberOfSows: i32;
  sownBeans: BigInt;
  harvestedPods: BigInt;
  podIndex: BigInt;
  harvestableIndex: BigInt;
  temperature: i32;
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

export class FertilizerTokenInfo {
  id: BigInt;
  humidity: BigDecimal;
  season: i32;
  startBpf: BigInt;
}

class UnripeTokenInitialValues {
  tokenType: string;
  totalChoppedAmount: BigInt;
  totalChoppedBdv: BigInt;
  totalChoppedBdvReceived: BigInt;
}

class WhitelistTokenEvent {
  token: Address;
  selector: Bytes;
  stalkEarnedPerSeason: BigInt;
  stalkIssuedPerBdv: BigInt;
  gaugePoints: BigInt;
  optimalPercentDepositedBdv: BigInt;
  isWell: boolean;
}

export const SEASON_INITIAL = 25129;

export const SILO_INITIAL_VALUES: SiloInitialValues = {
  beanToMaxLpGpPerBdvRatio: BigInt.fromString("100000000000000000000")
};

export const FIELD_INITIAL_VALUES: FieldInitialValues = {
  numberOfSowers: 1640,
  numberOfSows: 19742,
  sownBeans: BigInt.fromString("33592461174965"),
  harvestedPods: BigInt.fromString("61126608133951"),
  podIndex: BigInt.fromString("980532104448065"),
  harvestableIndex: BigInt.fromString("61128909242563"),
  temperature: 25147
};

export const POD_MARKETPLACE_INITIAL_VALUES: PodMarketplaceInitialValues = {
  filledListedPods: BigInt.fromString("49222911145993"),
  expiredListedPods: BigInt.fromString("7065428228776"),
  cancelledListedPods: BigInt.fromString("60188635627948"),
  filledOrderBeans: BigInt.fromString("763175980418"),
  filledOrderedPods: BigInt.fromString("14858570767416"),
  cancelledOrderBeans: BigInt.fromString("1308742101463"),
  podVolume: BigInt.fromString("64081481913409"),
  beanVolume: BigInt.fromString("6509323029856")
};

export const FERT_TOKEN_INFO_CACHED: FertilizerTokenInfo[] = [
  {
    id: BigInt.fromString("1334303"),
    humidity: BigDecimal.fromString("20"),
    season: 6624,
    startBpf: BigInt.fromString("134303")
  },
  {
    id: BigInt.fromString("1334880"),
    humidity: BigDecimal.fromString("20"),
    season: 6997,
    startBpf: BigInt.fromString("134880")
  },
  {
    id: BigInt.fromString("1334901"),
    humidity: BigDecimal.fromString("20"),
    season: 7041,
    startBpf: BigInt.fromString("134901")
  },
  {
    id: BigInt.fromString("1334925"),
    humidity: BigDecimal.fromString("20"),
    season: 7151,
    startBpf: BigInt.fromString("134925")
  },
  {
    id: BigInt.fromString("1335008"),
    humidity: BigDecimal.fromString("20"),
    season: 7733,
    startBpf: BigInt.fromString("135008")
  },
  {
    id: BigInt.fromString("1335068"),
    humidity: BigDecimal.fromString("20"),
    season: 7824,
    startBpf: BigInt.fromString("135068")
  },
  {
    id: BigInt.fromString("1335304"),
    humidity: BigDecimal.fromString("20"),
    season: 7886,
    startBpf: BigInt.fromString("135304")
  },
  {
    id: BigInt.fromString("1336323"),
    humidity: BigDecimal.fromString("20"),
    season: 8017,
    startBpf: BigInt.fromString("136323")
  },
  {
    id: BigInt.fromString("1337953"),
    humidity: BigDecimal.fromString("20"),
    season: 8110,
    startBpf: BigInt.fromString("137953")
  },
  {
    id: BigInt.fromString("1338731"),
    humidity: BigDecimal.fromString("20"),
    season: 8153,
    startBpf: BigInt.fromString("138731")
  },
  {
    id: BigInt.fromString("1348369"),
    humidity: BigDecimal.fromString("20"),
    season: 8741,
    startBpf: BigInt.fromString("148369")
  },
  {
    id: BigInt.fromString("1363069"),
    humidity: BigDecimal.fromString("20"),
    season: 15928,
    startBpf: BigInt.fromString("163069")
  },
  {
    id: BigInt.fromString("1363641"),
    humidity: BigDecimal.fromString("20"),
    season: 15973,
    startBpf: BigInt.fromString("163641")
  },
  {
    id: BigInt.fromString("1418854"),
    humidity: BigDecimal.fromString("28.5"),
    season: 6517,
    startBpf: BigInt.fromString("133854")
  },
  {
    id: BigInt.fromString("1553682"),
    humidity: BigDecimal.fromString("42"),
    season: 6490,
    startBpf: BigInt.fromString("133682")
  },
  {
    id: BigInt.fromString("1593637"),
    humidity: BigDecimal.fromString("46"),
    season: 6482,
    startBpf: BigInt.fromString("133637")
  },
  {
    id: BigInt.fromString("2078193"),
    humidity: BigDecimal.fromString("94.5"),
    season: 6385,
    startBpf: BigInt.fromString("133193")
  },
  {
    id: BigInt.fromString("2313052"),
    humidity: BigDecimal.fromString("118"),
    season: 6338,
    startBpf: BigInt.fromString("133052")
  },
  {
    id: BigInt.fromString("2373025"),
    humidity: BigDecimal.fromString("124"),
    season: 6326,
    startBpf: BigInt.fromString("133025")
  },
  {
    id: BigInt.fromString("2382999"),
    humidity: BigDecimal.fromString("125"),
    season: 6324,
    startBpf: BigInt.fromString("132999")
  },
  {
    id: BigInt.fromString("2412881"),
    humidity: BigDecimal.fromString("128"),
    season: 6318,
    startBpf: BigInt.fromString("132881")
  },
  {
    id: BigInt.fromString("2452755"),
    humidity: BigDecimal.fromString("132"),
    season: 6310,
    startBpf: BigInt.fromString("132755")
  },
  {
    id: BigInt.fromString("2482696"),
    humidity: BigDecimal.fromString("135"),
    season: 6304,
    startBpf: BigInt.fromString("132696")
  },
  {
    id: BigInt.fromString("2492679"),
    humidity: BigDecimal.fromString("136"),
    season: 6302,
    startBpf: BigInt.fromString("132679")
  },
  {
    id: BigInt.fromString("2502666"),
    humidity: BigDecimal.fromString("137"),
    season: 6300,
    startBpf: BigInt.fromString("132666")
  },
  {
    id: BigInt.fromString("2687438"),
    humidity: BigDecimal.fromString("155.5"),
    season: 6263,
    startBpf: BigInt.fromString("132438")
  },
  {
    id: BigInt.fromString("2702430"),
    humidity: BigDecimal.fromString("157"),
    season: 6260,
    startBpf: BigInt.fromString("132430")
  },
  {
    id: BigInt.fromString("2767422"),
    humidity: BigDecimal.fromString("163.5"),
    season: 6247,
    startBpf: BigInt.fromString("132422")
  },
  {
    id: BigInt.fromString("2811995"),
    humidity: BigDecimal.fromString("168"),
    season: 6238,
    startBpf: BigInt.fromString("131995")
  },
  {
    id: BigInt.fromString("2871153"),
    humidity: BigDecimal.fromString("174"),
    season: 6226,
    startBpf: BigInt.fromString("131153")
  },
  {
    id: BigInt.fromString("2886153"),
    humidity: BigDecimal.fromString("175.5"),
    season: 6223,
    startBpf: BigInt.fromString("131153")
  },
  {
    id: BigInt.fromString("2891153"),
    humidity: BigDecimal.fromString("176"),
    season: 6222,
    startBpf: BigInt.fromString("131153")
  },
  {
    id: BigInt.fromString("2901153"),
    humidity: BigDecimal.fromString("177"),
    season: 6220,
    startBpf: BigInt.fromString("131153")
  },
  {
    id: BigInt.fromString("2921113"),
    humidity: BigDecimal.fromString("179"),
    season: 6216,
    startBpf: BigInt.fromString("131113")
  },
  {
    id: BigInt.fromString("2945769"),
    humidity: BigDecimal.fromString("181.5"),
    season: 6211,
    startBpf: BigInt.fromString("130769")
  },
  {
    id: BigInt.fromString("2955590"),
    humidity: BigDecimal.fromString("182.5"),
    season: 6209,
    startBpf: BigInt.fromString("130590")
  },
  {
    id: BigInt.fromString("2975557"),
    humidity: BigDecimal.fromString("184.5"),
    season: 6205,
    startBpf: BigInt.fromString("130557")
  },
  {
    id: BigInt.fromString("3005557"),
    humidity: BigDecimal.fromString("187.5"),
    season: 6199,
    startBpf: BigInt.fromString("130557")
  },
  {
    id: BigInt.fromString("3015555"),
    humidity: BigDecimal.fromString("188.5"),
    season: 6197,
    startBpf: BigInt.fromString("130555")
  },
  {
    id: BigInt.fromString("3045431"),
    humidity: BigDecimal.fromString("191.5"),
    season: 6191,
    startBpf: BigInt.fromString("130431")
  },
  {
    id: BigInt.fromString("3060408"),
    humidity: BigDecimal.fromString("193"),
    season: 6188,
    startBpf: BigInt.fromString("130408")
  },
  {
    id: BigInt.fromString("3095329"),
    humidity: BigDecimal.fromString("196.5"),
    season: 6181,
    startBpf: BigInt.fromString("130329")
  },
  {
    id: BigInt.fromString("3125329"),
    humidity: BigDecimal.fromString("199.5"),
    season: 6175,
    startBpf: BigInt.fromString("130329")
  },
  {
    id: BigInt.fromString("3130329"),
    humidity: BigDecimal.fromString("200"),
    season: 6174,
    startBpf: BigInt.fromString("130329")
  },
  {
    id: BigInt.fromString("3164439"),
    humidity: BigDecimal.fromString("203.5"),
    season: 6167,
    startBpf: BigInt.fromString("129439")
  },
  {
    id: BigInt.fromString("3223426"),
    humidity: BigDecimal.fromString("209.5"),
    season: 6155,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3268426"),
    humidity: BigDecimal.fromString("214"),
    season: 6146,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3278426"),
    humidity: BigDecimal.fromString("215"),
    season: 6144,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3293426"),
    humidity: BigDecimal.fromString("216.5"),
    season: 6141,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3303426"),
    humidity: BigDecimal.fromString("217.5"),
    season: 6139,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3308426"),
    humidity: BigDecimal.fromString("218"),
    season: 6138,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3313426"),
    humidity: BigDecimal.fromString("218.5"),
    season: 6137,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3328426"),
    humidity: BigDecimal.fromString("220"),
    season: 6134,
    startBpf: BigInt.fromString("128426")
  },
  {
    id: BigInt.fromString("3338293"),
    humidity: BigDecimal.fromString("221"),
    season: 6132,
    startBpf: BigInt.fromString("128293")
  },
  {
    id: BigInt.fromString("3343293"),
    humidity: BigDecimal.fromString("221.5"),
    season: 6131,
    startBpf: BigInt.fromString("128293")
  },
  {
    id: BigInt.fromString("3363293"),
    humidity: BigDecimal.fromString("223.5"),
    season: 6127,
    startBpf: BigInt.fromString("128293")
  },
  {
    id: BigInt.fromString("3383071"),
    humidity: BigDecimal.fromString("225.5"),
    season: 6123,
    startBpf: BigInt.fromString("128071")
  },
  {
    id: BigInt.fromString("3393052"),
    humidity: BigDecimal.fromString("226.5"),
    season: 6121,
    startBpf: BigInt.fromString("128052")
  },
  {
    id: BigInt.fromString("3398029"),
    humidity: BigDecimal.fromString("227"),
    season: 6120,
    startBpf: BigInt.fromString("128029")
  },
  {
    id: BigInt.fromString("3413005"),
    humidity: BigDecimal.fromString("228.5"),
    season: 6117,
    startBpf: BigInt.fromString("128005")
  },
  {
    id: BigInt.fromString("3418005"),
    humidity: BigDecimal.fromString("229"),
    season: 6116,
    startBpf: BigInt.fromString("128005")
  },
  {
    id: BigInt.fromString("3423005"),
    humidity: BigDecimal.fromString("229.5"),
    season: 6115,
    startBpf: BigInt.fromString("128005")
  },
  {
    id: BigInt.fromString("3428005"),
    humidity: BigDecimal.fromString("230"),
    season: 6114,
    startBpf: BigInt.fromString("128005")
  },
  {
    id: BigInt.fromString("3433005"),
    humidity: BigDecimal.fromString("230.5"),
    season: 6113,
    startBpf: BigInt.fromString("128005")
  },
  {
    id: BigInt.fromString("3438005"),
    humidity: BigDecimal.fromString("231"),
    season: 6112,
    startBpf: BigInt.fromString("128005")
  },
  {
    id: BigInt.fromString("3439448"),
    humidity: BigDecimal.fromString("241"),
    season: 6092,
    startBpf: BigInt.fromString("29448")
  },
  {
    id: BigInt.fromString("3441470"),
    humidity: BigDecimal.fromString("241.5"),
    season: 6091,
    startBpf: BigInt.fromString("26470")
  },
  {
    id: BigInt.fromString("3441822"),
    humidity: BigDecimal.fromString("240.5"),
    season: 6093,
    startBpf: BigInt.fromString("36822")
  },
  {
    id: BigInt.fromString("3443005"),
    humidity: BigDecimal.fromString("231.5"),
    season: 6111,
    startBpf: BigInt.fromString("128005")
  },
  {
    id: BigInt.fromString("3443526"),
    humidity: BigDecimal.fromString("242"),
    season: 6090,
    startBpf: BigInt.fromString("23526")
  },
  {
    id: BigInt.fromString("3445713"),
    humidity: BigDecimal.fromString("242.5"),
    season: 6089,
    startBpf: BigInt.fromString("20713")
  },
  {
    id: BigInt.fromString("3446568"),
    humidity: BigDecimal.fromString("240"),
    season: 6094,
    startBpf: BigInt.fromString("46568")
  },
  {
    id: BigInt.fromString("3447839"),
    humidity: BigDecimal.fromString("243"),
    season: 6088,
    startBpf: BigInt.fromString("17839")
  },
  {
    id: BigInt.fromString("3447990"),
    humidity: BigDecimal.fromString("232"),
    season: 6110,
    startBpf: BigInt.fromString("127990")
  },
  {
    id: BigInt.fromString("3450159"),
    humidity: BigDecimal.fromString("243.5"),
    season: 6087,
    startBpf: BigInt.fromString("15159")
  },
  {
    id: BigInt.fromString("3452316"),
    humidity: BigDecimal.fromString("239.5"),
    season: 6095,
    startBpf: BigInt.fromString("57316")
  },
  {
    id: BigInt.fromString("3452735"),
    humidity: BigDecimal.fromString("244"),
    season: 6086,
    startBpf: BigInt.fromString("12735")
  },
  {
    id: BigInt.fromString("3452989"),
    humidity: BigDecimal.fromString("232.5"),
    season: 6109,
    startBpf: BigInt.fromString("127989")
  },
  {
    id: BigInt.fromString("3455539"),
    humidity: BigDecimal.fromString("244.5"),
    season: 6085,
    startBpf: BigInt.fromString("10539")
  },
  {
    id: BigInt.fromString("3457989"),
    humidity: BigDecimal.fromString("233"),
    season: 6108,
    startBpf: BigInt.fromString("127989")
  },
  {
    id: BigInt.fromString("3458512"),
    humidity: BigDecimal.fromString("239"),
    season: 6096,
    startBpf: BigInt.fromString("68512")
  },
  {
    id: BigInt.fromString("3458531"),
    humidity: BigDecimal.fromString("245"),
    season: 6084,
    startBpf: BigInt.fromString("8531")
  },
  {
    id: BigInt.fromString("3461694"),
    humidity: BigDecimal.fromString("245.5"),
    season: 6083,
    startBpf: BigInt.fromString("6694")
  },
  {
    id: BigInt.fromString("3462428"),
    humidity: BigDecimal.fromString("233.5"),
    season: 6107,
    startBpf: BigInt.fromString("127428")
  },
  {
    id: BigInt.fromString("3463060"),
    humidity: BigDecimal.fromString("238.5"),
    season: 6097,
    startBpf: BigInt.fromString("78060")
  },
  {
    id: BigInt.fromString("3465087"),
    humidity: BigDecimal.fromString("246"),
    season: 6082,
    startBpf: BigInt.fromString("5087")
  },
  {
    id: BigInt.fromString("3465205"),
    humidity: BigDecimal.fromString("238"),
    season: 6098,
    startBpf: BigInt.fromString("85205")
  },
  {
    id: BigInt.fromString("3466192"),
    humidity: BigDecimal.fromString("234"),
    season: 6106,
    startBpf: BigInt.fromString("126192")
  },
  {
    id: BigInt.fromString("3467650"),
    humidity: BigDecimal.fromString("237.5"),
    season: 6099,
    startBpf: BigInt.fromString("92650")
  },
  {
    id: BigInt.fromString("3468402"),
    humidity: BigDecimal.fromString("234.5"),
    season: 6105,
    startBpf: BigInt.fromString("123402")
  },
  {
    id: BigInt.fromString("3468691"),
    humidity: BigDecimal.fromString("246.5"),
    season: 6081,
    startBpf: BigInt.fromString("3691")
  },
  {
    id: BigInt.fromString("3470075"),
    humidity: BigDecimal.fromString("235"),
    season: 6104,
    startBpf: BigInt.fromString("120075")
  },
  {
    id: BigInt.fromString("3470220"),
    humidity: BigDecimal.fromString("237"),
    season: 6100,
    startBpf: BigInt.fromString("100220")
  },
  {
    id: BigInt.fromString("3471339"),
    humidity: BigDecimal.fromString("235.5"),
    season: 6103,
    startBpf: BigInt.fromString("116339")
  },
  {
    id: BigInt.fromString("3471974"),
    humidity: BigDecimal.fromString("236.5"),
    season: 6101,
    startBpf: BigInt.fromString("106974")
  },
  {
    id: BigInt.fromString("3472026"),
    humidity: BigDecimal.fromString("236"),
    season: 6102,
    startBpf: BigInt.fromString("112026")
  },
  {
    id: BigInt.fromString("3472520"),
    humidity: BigDecimal.fromString("247"),
    season: 6080,
    startBpf: BigInt.fromString("2520")
  },
  {
    id: BigInt.fromString("3476597"),
    humidity: BigDecimal.fromString("247.5"),
    season: 6079,
    startBpf: BigInt.fromString("1597")
  },
  {
    id: BigInt.fromString("3480951"),
    humidity: BigDecimal.fromString("248"),
    season: 6078,
    startBpf: BigInt.fromString("951")
  },
  {
    id: BigInt.fromString("3485472"),
    humidity: BigDecimal.fromString("248.5"),
    season: 6077,
    startBpf: BigInt.fromString("472")
  },
  {
    id: BigInt.fromString("3490157"),
    humidity: BigDecimal.fromString("249"),
    season: 6076,
    startBpf: BigInt.fromString("157")
  },
  {
    id: BigInt.fromString("3495000"),
    humidity: BigDecimal.fromString("249.5"),
    season: 6075,
    startBpf: BigInt.fromString("0")
  },
  {
    id: BigInt.fromString("3500000"),
    humidity: BigDecimal.fromString("250"),
    season: 6074,
    startBpf: BigInt.fromString("0")
  },
  {
    id: BigInt.fromString("6000000"),
    humidity: BigDecimal.fromString("500"),
    season: 6074,
    startBpf: BigInt.fromString("0")
  }
];

export const UNRIPE_TOKENS_INITIAL_VALUES: UnripeTokenInitialValues[] = [
  {
    tokenType: "urbean",
    totalChoppedAmount: BigInt.fromString("31430574600088"),
    totalChoppedBdv: BigInt.fromString("7681791296147"),
    totalChoppedBdvReceived: BigInt.fromString("1761005164064")
  },
  {
    tokenType: "urlp",
    totalChoppedAmount: BigInt.fromString("7261775129631"),
    totalChoppedBdv: BigInt.fromString("2534281787845"),
    totalChoppedBdvReceived: BigInt.fromString("509322147556")
  }
];

// These are hardcoded according to the output from Reseed.
export const UNMIGRATED_L1_BEANS = BigInt.fromString("2724979038345");
export const UNMIGRATED_SILO_BDV = BigInt.fromString("3348123368427");
export const UNMIGRATED_PODS = BigInt.fromString("25206618581873");
export const UNMIGRATED_FERTILIZER = BigInt.fromString("9036754");

// These events were not emitted on chain, need to be hardcoded and manually triggered
export const WHITELIST_INITIAL: WhitelistTokenEvent[] = [
  {
    token: Address.fromString("0xbea0005b8599265d41256905a9b3073d397812e4"),
    selector: Bytes.fromHexString("0x5a049a47"),
    stalkEarnedPerSeason: BigInt.fromString("5658594"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("0"),
    optimalPercentDepositedBdv: BigInt.fromString("0"),
    isWell: false
  },
  {
    token: Address.fromString("0x1bea054dddbca12889e07b3e076f511bf1d27543"),
    selector: Bytes.fromHexString("0xc8cda2a0"),
    stalkEarnedPerSeason: BigInt.fromString("1"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("0"),
    optimalPercentDepositedBdv: BigInt.fromString("0"),
    isWell: false
  },
  {
    token: Address.fromString("0x1bea059c3ea15f6c10be1c53d70c75fd1266d788"),
    selector: Bytes.fromHexString("0xb0c22bb1"),
    stalkEarnedPerSeason: BigInt.fromString("1"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("0"),
    optimalPercentDepositedBdv: BigInt.fromString("0"),
    isWell: false
  },
  {
    token: Address.fromString("0xbea00aa8130acad047e137ec68693c005f8736ce"),
    selector: Bytes.fromHexString("0xc84c7727"),
    stalkEarnedPerSeason: BigInt.fromString("1"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("1000000000000000000000"),
    optimalPercentDepositedBdv: BigInt.fromString("16000000"),
    isWell: true
  },
  {
    token: Address.fromString("0xbea00bbe8b5da39a3f57824a1a13ec2a8848d74f"),
    selector: Bytes.fromHexString("0xc84c7727"),
    stalkEarnedPerSeason: BigInt.fromString("5658594"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("0"),
    optimalPercentDepositedBdv: BigInt.fromString("26000000"),
    isWell: true
  },
  {
    token: Address.fromString("0xbea00cc9f93e9a8ac0dfdff2d64ba38eb9c2e48c"),
    selector: Bytes.fromHexString("0xc84c7727"),
    stalkEarnedPerSeason: BigInt.fromString("1"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("1000000000000000000000"),
    optimalPercentDepositedBdv: BigInt.fromString("14000000"),
    isWell: true
  },
  {
    token: Address.fromString("0xbea00dde4b34acdcb1a30442bd2b39ca8be1b09c"),
    selector: Bytes.fromHexString("0xc84c7727"),
    stalkEarnedPerSeason: BigInt.fromString("1"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("1000000000000000000000"),
    optimalPercentDepositedBdv: BigInt.fromString("20000000"),
    isWell: true
  },
  {
    token: Address.fromString("0xbea00ee04d8289aed04f92ea122a96dc76a91bd7"),
    selector: Bytes.fromHexString("0xc84c7727"),
    stalkEarnedPerSeason: BigInt.fromString("1"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("1000000000000000000000"),
    optimalPercentDepositedBdv: BigInt.fromString("12000000"),
    isWell: true
  },
  {
    token: Address.fromString("0xbea00ff437ca7e8354b174339643b4d1814bed33"),
    selector: Bytes.fromHexString("0xc84c7727"),
    stalkEarnedPerSeason: BigInt.fromString("1"),
    stalkIssuedPerBdv: BigInt.fromString("10000000000"),
    gaugePoints: BigInt.fromString("1000000000000000000000"),
    optimalPercentDepositedBdv: BigInt.fromString("12000000"),
    isWell: true
  }
];
