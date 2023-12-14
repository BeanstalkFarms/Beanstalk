const { ethers } = require("hardhat");

const { EXTERNAL, INTERNAL } = require("./balances.js");
const { BEAN, ZERO_ADDRESS } = require("./constants.js");
const { to6, to18 } = require("./helpers.js");

// const ARRAY_LENGTH = 5;
const SLOT_SIZE = 32;
const SELECTOR_SIZE = 4;
const ARGS_START_INDEX = SELECTOR_SIZE + SLOT_SIZE; // shape of AdvancedFarmCall.callData: 32 bytes (length of callData), 4 bytes (selector), X bytes (args)
const ADDR_SLOT_OFFSET = 12; // 32 - 20
const PUBLISHER_COPY_INDEX = ethers.BigNumber.from(2).pow(80).sub(1); // MaxUint80;
const OPERATOR_COPY_INDEX = PUBLISHER_COPY_INDEX.sub(1);

const RATIO_FACTOR = ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18));

let drafterAddr;

// Init test chain state for Drafter to function.
const initDrafter = async () =>
  (drafterAddr = await (
    await (await (await ethers.getContractFactory("Drafter")).deploy()).deployed()
  ).address);

// Interfaces needed to encode calldata.
const farmFacetInterface = async () => (await ethers.getContractFactory("FarmFacet")).interface;
const junctionFacetInterface = async () =>
  (await ethers.getContractFactory("JunctionFacet")).interface;
const tokenFacetInterface = async () => (await ethers.getContractFactory("TokenFacet")).interface;
const siloFacetInterface = async () => (await ethers.getContractFactory("SiloFacet")).interface;

// Need to actually execute the logic in Drafter pure functions.
// Are these making actual rpc calls?
const drafter = async () => await ethers.getContractAt("Drafter", drafterAddr);

const signRequisition = async (requisition, signer) => {
  // Ethers treats hash as an unexpectedly encoded string, whereas solidity signs hash as bytes. So arrayify here.
  requisition.signature = await signer.signMessage(
    ethers.utils.arrayify(requisition.blueprintHash)
  );
};

const getNormalBlueprintData = (data) => {
  const blueprintData = ethers.utils.defaultAbiCoder.encode(["bytes[]"], [data]);
  return ethers.utils.hexlify(new Uint8Array([0, ...ethers.utils.arrayify(blueprintData)]));
};

const getAdvancedBlueprintData = (data) => {
  const blueprintData = ethers.utils.defaultAbiCoder.encode(["(bytes,bytes)[]"], [data]);
  return ethers.utils.hexlify(new Uint8Array([1, ...ethers.utils.arrayify(blueprintData)]));
};

const generateCalldataCopyParams = (info) => {
  return info.map(([copyIndex, pasteIndex, length]) => {
    let copyParams = "0x0000";

    const _copyIndex =
      copyIndex === -1 ? ethers.constants.MaxUint256 : ethers.BigNumber.from(copyIndex);
    copyParams += ethers.utils.hexZeroPad(_copyIndex.toHexString(), 32).substr(-20);
    copyParams += ethers.utils
      .hexZeroPad(ethers.BigNumber.from(pasteIndex).toHexString(), 20)
      .substr(-20);
    copyParams += ethers.utils
      .hexZeroPad(ethers.BigNumber.from(length).toHexString(), 20)
      .substr(-20);

    return copyParams;
  });
};

const encodeBlueprintData = async (advancedFarmCalls) => {
  return ethers.utils.solidityPack(
    ["bytes1", "bytes"],
    [
      0, // data type
      (await farmFacetInterface()).encodeFunctionData("advancedFarm", [advancedFarmCalls])
      // await farmFacetInterface().then((interface) => { interface.encodeFunctionData("advancedFarm", [advancedFarmCalls]) })
    ]
  );
};

