import { BigNumber as EBN } from "ethers";
import {
  AddDepositEvent,
  HarvestEvent,
  PlotTransferEvent,
  RemoveDepositEvent,
  SowEvent
} from "src/constants/generated/protocol/abi/Beanstalk";
import { EventProcessor } from "./processor";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { getProvider } from "../../utils/TestUtils/provider";

// ------------------------------------------

const sdk = new BeanstalkSDK({
  provider: getProvider()
});
const Bean = sdk.tokens.BEAN;
const BeanCrv3 = sdk.tokens.BEAN_CRV3_LP;

const account = "0xFARMER";

// ------------------------------------------

/**
 * When parsing event data, ethers returns an array
 * that also has named properties. This recreates
 * the same array, assuming that the keys in the
 * provided object are ordered.
 *
 * @note downstream SDK functions used the named keys
 * and not the indices; this is more for consistency.
 */
const propArray = (o: { [key: string]: any }) =>
  Object.keys(o).reduce(
    (prev, key) => {
      prev[prev.length] = o[key];
      prev[key] = o[key];
      return prev;
    },
    [] as (keyof typeof o)[] & typeof o
  );

const mockProcessor = () => new EventProcessor(sdk, account);

// ------------------------------------------

describe("utilities", () => {
  it("builds an array with numerical and string keys", () => {
    const a = propArray({ index: 0, pods: 10 });
    expect(a[0]).toEqual(0);
    expect(a.index).toEqual(0);
    expect(a[1]).toEqual(10);
    expect(a.pods).toEqual(10);
  });
});

// ------------------------------------------

describe("the Field", () => {
  // 1.
  it("adds a single Plot", () => {
    const p = mockProcessor();

    p.ingest({
      event: "Sow",
      args: propArray({
        index: EBN.from(10),
        pods: EBN.from(42)
      })
    } as SowEvent);

    expect(Object.keys(p.plots).length === 1);
    expect(p.plots.get("10")).toStrictEqual(EBN.from(42));
  });

  // 2.
  it("adds a single Plot and Harvests", () => {
    const p = mockProcessor();
    p.ingest({
      event: "Sow",
      args: propArray({
        index: EBN.from(10),
        pods: EBN.from(42)
      })
    } as SowEvent);
    p.ingest({
      event: "Harvest",
      args: propArray({
        beans: EBN.from(5),
        plots: [EBN.from(10)]
      })
    } as HarvestEvent);

    expect(Object.keys(p.plots).length === 1);
    expect(p.plots.get("10")).toBeUndefined();
    expect(p.plots.get("15")).toStrictEqual(EBN.from(42 - 5));

    p.ingest({
      event: "Harvest",
      args: propArray({
        beans: EBN.from(37),
        plots: [EBN.from(15)]
      })
    } as HarvestEvent);

    expect(Object.keys(p.plots).length === 0);
    expect(p.plots.get("10")).toBeUndefined();
    expect(p.plots.get("15")).toBeUndefined();
  });

  // 3.
  it("sends a single Plot, full", () => {
    const p = mockProcessor();
    p.ingest({
      event: "Sow",
      args: propArray({
        index: EBN.from(10),
        pods: EBN.from(42)
      })
    } as SowEvent);
    p.ingest({
      event: "PlotTransfer",
      args: propArray({
        from: "0xFARMER",
        to: "0xPUBLIUS",
        id: EBN.from(10),
        pods: EBN.from(42)
      })
    } as PlotTransferEvent);

    expect(Object.keys(p.plots).length).toBe(0);
  });

  // 4.
  it("sends a single Plot, partial (indexed from the front)", () => {
    const p = mockProcessor();

    p.ingest({
      event: "Sow",
      args: propArray({
        index: EBN.from(10),
        pods: EBN.from(42)
      })
    } as SowEvent);

    p.ingest({
      event: "PlotTransfer",
      args: propArray({
        from: "0xFARMER",
        to: "0xPUBLIUS",
        id: EBN.from(10), // front of the Plot
        pods: EBN.from(22) // don't send the whole Plot
      })
    } as PlotTransferEvent);

    console.log(p.plots);

    // Since the Plot is sent from the front, index starts at 10 + 22 = 32.
    expect(p.plots.size).toBe(1);
    expect(p.plots.get((10 + 22).toString())).toStrictEqual(EBN.from(42 - 22));
  });

  // 5.
  it("works with large-index plots", () => {
    const p = mockProcessor();
    p.ingest({
      event: "Sow",
      args: propArray({
        index: EBN.from("737663715081254"),
        pods: EBN.from("57980000")
      })
    } as SowEvent);

    expect(p.plots.get("737663715081254")).toBeDefined();
    expect(p.plots.get("737663715081254")?.eq(57980000)).toBe(true);
  });
});

// --------------------------------

