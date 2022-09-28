const MAX_INT =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

async function getDomain() {
  return {
    name: "SiloDeposit",
    version: "1",
    chainId: 1,
    verifyingContract: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5",
  };
}

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

function splitSignatureToRSV(signature) {
  const r = "0x" + signature.substring(2).substring(0, 64);
  const s = "0x" + signature.substring(2).substring(64, 128);
  const v = parseInt(signature.substring(2).substring(128, 130), 16);
  return { r, s, v };
}

async function signWithEthers(signer, fromAddress, typeData) {
  const signerAddress = await signer.getAddress();
  if (signerAddress.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error("Signer address does not match requested signing address");
  }

  const { EIP712Domain: _unused, ...types } = typeData.types;
  const rawSignature = await (signer.signTypedData
    ? signer.signTypedData(typeData.domain, types, typeData.message)
    : signer._signTypedData(typeData.domain, types, typeData.message));

  return { rawSignature, split: {...splitSignatureToRSV(rawSignature) }};
}

const createTypedDepositTokensPermitData = (message, domain) => {
  const typedData = {
    types: {
      EIP712Domain,
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "tokens", type: "address[]" },
        { name: "values", type: "uint256[]" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    domain,
    message,
  };

  return typedData;
};

const createTypedDepositTokenPermitData = (message, domain) => {
  const typedData = {
    types: {
      EIP712Domain,
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "token", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    domain,
    message,
  };

  return typedData;
};

async function signSiloDepositTokensPermit(
  provider,
  owner,
  spender,
  tokens,
  values,
  nonce,
  deadline,
) {
  const message = {
    owner,
    spender,
    tokens,
    values,
    nonce,
    deadline: deadline || MAX_INT,
  };

  const domain = await getDomain();
  const typedData = createTypedDepositTokensPermitData(message, domain);
  const sig = await signWithEthers(provider, owner, typedData);

  return { ...sig, ...message };
}

async function signSiloDepositTokenPermit(
  provider,
  owner,
  spender,
  token,
  value,
  nonce,
  deadline,
) {
  const message = {
    owner,
    spender,
    token,
    value,
    nonce,
    deadline: deadline || MAX_INT,
  };

  const domain = await getDomain();
  const typedData = createTypedDepositTokenPermitData(message, domain);
  const sig = await signWithEthers(provider, owner, typedData);

  return { ...sig, ...message };
}

exports.signSiloDepositTokenPermit = signSiloDepositTokenPermit;
exports.signSiloDepositTokensPermit = signSiloDepositTokensPermit;