const { ethers } = require("ethers");

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

module.exports = {
  signRequisition,
  getNormalBlueprintData,
  getAdvancedBlueprintData,
  generateCalldataCopyParams
};
