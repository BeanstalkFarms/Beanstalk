const { BigNumber } = require("ethers");

const signDelegate = async (
  signer,
  verifier,
  account,
  selector,
  delegatee,
  approval,
  nonce,
  deadline
) => {
  const chainId = BigNumber.from(await signer.getChainId());
  const domain = {
    name: "Beanstalk",
    version: "1",
    chainId,
    verifyingContract: verifier,
  };
  const types = {
    PermitDelegate: [
      {
        name: "account",
        type: "address",
      },
      {
        name: "selector",
        type: "bytes4",
      },
      {
        name: "delegatee",
        type: "address",
      },
      {
        name: "approval",
        type: "bytes32",
      },
      {
        name: "nonce",
        type: "uint256",
      },
      {
        name: "deadline",
        type: "uint256",
      },
    ],
  };
  const signature = await signer._signTypedData(domain, types, {
    account,
    selector,
    delegatee,
    approval,
    nonce,
    deadline,
  });
  return signature;
};

module.exports = {
  signDelegate,
};
