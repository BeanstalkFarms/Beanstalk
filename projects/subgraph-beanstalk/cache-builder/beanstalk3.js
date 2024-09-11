const { GraphQLClient, gql } = require("graphql-request");
const fs = require("fs");

const url = "https://graph.bean.money/beanstalk_eth";
const subgraph = new GraphQLClient(url);

const tokenMap = {
  "0x1bea0050e63e05fbb5d8ba2f10cf5800b6224449": "urbean",
  "0x1bea3ccd22f4ebd3d37d731ba31eeca95713716d": "urlp"
};

// NOTE: once latest subgraph is deployed, will need to update beanstalk/marketplace ids in this query.
(async () => {
  const l1Values = await subgraph.request(gql`
    {
      beanstalk(id: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5") {
        lastSeason
      }
      field(id: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5") {
        numberOfSowers
        numberOfSows
        sownBeans
        harvestedPods
      }
      podMarketplace(id: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5") {
        filledListedPods
        expiredListedPods
        cancelledListedPods
        filledOrderBeans
        filledOrderedPods
        cancelledOrderBeans
        podVolume
        beanVolume
      }
      unripeTokens {
        id
        totalChoppedAmount
        totalChoppedBdv
        totalChoppedBdvReceived
      }
    }
  `);

  const outFile = `${__dirname}/results/B3Migration_arb.ts`;
  await fs.promises.writeFile(
    outFile,
    `/* This is a generated file */

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

    export const SEASON_INITIAL = ${l1Values.beanstalk.lastSeason};

    export const FIELD_INITIAL_VALUES: FieldInitialValues = {
      numberOfSowers: ${l1Values.field.numberOfSowers},
      numberOfSows: ${l1Values.field.numberOfSows},
      sownBeans: BigInt.fromString('${l1Values.field.sownBeans}'),
      harvestedPods: BigInt.fromString('${l1Values.field.harvestedPods}')
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
    `
  );
  console.log(`Wrote beanstalk 3 initial values to ${outFile}`);
})();
