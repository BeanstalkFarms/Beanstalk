const { BigNumber } = require("ethers");

const signDelegate = async (
  signer,
  verifier,
  account,
  selector,
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
        name: "approval",
        type: "bytes",
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
    approval,
    nonce,
    deadline,
  });
  return signature;
};

const signPermitPods = async (
  signer,
  verifier,
  account,
  spender,
  amount,
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
    PermitPods: [
      {
        name: "account",
        type: "address",
      },
      {
        name: "spender",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
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
    spender,
    amount,
    nonce,
    deadline,
  });
  return signature;
};

module.exports = {
  signDelegate,
  signPermitPods,
};
