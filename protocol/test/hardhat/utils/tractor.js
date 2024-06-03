const { ethers } = require("hardhat");

const { EXTERNAL, INTERNAL } = require("./balances.js");
const { BEAN, ZERO_ADDRESS, UNRIPE_BEAN, UNRIPE_LP, BEANSTALK } = require("./constants.js");
const { to6, to18 } = require("./helpers.js");

// const ARRAY_LENGTH = 5;
const SLOT_SIZE = 32;
const SELECTOR_SIZE = 4;
const ARGS_START_INDEX = SELECTOR_SIZE + SLOT_SIZE;
const EXTERNAL_ARGS_START_INDEX = SELECTOR_SIZE * 2 + SLOT_SIZE * 4 + SLOT_SIZE;
const PIPE_RETURN_BYTE_OFFSET = 64;
// const ADDR_SLOT_OFFSET = 12; // 32 - 20
const PUBLISHER_COPY_INDEX = ethers.BigNumber.from(2).pow(80).sub(1); // MaxUint80;
const OPERATOR_COPY_INDEX = PUBLISHER_COPY_INDEX.sub(1);
// NOTE copy and paste byte indices are for the largest index of the 32 bytes (ie the rightmost byte, ie the most significant byte)
//      This was unexpected to me, but seemingly intentional in the clipboard paste32Bytes implementation.

const TO_FILL = 0;
const TO_FILL_BYTES = ethers.utils.hexZeroPad(0, 32);

const RATIO_FACTOR = ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18));

// Copied from protocol/test/Tractor.test.js
const ConvertKind = {
  DEPRECATED_0: 0,
  DEPRECATED_1: 1,
  UNRIPE_BEANS_TO_LP: 2,
  UNRIPE_LP_TO_BEANS: 3,
  BEANS_TO_WELL_LP: 5,
  WELL_LP_TO_BEANS: 6
};

// From LibTractorFacet.sol
const CounterUpdateType = {
  INCREASE: 0,
  DECREASE: 1
};

let drafterAddr;
let junctionAddr;

// Init test chain state for Drafter to function.
const initContracts = async () => {
  drafterAddr = await (
    await (await (await ethers.getContractFactory("Drafter")).deploy()).deployed()
  ).address;
  console.log("Drafter deployed to:", drafterAddr);
  junctionAddr = await (
    await (await (await ethers.getContractFactory("Junction")).deploy()).deployed()
  ).address;
  console.log("Junction deployed to:", junctionAddr);
};

// TODO clean up use of interfaces. Clearly this is not how hardhat wants to be used.
const convertFacetInterface = new ethers.utils.Interface([
  "function convert(bytes convertData, int96[] stems, uint256[] amounts) returns (int96 toStem, uint256 fromAmount, uint256 toAmount, uint256 fromBdv, uint256 toBdv)"
]);
// Interfaces needed to encode calldata.
const farmFacetInterface = async () => (await ethers.getContractFactory("FarmFacet")).interface;
const tokenFacetInterface = async () => (await ethers.getContractFactory("TokenFacet")).interface;
const siloFacetInterface = async () =>
  (
    await ethers.getContractFactory("SiloFacet", {
      libraries: {
        LibSilo: (await (await ethers.getContractFactory("LibSilo")).deploy()).address
      }
    })
  ).interface;
const claimFacetInterface = async () =>
  (
    await ethers.getContractFactory("ClaimFacet", {
      libraries: {
        LibSilo: (await (await ethers.getContractFactory("LibSilo")).deploy()).address
      }
    })
  ).interface;

const siloGettersFacetInterface = async () =>
  (await ethers.getContractFactory("SiloGettersFacet")).interface;
// const convertFacetInterface = async () => (await ethers.getContractFactory("ConvertFacet")).interface;
const junctionInterface = async () => (await ethers.getContractFactory("Junction")).interface;
const pipelineInterface = async () => (await ethers.getContractFactory("Pipeline")).interface;
const tractorFacetInterface = async () =>
  (await ethers.getContractFactory("TractorFacet")).interface;

// Need to actually execute the logic in Drafter pure functions.
// TODO replace Drafter contract with TS SDK drafter.
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