const draftInternalBalanceOfBeans = async (callNumber) => {
  let tmpAdvancedFarmCalls = [];
  let tmpOperatorPasteInstrs = [];
  tmpAdvancedFarmCalls.push({
    callData: (await tokenFacetInterface()).encodeFunctionData("getInternalBalance", [
      ZERO_ADDRESS,
      BEAN
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  tmpOperatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(
          PUBLISHER_COPY_INDEX,
          callNumber,
          ARGS_START_INDEX // + ADDR_SLOT_OFFSET
        )
    )
  );
  return [tmpAdvancedFarmCalls, tmpOperatorPasteInstrs];
};

const draftBalanceOfStalk = async (callNumber) => {
  let tmpAdvancedFarmCalls = [];
  let tmpOperatorPasteInstrs = [];
  tmpAdvancedFarmCalls.push({
    callData: (await siloFacetInterface()).encodeFunctionData("balanceOfStalk", [ZERO_ADDRESS]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  tmpOperatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(
          PUBLISHER_COPY_INDEX,
          callNumber,
          ARGS_START_INDEX // + ADDR_SLOT_OFFSET
        )
    )
  );
  return [tmpAdvancedFarmCalls, tmpOperatorPasteInstrs];
};

const draftDiffOfReturns = async (returnDataItemIndex0, returnDataItemIndex1) => {
  let tmpAdvancedFarmCalls = [];
  let tmpOperatorPasteInstrs = [];
  tmpAdvancedFarmCalls.push({
    callData: (await junctionFacetInterface()).encodeFunctionData("sub", [0, 0]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(
            returnDataItemIndex0,
            SLOT_SIZE,
            ARGS_START_INDEX
          ),
          await drafter.encodeLibReturnPasteParam(
            returnDataItemIndex1,
            SLOT_SIZE,
            ARGS_START_INDEX + SLOT_SIZE
          )
        ])
    )
  });
  return [tmpAdvancedFarmCalls, tmpOperatorPasteInstrs];
};

/**
 * Blueprint to deposit all Beans from internal balance of publisher.
 * Requires minimum balance of 1000 Bean.
 * Operator receives a static pre-defined tip.
 * @param tip - amount of beans to tip to operator external balance
 */
const draftDepositInternalBeanBalance = async (tip) => {
  // Interfaces needed to encode calldata.
  const junctionFacetInterface = (await ethers.getContractFactory("JunctionFacet")).interface;
  const farmFacetInterface = (await ethers.getContractFactory("FarmFacet")).interface;
  const tokenFacetInterface = (await ethers.getContractFactory("TokenFacet")).interface;
  const siloFacetInterface = (await ethers.getContractFactory("SiloFacet")).interface;

  // Need to actually execute the logic in Drafter pure functions.
  // Are these making actual rpc calls?
  let contractFactory = await (
    await (await ethers.getContractFactory("Drafter")).deploy()
  ).deployed();
  const drafter = await ethers.getContractAt("Drafter", contractFactory.address);

  // temp arrays for handling returns.
  let tmpAdvancedFarmCalls = [];
  let tmpOperatorPasteInstrs = [];

  // AdvancedFarmCall[]
  let advancedFarmCalls = [];

  // bytes32[]
  let operatorPasteInstrs = [];

  // call[0] - Get publisher internal balance.
  [tmpAdvancedFarmCalls, tmpOperatorPasteInstrs] = await draftInternalBalanceOfBeans(0);
  advancedFarmCalls.push(...tmpAdvancedFarmCalls);
  operatorPasteInstrs.push(...tmpOperatorPasteInstrs);

  // call[1] - Check if at least 1000 Beans in publisher internal balance.
  advancedFarmCalls.push({
    callData: junctionFacetInterface.encodeFunctionData("gte", [0, to6("1000")]),
    clipboard: await drafter.encodeClipboard(0, [
      await drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, ARGS_START_INDEX)
    ])
  });

  // call[2] - Require internal balance check true.
  advancedFarmCalls.push({
    callData: junctionFacetInterface.encodeFunctionData("check", [false]),
    clipboard: await drafter.encodeClipboard(1, [
      await drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, ARGS_START_INDEX)
    ])
  });

  // call[3] - Get difference between publisher internal balance and tip.
  advancedFarmCalls.push({
    callData: junctionFacetInterface.encodeFunctionData("sub", [0, tip]),
    clipboard: await drafter.encodeClipboard(0, [
      await drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, ARGS_START_INDEX)
    ])
  });

  // call[4] - Deposit publisher internal balance, less tip.
  advancedFarmCalls.push({
    callData: siloFacetInterface.encodeFunctionData("deposit", [BEAN, 0, INTERNAL]),
    clipboard: await drafter.encodeClipboard(0, [
      await drafter.encodeLibReturnPasteParam(3, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE)
    ])
  });

  // call[5] - Transfer tip to operator external balance.
  advancedFarmCalls.push({
    callData: tokenFacetInterface.encodeFunctionData("transferToken", [
      BEAN,
      ZERO_ADDRESS,
      tip,
      INTERNAL,
      EXTERNAL
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  operatorPasteInstrs.push(
    await drafter.encodeOperatorPasteInstr(
      OPERATOR_COPY_INDEX,
      5,
      ARGS_START_INDEX + SLOT_SIZE // + ADDR_SLOT_OFFSET
    )
  );

  console.log(advancedFarmCalls);
  console.log(operatorPasteInstrs);

  return [advancedFarmCalls, operatorPasteInstrs];
};

/**
 * Blueprint allowing the Operator to enroot one deposit on behalf of the Publisher.
 * Operator is rewarded Beans as a ratio of stalk increase (from both mowing and enroot).
 */
const draftMow = async (rewardRatio) => {
  // AdvancedFarmCall[]
  let advancedFarmCalls = [];

  // bytes32[]
  let operatorPasteInstrs = [];

  // temp arrays for handling returns.
  let tmpAdvancedFarmCalls = [];
  let tmpOperatorPasteInstrs = [];

  // call[0] - Get initial publisher stalk balance.
  [tmpAdvancedFarmCalls, tmpOperatorPasteInstrs] = await draftBalanceOfStalk(0);
  advancedFarmCalls.push(...tmpAdvancedFarmCalls);
  operatorPasteInstrs.push(...tmpOperatorPasteInstrs);

  // call[1] - Mow.
  advancedFarmCalls.push({
    callData: (await siloFacetInterface()).encodeFunctionData("mow", [ZERO_ADDRESS, ZERO_ADDRESS]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  operatorPasteInstrs.push(
    ...[
      await drafter().then(
        async (drafter) =>
          await drafter.encodeOperatorPasteInstr(
            PUBLISHER_COPY_INDEX,
            1,
            ARGS_START_INDEX // + ADDR_SLOT_OFFSET
          )
      ),
      await drafter().then(
        async (drafter) =>
          await drafter.encodeOperatorPasteInstr(
            SLOT_SIZE,
            1,
            ARGS_START_INDEX + SLOT_SIZE // + ADDR_SLOT_OFFSET
          )
      )
    ]
  );

  // call[2] - Get new publisher stalk balance.
  [tmpAdvancedFarmCalls, tmpOperatorPasteInstrs] = await draftBalanceOfStalk(2);
  advancedFarmCalls.push(...tmpAdvancedFarmCalls);
  operatorPasteInstrs.push(...tmpOperatorPasteInstrs);

  // call[3] - Get stalk balance difference.
  [tmpAdvancedFarmCalls, tmpOperatorPasteInstrs] = await draftDiffOfReturns(2, 0);
  advancedFarmCalls.push(...tmpAdvancedFarmCalls);
  operatorPasteInstrs.push(...tmpOperatorPasteInstrs);

  // call[4] - Get Bean reward amount from stalk balance difference.
  advancedFarmCalls.push({
    callData: (await junctionFacetInterface()).encodeFunctionData("mulDiv", [
      rewardRatio,
      0,
      RATIO_FACTOR
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(3, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE)
        ])
    )
  });

  // call[5] - Transfer Bean reward to operator from publisher external balance.
  advancedFarmCalls.push({
    callData: (await tokenFacetInterface()).encodeFunctionData("transferToken", [
      BEAN,
      ZERO_ADDRESS,
      0,
      EXTERNAL,
      EXTERNAL
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(4, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE * 2)
        ])
    )
  });
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(
          OPERATOR_COPY_INDEX,
          5,
          ARGS_START_INDEX + SLOT_SIZE // + ADDR_SLOT_OFFSET
        )
    )
  );

  console.log(advancedFarmCalls);
  console.log(operatorPasteInstrs);

  return [advancedFarmCalls, operatorPasteInstrs];
};

/**
 * Blueprint allowing the Operator to Plant on behalf of the Publisher.
 * Operator is rewarded Beans as a ratio of earned beans claimed.
 */
const draftPlant = async (rewardRatio) => {
  // AdvancedFarmCall[]
  let advancedFarmCalls = [];

  // bytes32[]
  let operatorPasteInstrs = [];

  // call[0] - Plant.
  advancedFarmCalls.push({
    callData: (await siloFacetInterface()).encodeFunctionData("plant", []),
    clipboard: ethers.utils.hexlify("0x000000")
  });

  // call[1] - Get Bean reward amount from stalk balance difference.
  advancedFarmCalls.push({
    callData: (await junctionFacetInterface()).encodeFunctionData("mulDiv", [
      rewardRatio,
      0,
      RATIO_FACTOR
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE)
        ])
    )
  });

  // call[2] - Transfer Bean reward to operator from publisher external balance.
  advancedFarmCalls.push({
    callData: (await tokenFacetInterface()).encodeFunctionData("transferToken", [
      BEAN,
      ZERO_ADDRESS,
      0,
      EXTERNAL,
      EXTERNAL
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(1, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE * 2)
        ])
    )
  });
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(
          OPERATOR_COPY_INDEX,
          2,
          ARGS_START_INDEX + SLOT_SIZE // + ADDR_SLOT_OFFSET
        )
    )
  );

  console.log(advancedFarmCalls);
  console.log(operatorPasteInstrs);

  return [advancedFarmCalls, operatorPasteInstrs];
};

module.exports = {
  initDrafter,
  drafter,
  signRequisition,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
  generateCalldataCopyParams,
  encodeBlueprintData,
  draftDepositInternalBeanBalance,
  draftMow,
  draftPlant,
  RATIO_FACTOR
};
