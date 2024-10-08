const { GraphQLClient, gql } = require("graphql-request");
const fs = require("fs");

const url = "https://graph.bean.money/bean_eth";
const subgraph = new GraphQLClient(url);

(async () => {
  const block = "block: { number: 20921737 }";
  const l1Values = await subgraph.request(gql`
    {
      bean(id: "0xbea0000029ad1c77d3d5d23ba2d8893db9d1efab" ${block}) {
        volume
        volumeUSD
        crosses
        lastCross
        lastSeason
      }
    }
  `);

  const outFile = `${__dirname}/results/B3Migration_arb.ts`;
  await fs.promises.writeFile(
    outFile,
    `/* This is a generated file */

    import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";

    class BeanInitialValues {
      volume: BigInt;
      volumeUsd: BigDecimal;
      crosses: i32;
      lastCross: BigInt;
      lastSeason: i32;
    }

    export const BEAN_INITIAL_VALUES: BeanInitialValues = {
      volume: BigInt.fromString('${l1Values.bean.volume}'),
      volumeUsd: BigDecimal.fromString('${l1Values.bean.volumeUSD}'),
      crosses: ${l1Values.bean.crosses},
      lastCross: BigInt.fromString('${l1Values.bean.lastCross}'),
      lastSeason: ${l1Values.bean.lastSeason}
    };
    `
  );
  console.log(`Wrote beanstalk 3 initial values to ${outFile}`);
})();