// Shape:
//      4 bytes  (pipe selector)
//      32 bytes (location of PipeCall)
//      32 bytes (PipeCall.target)
//      n bytes  (PipeCall.data)
//        32 bytes (PipeCall.data location)
//        32 bytes (PipeCall.data length)
//        4 bytes  (PipeCall.data external selector)
//        n bytes  (PipeCall.data external args)
const wrapExternalCall = async (target, callData) => {
  pipeCall = {
    target: target,
    data: callData
  };
  return (await pipelineInterface()).encodeFunctionData("pipe", [pipeCall]);
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
    callData: (await siloGettersFacetInterface()).encodeFunctionData("balanceOfStalk", [
      ZERO_ADDRESS
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

const draftDiffOfReturns = async (returnDataItemIndex0, returnDataItemIndex1) => {
  let tmpAdvancedFarmCalls = [];
  let tmpOperatorPasteInstrs = [];
  tmpAdvancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("sub", [0, 0])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(
            returnDataItemIndex0,
            SLOT_SIZE,
            EXTERNAL_ARGS_START_INDEX
          ),
          await drafter.encodeLibReturnPasteParam(
            returnDataItemIndex1,
            SLOT_SIZE,
            EXTERNAL_ARGS_START_INDEX + SLOT_SIZE
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
const draftDepositInternalBeanBalance = async (tip, verbose = false) => {
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
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("gte", [0, to6("1000")])
    ),
    clipboard: await drafter().then(async (drafter) =>
      drafter.encodeClipboard(0, [
        await drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, EXTERNAL_ARGS_START_INDEX)
      ])
    )
  });

  // call[2] - Require internal balance check true.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("check", [false])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(1, [
          await drafter.encodeLibReturnPasteParam(
            1,
            SLOT_SIZE + PIPE_RETURN_BYTE_OFFSET,
            EXTERNAL_ARGS_START_INDEX
          )
        ])
    )
  });

  // call[3] - Get difference between publisher internal balance and tip.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("sub", [0, tip])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, EXTERNAL_ARGS_START_INDEX)
        ])
    )
  });

  // call[4] - Deposit publisher internal balance, less tip.
  advancedFarmCalls.push({
    callData: (await siloFacetInterface()).encodeFunctionData("deposit", [BEAN, 0, INTERNAL]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(
            3,
            SLOT_SIZE + PIPE_RETURN_BYTE_OFFSET,
            ARGS_START_INDEX + SLOT_SIZE
          )
        ])
    )
  });

  // call[5] - Transfer tip to operator external balance.
  advancedFarmCalls.push({
    callData: (await tokenFacetInterface()).encodeFunctionData("transferToken", [
      BEAN,
      ZERO_ADDRESS,
      tip,
      INTERNAL,
      EXTERNAL
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(OPERATOR_COPY_INDEX, 5, ARGS_START_INDEX + SLOT_SIZE)
    )
  );

  if (verbose) {
    console.log(advancedFarmCalls);
    console.log(operatorPasteInstrs);
  }

  return [advancedFarmCalls, operatorPasteInstrs];
};

/**
 * Blueprint allowing the Operator to enroot one deposit on behalf of the Publisher.
 * Operator is rewarded Beans as a ratio of stalk increase (from both mowing and enroot).
 */
const draftMow = async (rewardRatio, verbose = false) => {
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
    callData: (await claimFacetInterface()).encodeFunctionData("mow", [ZERO_ADDRESS, ZERO_ADDRESS]),
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
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("mulDiv", [rewardRatio, 0, RATIO_FACTOR])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(
            3,
            SLOT_SIZE,
            EXTERNAL_ARGS_START_INDEX + SLOT_SIZE
          )
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

  if (verbose) {
    console.log(advancedFarmCalls);
    console.log(operatorPasteInstrs);
  }

  return [advancedFarmCalls, operatorPasteInstrs];
};

/**
 * Blueprint allowing the Operator to Plant on behalf of the Publisher.
 * Operator is rewarded Beans as a ratio of earned beans claimed.
 */
const draftPlant = async (rewardRatio, verbose = false) => {
  // AdvancedFarmCall[]
  let advancedFarmCalls = [];

  // bytes32[]
  let operatorPasteInstrs = [];

  // call[0] - Plant.
  advancedFarmCalls.push({
    callData: (await claimFacetInterface()).encodeFunctionData("plant", []),
    clipboard: ethers.utils.hexlify("0x000000")
  });

  // call[1] - Get Bean reward amount from stalk balance difference.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("mulDiv", [rewardRatio, 0, RATIO_FACTOR])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(
            0,
            SLOT_SIZE,
            EXTERNAL_ARGS_START_INDEX + SLOT_SIZE
          )
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
  if (verbose) {
    console.log(advancedFarmCalls);
    console.log(operatorPasteInstrs);
  }

  return [advancedFarmCalls, operatorPasteInstrs];
};