describe("the Silo", () => {
  it("throws when processing unknown tokens", () => {
    const p = mockProcessor();
    expect(() =>
      p.ingest({
        event: "AddDeposit",
        args: propArray({
          token: "0xUNKNOWN"
        })
      } as AddDepositEvent)
    ).toThrow();
  });

  it("runs a simple deposit sequence (three deposits, two tokens, two stems)", () => {
    const p = mockProcessor();

    // Deposit: 1000 Bean, Season 6074
    const amount1 = EBN.from(1000 * 10 ** Bean.decimals);
    const bdv1 = EBN.from(1000 * 10 ** Bean.decimals);
    p.ingest({
      event: "AddDeposit",
      args: propArray({
        account,
        token: Bean.address,
        stem: EBN.from(6074),
        amount: amount1, // Deposited 1,000 Bean
        bdv: bdv1
      })
    } as AddDepositEvent);
    const t = p.deposits.get(Bean);
    expect(p.deposits.get(Bean)?.["6074000000"]).toStrictEqual({
      amount: amount1,
      bdv: bdv1
    });

    // Deposit: 500 Bean, Season 6074
    const amount2 = EBN.from(500 * 10 ** Bean.decimals);
    const bdv2 = EBN.from(500 * 10 ** Bean.decimals);
    p.ingest({
      event: "AddDeposit",
      args: propArray({
        account,
        token: Bean.address,
        stem: EBN.from(6074),
        amount: amount2,
        bdv: bdv2
      })
    } as AddDepositEvent);

    expect(p.deposits.get(Bean)?.["6074000000"]).toStrictEqual({
      amount: amount1.add(amount2),
      bdv: bdv1.add(bdv2)
    });

    // Deposit: 1000 Bean:CRV3 LP, Season 6100
    const amount3 = EBN.from(1000).mul(EBN.from(10).pow(BeanCrv3.decimals));
    const bdv3 = EBN.from(900).mul(EBN.from(10).pow(Bean.decimals));
    p.ingest({
      event: "AddDeposit",
      args: propArray({
        account,
        token: BeanCrv3.address,
        stem: EBN.from(6100),
        amount: amount3, // Deposited 1,000 Bean:CRV3
        bdv: bdv3
      })
    } as AddDepositEvent);

    expect(p.deposits.get(BeanCrv3)?.["6100000000"]).toStrictEqual({
      amount: amount3,
      bdv: bdv3
    });
  });

  it("removes a single deposit, partial -> full", () => {
    const p = mockProcessor();

    // Add Deposit: 1000 Bean, Season 6074
    const amount1 = EBN.from(1000 * 10 ** Bean.decimals);
    const bdv1 = EBN.from(1000 * 10 ** Bean.decimals);
    p.ingest({
      event: "AddDeposit",
      args: propArray({
        account,
        token: Bean.address,
        stem: EBN.from(6074),
        amount: amount1,
        bdv: bdv1
      })
    } as AddDepositEvent);

    // Remove Deposit: 600 Bean, Season 6074
    const amount2 = EBN.from(600 * 10 ** Bean.decimals);
    const bdv2 = EBN.from(600 * 10 ** Bean.decimals);
    p.ingest({
      event: "RemoveDeposit",
      args: propArray({
        account,
        token: Bean.address,
        stem: EBN.from(6074),
        amount: amount2,
        bdv: bdv2
      })
    } as RemoveDepositEvent);

    expect(p.deposits.get(Bean)?.["6074000000"]).toStrictEqual({
      amount: amount1.sub(amount2),
      bdv: bdv1.sub(bdv2)
    });

    // Remove Deposit: 400 Bean, Season 6074
    const amount3 = EBN.from(400 * 10 ** Bean.decimals);
    const bdv3 = EBN.from(400 * 10 ** Bean.decimals);
    p.ingest({
      event: "RemoveDeposit",
      args: propArray({
        account,
        token: Bean.address,
        stem: EBN.from(6074),
        amount: amount3,
        bdv: bdv3
      })
    } as RemoveDepositEvent);

    expect(p.deposits.get(Bean)?.["6074000000"]).toBeUndefined();
  });
});

describe("parsePlots", () => {
  let p: EventProcessor;

  beforeEach(() => {
    p = mockProcessor();
  });

  it("should parse plots correctly when all are fully harvestable", () => {
    const plots = [
      ["1", EBN.from("5")],
      ["2", EBN.from("10")]
    ] as const;

    p.plots = new Map(plots);
    const harvestableIndex = EBN.from("20");

    const result = p.parsePlots({ harvestableIndex });
    expect(result.pods.toString()).toBe("0");
    expect(result.harvestablePods.toString()).toBe("15");
    expect(Array.from(result.plots.entries())).toEqual([]);
    expect(Array.from(result.harvestablePlots.entries())).toEqual(plots);
  });

  it("should parse plots correctly when all are unharvestable", () => {
    const plots = [
      ["30", EBN.from("5")],
      ["40", EBN.from("10")]
    ] as const;

    p.plots = new Map(plots);
    const harvestableIndex = EBN.from("20");

    const result = p.parsePlots({ harvestableIndex });
    expect(result.pods.toString()).toBe("15");
    expect(result.harvestablePods.toString()).toBe("0");
    expect(Array.from(result.harvestablePlots.entries())).toEqual([]);
    expect(Array.from(result.plots.entries())).toEqual(plots);
  });

  it("should parse plots correctly when plots are partially harvestable", () => {
    p.plots = new Map([
      ["10", EBN.from("15")], // 10 -> 25 = 15
      ["30", EBN.from("5")] // 30 -> 35 = 5
    ]);
    const harvestableIndex = EBN.from("20");

    const result = p.parsePlots({ harvestableIndex });
    expect(result.pods.toString()).toBe("10");
    expect(result.harvestablePods.toString()).toBe("10");
    expect(Array.from(result.harvestablePlots.entries())).toEqual([["10", EBN.from("10")]]);
    expect(Array.from(result.plots.entries())).toEqual([
      ["20", EBN.from("5")],
      ["30", EBN.from("5")]
    ]);
  });
});
