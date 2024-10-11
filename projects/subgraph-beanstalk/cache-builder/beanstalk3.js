const { GraphQLClient, gql } = require("graphql-request");
const fs = require("fs");

const url = "https://graph.bean.money/beanstalk-testing_eth";
const subgraph = new GraphQLClient(url);

const tokenMap = {
  "0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449": "urbean",
  "0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d": "urlp"
};

(async () => {
  // for testing purposes. set to empty string to ignore
  const block = "block: { number: 20921737 }";
  const l1Values = await subgraph.request(gql`
    {
      beanstalk(id: "beanstalk" ${block}) {
        lastSeason
      }
      silo(id: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5" ${block}) {
        beanToMaxLpGpPerBdvRatio
      }
      field(id: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5" ${block}) {
        numberOfSowers
        numberOfSows
        sownBeans
        harvestedPods
        podIndex
        harvestableIndex
        temperature
      }
      podMarketplace(id: "0" ${block}) {
        filledListedPods
        expiredListedPods
        cancelledListedPods
        filledOrderBeans
        filledOrderedPods
        cancelledOrderBeans
        podVolume
        beanVolume
      }
      fertilizerTokens(first: 1000 ${block}) {
        id
        humidity
        season
        startBpf
      }
      unripeTokens${block ? `(${block})` : ""} {
        id
        totalChoppedAmount
        totalChoppedBdv
        totalChoppedBdvReceived
      }
    }
  `);

  const fertTokenInfo = l1Values.fertilizerTokens.map((fertToken) => {
    return `{
      id: BigInt.fromString('${fertToken.id}'),
      humidity: BigDecimal.fromString('${fertToken.humidity}'),
      season: ${fertToken.season},
      startBpf: BigInt.fromString('${fertToken.startBpf}')
    }`;
  });

  const outFile = `${__dirname}/results/B3Migration_arb.ts`;
  await fs.promises.writeFile(
    outFile,
    `/* This is a generated file */

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

    export const SEASON_INITIAL = ${l1Values.beanstalk.lastSeason};

    export const SILO_INITIAL_VALUES: SiloInitialValues = {
      beanToMaxLpGpPerBdvRatio: BigInt.fromString('${l1Values.silo.beanToMaxLpGpPerBdvRatio}')
    };

    export const FIELD_INITIAL_VALUES: FieldInitialValues = {
      numberOfSowers: ${l1Values.field.numberOfSowers},
      numberOfSows: ${l1Values.field.numberOfSows},
      sownBeans: BigInt.fromString('${l1Values.field.sownBeans}'),
      harvestedPods: BigInt.fromString('${l1Values.field.harvestedPods}'),
      podIndex: BigInt.fromString('${l1Values.field.podIndex}'),
      harvestableIndex: BigInt.fromString('${l1Values.field.harvestableIndex}'),
      temperature: ${l1Values.field.temperature}
    };

    export const POD_MARKETPLACE_INITIAL_VALUES: PodMarketplaceInitialValues = {
      filledListedPods: BigInt.fromString('${l1Values.podMarketplace.filledListedPods}'),
      expiredListedPods: BigInt.fromString('${l1Values.podMarketplace.expiredListedPods}'),
      cancelledListedPods: BigInt.fromString('${l1Values.podMarketplace.cancelledListedPods}'),
      filledOrderBeans: BigInt.fromString('${l1Values.podMarketplace.filledOrderBeans}'),
      filledOrderedPods: BigInt.fromString('${l1Values.podMarketplace.filledOrderedPods}'),
      cancelledOrderBeans: BigInt.fromString('${l1Values.podMarketplace.cancelledOrderBeans}'),
      podVolume: BigInt.fromString('${l1Values.podMarketplace.podVolume}'),
      beanVolume: BigInt.fromString('${l1Values.podMarketplace.beanVolume}')
    };

    export const FERT_TOKEN_INFO_CACHED: FertilizerTokenInfo[] = [${fertTokenInfo.join(",")}];

    export const UNRIPE_TOKENS_INITIAL_VALUES: UnripeTokenInitialValues[] = [
      {
        tokenType: '${tokenMap[l1Values.unripeTokens[0].id]}',
        totalChoppedAmount: BigInt.fromString('${l1Values.unripeTokens[0].totalChoppedAmount}'),
        totalChoppedBdv: BigInt.fromString('${l1Values.unripeTokens[0].totalChoppedBdv}'),
        totalChoppedBdvReceived: BigInt.fromString('${l1Values.unripeTokens[0].totalChoppedBdvReceived}')
      },
      {
        tokenType: '${tokenMap[l1Values.unripeTokens[1].id]}',
        totalChoppedAmount: BigInt.fromString('${l1Values.unripeTokens[1].totalChoppedAmount}'),
        totalChoppedBdv: BigInt.fromString('${l1Values.unripeTokens[1].totalChoppedBdv}'),
        totalChoppedBdvReceived: BigInt.fromString('${l1Values.unripeTokens[1].totalChoppedBdvReceived}')
      }
    ];

    // These are hardcoded according to the output from Reseed.
    export const UNMIGRATED_L1_BEANS = BigInt.fromString('2724979038345');
    export const UNMIGRATED_SILO_BDV = BigInt.fromString('3348123368427');
    export const UNMIGRATED_PODS = BigInt.fromString('25206618581873');
    export const UNMIGRATED_FERTILIZER = BigInt.fromString('9036754');

    // These events were not emitted on chain, need to be hardcoded and manually triggered
    export const WHITELIST_INITIAL: WhitelistTokenEvent[] = [
      {
        token: Address.fromString('0xbea0005b8599265d41256905a9b3073d397812e4'),
        selector: Bytes.fromHexString('0x5a049a47'),
        stalkEarnedPerSeason: BigInt.fromString('5658594'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('0'),
        optimalPercentDepositedBdv: BigInt.fromString('0'),
        isWell: false
      },
      {
        token: Address.fromString('0x1bea054dddbca12889e07b3e076f511bf1d27543'),
        selector: Bytes.fromHexString('0xc8cda2a0'),
        stalkEarnedPerSeason: BigInt.fromString('1'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('0'),
        optimalPercentDepositedBdv: BigInt.fromString('0'),
        isWell: false
      },
      {
        token: Address.fromString('0x1bea059c3ea15f6c10be1c53d70c75fd1266d788'),
        selector: Bytes.fromHexString('0xb0c22bb1'),
        stalkEarnedPerSeason: BigInt.fromString('1'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('0'),
        optimalPercentDepositedBdv: BigInt.fromString('0'),
        isWell: false
      },
      {
        token: Address.fromString('0xbea00aa8130acad047e137ec68693c005f8736ce'),
        selector: Bytes.fromHexString('0xc84c7727'),
        stalkEarnedPerSeason: BigInt.fromString('1'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('1000000000000000000000'),
        optimalPercentDepositedBdv: BigInt.fromString('16000000'),
        isWell: true
      },
      {
        token: Address.fromString('0xbea00bbe8b5da39a3f57824a1a13ec2a8848d74f'),
        selector: Bytes.fromHexString('0xc84c7727'),
        stalkEarnedPerSeason: BigInt.fromString('5658594'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('0'),
        optimalPercentDepositedBdv: BigInt.fromString('26000000'),
        isWell: true
      },
      {
        token: Address.fromString('0xbea00cc9f93e9a8ac0dfdff2d64ba38eb9c2e48c'),
        selector: Bytes.fromHexString('0xc84c7727'),
        stalkEarnedPerSeason: BigInt.fromString('1'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('1000000000000000000000'),
        optimalPercentDepositedBdv: BigInt.fromString('14000000'),
        isWell: true
      },
      {
        token: Address.fromString('0xbea00dde4b34acdcb1a30442bd2b39ca8be1b09c'),
        selector: Bytes.fromHexString('0xc84c7727'),
        stalkEarnedPerSeason: BigInt.fromString('1'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('1000000000000000000000'),
        optimalPercentDepositedBdv: BigInt.fromString('20000000'),
        isWell: true
      },
      {
        token: Address.fromString('0xbea00ee04d8289aed04f92ea122a96dc76a91bd7'),
        selector: Bytes.fromHexString('0xc84c7727'),
        stalkEarnedPerSeason: BigInt.fromString('1'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('1000000000000000000000'),
        optimalPercentDepositedBdv: BigInt.fromString('12000000'),
        isWell: true
      },
      {
        token: Address.fromString('0xbea00ff437ca7e8354b174339643b4d1814bed33'),
        selector: Bytes.fromHexString('0xc84c7727'),
        stalkEarnedPerSeason: BigInt.fromString('1'),
        stalkIssuedPerBdv: BigInt.fromString('10000000000'),
        gaugePoints: BigInt.fromString('1000000000000000000000'),
        optimalPercentDepositedBdv: BigInt.fromString('12000000'),
        isWell: true
      }
    ];
    `
  );
  console.log(`Wrote beanstalk 3 initial values to ${outFile}`);
})();
