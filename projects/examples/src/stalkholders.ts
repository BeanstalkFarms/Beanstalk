import { BeanstalkSDK } from "@beanstalk/sdk";
import { BigNumber } from "ethers";
import { provider } from "./setup";
import fs from 'fs';

const query = `query Stalkholders($skip: Int!) {
  silos(
    where: {
      depositedBDV_gt: 0,
      id_not: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5" # exclude beanstalk
    },
    orderBy: stalk,
    orderDirection: desc,
    first: 1000,
    skip: $skip
	) {
    farmer {
      id
    }
    stalk # base stalk
    seeds # base seeds
    hourlySnapshots(first: 1, orderBy: season, orderDirection: desc) {
      season
    }
  }
}`;

main()
  .catch((e) => {
    console.log(e);
  })
  .finally(() => process.exit());

async function main() {
  const sdk = new BeanstalkSDK({ provider, DEBUG: true });
  const season = await sdk.sun.getSeason();

  // paginate
  let skip = 0;
  const results : any[] = [];
  while (true) {
    const result = await sdk.graphql.request(query, { skip });
    results.push(...result.silos);
    if (result.silos.length < 1000) {
      console.log("done")
      break;
    }
    skip += 1000;
  }

  console.log(`Found ${results.length} stalkholders`);

  const grownStalk = results.map((r) => {
    return {
      ...r,
      grownStalk: (
        BigNumber.from(r.seeds).mul(
          BigNumber.from(
            season - parseInt(r.hourlySnapshots[0].season)
          )
        )
      )
    }
  }).sort((a, b) => {
    return a.grownStalk.sub(b.grownStalk).gt(0) ? -1 : 1;
  });

  // top 5
  grownStalk.slice(0, 5).forEach((r, i) => {
    console.log(`${i} ${r.farmer.id} ${r.stalk} ${r.grownStalk}`)
  });

  // total stalk
  const total = grownStalk.reduce((prev, curr) => {
    return prev.add(curr.grownStalk);
  }, BigNumber.from(0));

  // save
  fs.writeFileSync('./out/stalkholders.json', JSON.stringify(grownStalk, null, 2));

  console.log("Total: ", total.toString());
}