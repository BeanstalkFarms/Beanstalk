import { FarmWorkflow } from "./farm";
// import { workflowTestSuite } from "src/classes/Workflow.test";
import { setupConnection } from "src/utils/TestUtils/provider";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { ethers } from "ethers";

/// Setup
let sdk: BeanstalkSDK;
let account: string;
beforeAll(async () => {
  const { signer, provider, account: _account } = await setupConnection();
  sdk = new BeanstalkSDK({
    provider: provider,
    signer: signer,
    subgraphUrl: "https://graph.node.bean.money/subgraphs/name/beanstalk-testing"
  });
  account = _account;
});

describe("Workflow", () => {
  let farm: FarmWorkflow;
  beforeEach(() => {
    farm = sdk.farm.create("TestFarm");
  });

  describe("base Workflow class", () => {
    describe("setup", () => {
      it("initializes values to zero", () => {
        expect(farm.generators.length).toBe(0);
        expect(farm.length).toBe(0);
        expect(farm.value.toNumber()).toBe(0);
      });
      it("getters create new instances of private values", () => {
        // @ts-ignore testing private value
        expect(farm.generators).not.toBe(farm._generators);
        // @ts-ignore testing private value
        expect(farm.steps).not.toBe(farm._steps);
      });
    });

    describe("add StepGenerators", () => {
      it("handles a mixed array", async () => {
        // Setup
        const farm = sdk.farm.create();
        farm.add([
          sdk.farm.presets.bean2usdt(), // instanceof StepClass
          async () => "0xCALLDATA1", // instanceof StepFunction (returns EncodedData)
          async () => ({
            // instanceof StepFunction (returns Step<EncodedData>)
            name: "call3",
            amountOut: ethers.BigNumber.from(0),
            prepare: () => ({
              callData: "0xCALLDATA2"
            }),
            decode: () => undefined,
            decodeResult: () => undefined
          })
        ]);
        expect(farm.generators.length).toBe(3);
        expect(farm.length).toBe(3);
        // @ts-ignore testing private value
        expect(farm._steps.length).toBe(0); // haven't yet estimated, so no steps

        // Estimation
        await farm.estimate(ethers.BigNumber.from(1000_000000));
        expect(farm.length).toBe(3);
        // @ts-ignore testing private value
        expect(farm._steps.length).toBe(3); // haven't yet estimated, so no steps
        // @ts-ignore testing private value
        expect(farm._steps[1].prepare(ethers.BigNumber.from(0))).toMatchObject({ callData: "0xCALLDATA1" });
        // @ts-ignore testing private value
        expect(farm._steps[2].prepare(ethers.BigNumber.from(0))).toMatchObject({ callData: "0xCALLDATA2" });
      });
      it("recurses through nested arrays of StepGenerators", async () => {
        // Setup
        const farm = sdk.farm.create();
        farm.add([
          sdk.farm.presets.bean2usdt(),
          async () => "0xCALLDATA100000000000000000000000000000000000000",
          [
            async () => "0xCALLDATA200000000000000000000000000000000000000",
            async () => "0xCALLDATA300000000000000000000000000000000000000",
            [async () => "0xCALLDATA400000000000000000000000000000000000000"],
            async () => "0xCALLDATA200000000000000000000000000000000000000"
          ]
        ]);
        expect(farm.generators.length).toBe(6);
        expect(farm.length).toBe(6);

        // Estimation
        await farm.estimate(ethers.BigNumber.from(1000_000000));
        // @ts-ignore testing private value
        expect(farm._steps[1].prepare(ethers.BigNumber.from(0))).toMatchObject({
          callData: "0xCALLDATA100000000000000000000000000000000000000"
        });
        // @ts-ignore testing private value
        expect(farm._steps[2].prepare(ethers.BigNumber.from(0))).toMatchObject({
          callData: "0xCALLDATA200000000000000000000000000000000000000"
        });
        // @ts-ignore testing private value
        expect(farm._steps[5].prepare(ethers.BigNumber.from(0))).toMatchObject({
          callData: "0xCALLDATA200000000000000000000000000000000000000"
        });
      });
      it.todo("works when adding another Workflow");
      it("chains", () => {
        expect(() => farm.add(() => "0x1").add(() => "0x2")).not.toThrow();
      });
    });

    describe("copy Workflow", () => {
      let farm1: FarmWorkflow;
      beforeAll(async () => {
        farm1 = sdk.farm.create();
        farm1.add(() => "0xCALLDATA1");
        await farm1.estimate(ethers.BigNumber.from(100));
      });
      it("copies to a new instance with same steps", async () => {
        const farm2 = farm1.copy();
        await farm2.estimate(ethers.BigNumber.from(100));
        expect(farm1).not.toBe(farm2); // diff instances
        expect(farm1.length).toEqual(1);
        expect(farm2.length).toEqual(1);
        // @ts-ignore
        expect(farm1._steps[0].prepare()).toEqual(farm2._steps[0].prepare());
      });
      it("doesn't copy results", async () => {
        const farm3 = farm1.copy();
        // @ts-ignore
        expect(farm3._steps.length).toBe(0);
      });
    });

    describe("clear", () => {
      it.todo("clears results");
    });
    describe("build step", () => {
      it.todo("builds a Step from StepFunction => EncodedData");
      it.todo("builds a Step from StepFunction => Step<EncodedData>");
      it.todo("builds a Step from StepClass");
      it.todo("builds a Step from Workflow");
    });
    describe("slippage", () => {
      it.todo("converts decimal-based slippage into BigNumber");
    });
    describe("encode", () => {
      it.todo("encodes Steps with slippage");
      it.todo("encodes itself into a single hex string");
    });
    describe("decode", () => {
      it.todo("decodes");
    });
    describe("options", () => {
      it.todo("onlyExecute");
      it.todo("skips");
      describe("tags", () => {
        beforeEach(() => {
          farm = sdk.farm.create("TestFarm");
          farm.clearSteps();
        });
        it("adds basic tags", async () => {
          farm.add(() => "0xTEST1", { tag: "test1" });
          farm.add(() => "0xTEST2");
          farm.add(() => "0xTEST3", { tag: "test2" });

          await farm.estimate(ethers.BigNumber.from(0));

          expect(farm.findTag("test1")).toBe(0);
          expect(farm.findTag("test2")).toBe(2);
        });
        it("tags nested workflows", async () => {
          const pipe = sdk.farm.createAdvancedPipe();
          farm.add(() => "0xTEST1", { tag: "test1" });
          farm.add(
            pipe.add(() => ({ target: "", callData: "0xPIPE", clipboard: "" }), { tag: "insidePipe" }),
            { tag: "pipe" }
          );
          farm.add(() => "0xBUFFER");
          farm.add(() => "0xTEST3", { tag: "test2" });

          await farm.estimate(ethers.BigNumber.from(0));

          expect(farm.findTag("test1")).toEqual(0);
          expect(farm.findTag("pipe")).toEqual(1);
          expect(() => farm.findTag("insidePipe")).toThrow("Tag does not exist: insidePipe");
          expect(pipe.findTag("insidePipe")).toEqual(0);
          expect(farm.findTag("test2")).toEqual(3);
        });
        it("throws if steps haven't yet been built", () => {
          farm.add(() => "0xTEST1", { tag: "test1" });
          expect(() => farm.findTag("test1")).toThrow("Tag does not exist: test1");
        });
        it("throws if step does not exist", async () => {
          farm.add(() => "0xTEST1", { tag: "test1" });
          await farm.estimate(ethers.BigNumber.from(0));

          expect(() => farm.findTag("foo")).toThrow("Tag does not exist: foo");
        });
        it("throws if tag already exists", async () => {
          farm.add(() => "0xTEST1", { tag: "test1" });
          farm.add(() => "0xTEST2", { tag: "test1" }); // same tag

          await expect(farm.estimate(ethers.BigNumber.from(0))).rejects.toThrow();
        });
        it("doesn't tag steps that are skipped", async () => {
          farm.add(() => "0xTEST1", { tag: "test1", skip: true });
          farm.add(() => "0xTEST2");
          farm.add(() => "0xTEST3", { tag: "test2" });

          await farm.estimate(ethers.BigNumber.from(0));

          expect(() => farm.findTag("test1")).toThrow();
          // since the first item is always skipped, this moves up one
          expect(farm.findTag("test2")).toBe(1);
        });
        it.todo("allows manual tagging");
      });
    });
  });
});