/**
 * Blueprint allowing the Operator to Convert one entire urBean deposit to urLP of the Publisher.
 * Operator is rewarded flat rate tip.
 */
const draftConvertUrBeanToUrLP = async (tip, minOutLpPerBean, verbose = false) => {
  // AdvancedFarmCall[]
  let advancedFarmCalls = [];

  // bytes32[]
  let operatorPasteInstrs = [];

  // Call[0] - Junction get deposit ID.
  advancedFarmCalls.push({
    callData: (await siloGettersFacetInterface()).encodeFunctionData("getDepositId", [
      UNRIPE_BEAN,
      0 // stem
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  // Get stem from operator data.
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(SLOT_SIZE, 0, ARGS_START_INDEX + SLOT_SIZE)
    )
  );

  // Call[1] - Junction get deposit balance in Beans.
  advancedFarmCalls.push({
    callData: (await siloGettersFacetInterface()).encodeFunctionData("balanceOf", [
      ZERO_ADDRESS,
      TO_FILL
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(0, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE)
        ])
    )
  });
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(PUBLISHER_COPY_INDEX, 1, ARGS_START_INDEX)
    )
  );

  // Call[2] - Junction get min LP out.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("mulDiv", [minOutLpPerBean, 0, RATIO_FACTOR])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          await drafter.encodeLibReturnPasteParam(
            1,
            SLOT_SIZE,
            EXTERNAL_ARGS_START_INDEX + SLOT_SIZE
          )
        ])
    )
  });

  // call[3] - Convert.
  // Shape
  //     4 bytes convert selector
  //     32 bytes location of convertData (100)
  //     32 bytes location of stems (160)
  //     32 bytes location of amounts (244)
  //     32 bytes - length of convertData (65)
  //     32 bytes - convert kind (UNRIPE_LP_TO_BEANS)
  //     32 bytes - amountIn
  //     32 bytes - minAmountOut
  //     32 bytes - length of stems (32)
  //     32 bytes - stems[0]
  //     32 bytes - length of amounts (32)
  //     32 bytes - amounts[0]
  advancedFarmCalls.push({
    callData: convertFacetInterface.encodeFunctionData("convert", [
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"], // type, amountIn, minAmountOut
        [ConvertKind.UNRIPE_BEANS_TO_LP, TO_FILL, TO_FILL]
      ), // convertData
      [TO_FILL], // stems
      [TO_FILL] // amounts
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          // amountIn (== balanceOf deposit)
          await drafter.encodeLibReturnPasteParam(1, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE * 5),
          // minAmountOut // NOTE this is not being well exercised. Should confirm in test that it is not 0.
          await drafter.encodeLibReturnPasteParam(
            2,
            SLOT_SIZE + PIPE_RETURN_BYTE_OFFSET,
            ARGS_START_INDEX + SLOT_SIZE * 6
          ),
          // amounts[0] (== amountIn == balanceOf deposit)
          await drafter.encodeLibReturnPasteParam(1, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE * 10)
        ])
    )
  });
  // Get stem from operator data.
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(SLOT_SIZE, 3, ARGS_START_INDEX + SLOT_SIZE * 8)
    )
  );

  // call[4] - Transfer Bean reward to operator from publisher internal balance.
  advancedFarmCalls.push({
    callData: (await tokenFacetInterface()).encodeFunctionData("transferToken", [
      BEAN,
      ZERO_ADDRESS,
      tip,
      INTERNAL,
      EXTERNAL
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(OPERATOR_COPY_INDEX, 4, ARGS_START_INDEX + SLOT_SIZE)
    )
  );

  if (verbose) {
    console.log(advancedFarmCalls);
    console.log(operatorPasteInstrs);
  }

  return [advancedFarmCalls, operatorPasteInstrs];
};

/**
 * Blueprint allowing the Operator to Convert one entire urLP deposit to urBean of the Publisher.
 * Operator is rewarded flat rate tip.
 */
const draftConvert = async (tip, minUrLpPerUrBeanRatio, minUrBeanPerUrLpRatio, verbose = false) => {
  // AdvancedFarmCall[]
  let advancedFarmCalls = [];

  // bytes32[]
  let operatorPasteInstrs = [];

  // Call[0] - Junction get tokenIn address.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("bytes32Switch", [
        TO_FILL,
        [
          ethers.utils.hexZeroPad(0, 32),
          ethers.utils.hexZeroPad(0, 32),
          ethers.utils.hexZeroPad(UNRIPE_BEAN, 32), // left pad address
          ethers.utils.hexZeroPad(UNRIPE_LP, 32) // left pad address
          // ethers.utils.hexConcat([UNRIPE_BEAN, "0x000000000000000000000000"]), // right pad address
          // ethers.utils.hexConcat([UNRIPE_LP, "0x000000000000000000000000"]) // right pad address
        ]
      ])
    ),
    clipboard: ethers.utils.hexlify("0x000000")
  });

  if (verbose) {
    console.log("byte padding");
    console.log(UNRIPE_BEAN);
    console.log(ethers.utils.hexZeroPad(UNRIPE_BEAN, 32));
    console.log(minUrLpPerUrBeanRatio);
    console.log(ethers.utils.hexZeroPad(minUrLpPerUrBeanRatio, 32));
  }

  // Get convert type as switch selector.
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(SLOT_SIZE * 2, 0, EXTERNAL_ARGS_START_INDEX)
    )
  );

  // Call[1] - Junction get min out per in.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("bytes32Switch", [
        TO_FILL,
        [
          ethers.constants.MaxUint256,
          ethers.constants.MaxUint256,
          ethers.utils.hexZeroPad(minUrLpPerUrBeanRatio, 32),
          ethers.utils.hexZeroPad(minUrBeanPerUrLpRatio, 32)
        ]
      ])
    ),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  // Get convert type as switch selector.
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        // convert type
        await drafter.encodeOperatorPasteInstr(SLOT_SIZE * 2, 1, EXTERNAL_ARGS_START_INDEX)
    )
  );

  // Call[2] - Get deposit ID.
  advancedFarmCalls.push({
    callData: (await siloGettersFacetInterface()).encodeFunctionData("getDepositId", [
      ZERO_ADDRESS,
      TO_FILL // stem
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          // deposit token
          await drafter.encodeLibReturnPasteParam(
            0,
            SLOT_SIZE + PIPE_RETURN_BYTE_OFFSET,
            ARGS_START_INDEX
          )
        ])
    )
  });
  // Get stem from operator data.
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(SLOT_SIZE, 2, ARGS_START_INDEX + SLOT_SIZE)
    )
  );

  // Call[3] - Get deposit amount.
  advancedFarmCalls.push({
    callData: (await siloGettersFacetInterface()).encodeFunctionData("balanceOf", [
      ZERO_ADDRESS,
      TO_FILL
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          // deposit ID
          await drafter.encodeLibReturnPasteParam(2, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE)
        ])
    )
  });
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        // account
        await drafter.encodeOperatorPasteInstr(PUBLISHER_COPY_INDEX, 3, ARGS_START_INDEX)
    )
  );

  // Call[4] - Junction get min out.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("mulDiv", [TO_FILL, TO_FILL, RATIO_FACTOR])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          // Min out per in.
          await drafter.encodeLibReturnPasteParam(
            1,
            SLOT_SIZE + PIPE_RETURN_BYTE_OFFSET,
            EXTERNAL_ARGS_START_INDEX
          ),
          // Deposit amount.
          await drafter.encodeLibReturnPasteParam(
            3,
            SLOT_SIZE,
            EXTERNAL_ARGS_START_INDEX + SLOT_SIZE
          )
        ])
    )
  });

  // call[5] - Convert.
  // Shape
  //     32 bytes - length
  //     4 bytes convert selector
  //     32 bytes location of convertData (100)
  //     32 bytes location of stems (160)
  //     32 bytes location of amounts (244)
  //     32 bytes - length of convertData (65)
  //     32 bytes - convert kind (UNRIPE_LP_TO_BEANS)
  //     32 bytes - amountIn
  //     32 bytes - minAmountOut
  //     32 bytes - length of stems (32)
  //     32 bytes - stems[0]
  //     32 bytes - length of amounts (32)
  //     32 bytes - amounts[0]
  advancedFarmCalls.push({
    callData: convertFacetInterface.encodeFunctionData("convert", [
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"], // type, amountIn, minAmountOut
        [TO_FILL, TO_FILL, TO_FILL]
      ), // convertData
      [TO_FILL], // stems
      [TO_FILL] // amounts
    ]),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(0, [
          // amountIn (== balanceOf deposit)
          await drafter.encodeLibReturnPasteParam(3, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE * 5),
          // minAmountOut
          await drafter.encodeLibReturnPasteParam(
            4,
            SLOT_SIZE + PIPE_RETURN_BYTE_OFFSET,
            ARGS_START_INDEX + SLOT_SIZE * 6
          ),
          // amounts[0] (== amountIn == balanceOf deposit)
          await drafter.encodeLibReturnPasteParam(3, SLOT_SIZE, ARGS_START_INDEX + SLOT_SIZE * 10)
        ])
    )
  });
  // convert type.
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        // convert type
        await drafter.encodeOperatorPasteInstr(SLOT_SIZE * 2, 5, ARGS_START_INDEX + SLOT_SIZE * 4)
    )
  );
  // Get stem from operator data.
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(SLOT_SIZE, 5, ARGS_START_INDEX + SLOT_SIZE * 8)
    )
  );

  // call[6] - Transfer Bean reward to operator from publisher internal balance.
  advancedFarmCalls.push({
    callData: (await tokenFacetInterface()).encodeFunctionData("transferToken", [
      BEAN,
      ZERO_ADDRESS,
      tip,
      INTERNAL,
      EXTERNAL
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });
  operatorPasteInstrs.push(
    await drafter().then(
      async (drafter) =>
        await drafter.encodeOperatorPasteInstr(OPERATOR_COPY_INDEX, 6, ARGS_START_INDEX + SLOT_SIZE)
    )
  );
  if (verbose) {
    console.log(advancedFarmCalls);
    console.log(operatorPasteInstrs);
  }

  return [advancedFarmCalls, operatorPasteInstrs];
};

/**
 * Blueprint to deposit 100 Beans from internal balance of publisher. Uses counters to limit deposits to maxCumulativeDepositAmount.
 * Serves as a demo of using counters.
 */
const draftDepositInternalBeansWithLimit = async (maxCumulativeDepositAmount, verbose = false) => {
  // AdvancedFarmCall[]
  let advancedFarmCalls = [];

  // bytes32[]
  let operatorPasteInstrs = [];

  // call[0] - Deposit 100 Beans from publisher internal balance.
  advancedFarmCalls.push({
    callData: (await siloFacetInterface()).encodeFunctionData("deposit", [
      BEAN,
      to6("100"),
      INTERNAL
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });

  const counterId = ethers.utils.keccak256(Date.now());

  // call[1] - Increment counter by 100.
  advancedFarmCalls.push({
    callData: (await tractorFacetInterface()).encodeFunctionData("updateCounter", [
      counterId,
      CounterUpdateType.INCREASE,
      to6("100")
    ]),
    clipboard: ethers.utils.hexlify("0x000000")
  });

  // call[2] - Get counter value (redundant with return of call[1], but illustrative).
  advancedFarmCalls.push({
    callData: (await tractorFacetInterface()).encodeFunctionData("getCounter", [counterId]),
    clipboard: ethers.utils.hexlify("0x000000")
  });

  // call[3] - Check if counter less than or equal to maxCumulativeDepositAmount.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("lte", [0, maxCumulativeDepositAmount])
    ),
    clipboard: await drafter().then(async (drafter) =>
      drafter.encodeClipboard(0, [
        await drafter.encodeLibReturnPasteParam(2, SLOT_SIZE, EXTERNAL_ARGS_START_INDEX)
      ])
    )
  });

  // call[4] - Require counter check true.
  advancedFarmCalls.push({
    callData: await wrapExternalCall(
      junctionAddr,
      (await junctionInterface()).encodeFunctionData("check", [false])
    ),
    clipboard: await drafter().then(
      async (drafter) =>
        await drafter.encodeClipboard(1, [
          await drafter.encodeLibReturnPasteParam(
            3,
            SLOT_SIZE + PIPE_RETURN_BYTE_OFFSET,
            EXTERNAL_ARGS_START_INDEX
          )
        ])
    )
  });

  if (verbose) {
    console.log(advancedFarmCalls);
    console.log(operatorPasteInstrs);
  }

  return [advancedFarmCalls, operatorPasteInstrs];
};

module.exports = {
  initContracts,
  drafter,
  signRequisition,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
  generateCalldataCopyParams,
  encodeBlueprintData,
  draftDepositInternalBeanBalance,
  draftMow,
  draftPlant,
  draftConvertUrBeanToUrLP,
  draftConvert,
  draftDepositInternalBeansWithLimit,
  RATIO_FACTOR,
  ConvertKind
};
