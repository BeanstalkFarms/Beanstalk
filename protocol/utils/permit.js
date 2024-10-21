const MAX_INT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

async function getSiloDomain() {
  return getSiloDomainWithChainId(1);
}

async function getSiloDomainWithChainId(chainId) {
  return {
    name: "SiloDeposit",
    version: "1",
    chainId: chainId,
    verifyingContract: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5"
  };
}

async function getTokenDomain() {
  return getTokenDomainWithChainId(1);
}

async function getTokenDomainWithChainId(chainId) {
  return {
    name: "Token",
    version: "1",
    chainId: chainId,
    verifyingContract: "0xc1e088fc1323b20bcbee9bd1b9fc9546db5624c5"
  };
}

const EIP712Domain = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" }
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

  return { rawSignature, split: { ...splitSignatureToRSV(rawSignature) } };
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
        { name: "deadline", type: "uint256" }
      ]
    },
    primaryType: "Permit",
    domain,
    message
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
        { name: "deadline", type: "uint256" }
      ]
    },
    primaryType: "Permit",
    domain,
    message
  };

  return typedData;
};

const createTypedTokenPermitData = (message, domain) => {
  const typedData = {
    types: {
      EIP712Domain,
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "token", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    },
    primaryType: "Permit",
    domain,
    message
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
  deadline
) {
  return signSiloDepositTokensPermitWithChainId(
    provider,
    owner,
    spender,
    tokens,
    values,
    nonce,
    deadline,
    1
  );
}

async function signSiloDepositTokensPermitWithChainId(
  provider,
  owner,
  spender,
  tokens,
  values,
  nonce,
  deadline,
  chainId
) {
  const message = {
    owner,
    spender,
    tokens,
    values,
    nonce,
    deadline: deadline || MAX_INT
  };

  const domain = await getSiloDomainWithChainId(chainId);
  const typedData = createTypedDepositTokensPermitData(message, domain);
  const sig = await signWithEthers(provider, owner, typedData);

  return { ...sig, ...message };
}

async function signSiloDepositTokenPermit(provider, owner, spender, token, value, nonce, deadline) {
  signSiloDepositTokenPermitWithChainId(provider, owner, spender, token, value, nonce, deadline, 1);
}

async function signSiloDepositTokenPermitWithChainId(
  provider,
  owner,
  spender,
  token,
  value,
  nonce,
  deadline,
  chainId
) {
  const message = {
    owner,
    spender,
    token,
    value,
    nonce,
    deadline: deadline || MAX_INT
  };

  const domain = await getSiloDomainWithChainId(chainId);
  const typedData = createTypedDepositTokenPermitData(message, domain);
  const sig = await signWithEthers(provider, owner, typedData);

  return { ...sig, ...message };
}

async function signTokenPermit(provider, owner, spender, token, value, nonce, deadline) {
  signTokenPermitWithChainId(provider, owner, spender, token, value, nonce, deadline, 1);
}

async function signTokenPermitWithChainId(
  provider,
  owner,
  spender,
  token,
  value,
  nonce,
  deadline,
  chainId
) {
  const message = {
    owner,
    spender,
    token,
    value,
    nonce,
    deadline: deadline || MAX_INT
  };

  const domain = await getTokenDomainWithChainId(chainId);
  const typedData = createTypedTokenPermitData(message, domain);
  const sig = await signWithEthers(provider, owner, typedData);

  return { ...sig, ...message };
}

exports.signSiloDepositTokenPermit = signSiloDepositTokenPermit;
exports.signSiloDepositTokenPermitWithChainId = signSiloDepositTokenPermitWithChainId;
exports.signTokenPermit = signTokenPermit;
exports.signTokenPermitWithChainId = signTokenPermitWithChainId;
exports.signSiloDepositTokensPermit = signSiloDepositTokensPermit;
exports.signSiloDepositTokensPermitWithChainId = signSiloDepositTokensPermitWithChainId;
