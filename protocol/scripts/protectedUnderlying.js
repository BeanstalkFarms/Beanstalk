const { L2_BEANSTALK } = require("../test/hardhat/utils/constants");
const { impersonateBeanstalkOwner, mintEth } = require("../utils");
const { upgradeWithNewFacets } = require("./diamond");
const fs = require("fs");

const BEGIN_BARN_RAISE_MIGRATION_SELECTOR = "0xe3d4e44c";
const RFF_SAFE = "0x2B25b6F1c75231E30e89EF670999E2A3B1029CcE";
const ENROOT_SELECTORS = Object.freeze(["0xe43b44ee", "0x0b58f073", "0x88fcd169"]);
const ENROOT_LIBRARIES = Object.freeze({
  LibSilo: "0x7d668415e36e005820b587e77b1d2e99845c136e",
  LibTokenSilo: "0xdc66303c59a587bbeb08672949fb55612df7200a"
});

function appendEnrootFacetToArtifact({ baseArtifact, enrootFacet, ethers }) {
  if (!baseArtifact?.diamondCut?.diamondCut || !Array.isArray(baseArtifact.diamondCut.diamondCut)) {
    throw new Error("Base artifact does not contain a diamond cut.");
  }
  if (!ethers.utils.isAddress(enrootFacet)) {
    throw new Error("A valid EnrootFacet address is required.");
  }

  const updated = JSON.parse(JSON.stringify(baseArtifact));
  const existingSelectors = new Set(
    updated.diamondCut.diamondCut.flatMap((cut) =>
      (cut[2] || []).map((selector) => selector.toLowerCase())
    )
  );
  for (const selector of ENROOT_SELECTORS) {
    if (existingSelectors.has(selector)) {
      throw new Error(`Enroot selector already exists in base cut: ${selector}`);
    }
  }

  updated.diamondCut.diamondCut.push([
    ethers.utils.getAddress(enrootFacet),
    1,
    [...ENROOT_SELECTORS]
  ]);
  return updated;
}

async function prepareEnrootFacet({
  hre,
  baseArtifactPath,
  libSilo = ENROOT_LIBRARIES.LibSilo,
  libTokenSilo = ENROOT_LIBRARIES.LibTokenSilo,
  confirm = false,
  fork = false
}) {
  const { ethers } = hre;
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (!fork && chainId !== 42161) {
    throw new Error(`EnrootFacet deployment requires Arbitrum (42161), got ${chainId}.`);
  }

  const baseArtifact = JSON.parse(fs.readFileSync(baseArtifactPath, "utf8"));
  const diamond = ethers.utils.getAddress(
    baseArtifact.preflight?.diamond || baseArtifact.safeTransaction?.to
  );
  const libraries = {
    LibSilo: ethers.utils.getAddress(libSilo),
    LibTokenSilo: ethers.utils.getAddress(libTokenSilo)
  };
  const [libSiloCode, libTokenSiloCode] = await Promise.all([
    ethers.provider.getCode(libraries.LibSilo),
    ethers.provider.getCode(libraries.LibTokenSilo)
  ]);
  if (libSiloCode === "0x" || libTokenSiloCode === "0x") {
    throw new Error("Configured EnrootFacet library address has no deployed code.");
  }

  const loupe = new ethers.Contract(
    diamond,
    ["function facetAddress(bytes4) view returns (address)"],
    ethers.provider
  );
  const currentFacetAddresses = await Promise.all(
    ENROOT_SELECTORS.map((selector) => loupe.facetAddress(selector))
  );
  if (currentFacetAddresses.some((address) => address === ethers.constants.AddressZero)) {
    throw new Error("An Enroot selector is not currently installed on the Diamond.");
  }
  if (currentFacetAddresses[0].toLowerCase() !== currentFacetAddresses[1].toLowerCase()) {
    throw new Error("Enroot selectors do not currently resolve to the same facet.");
  }

  const preflight = {
    chainId,
    diamond,
    baseArtifactPath,
    currentEnrootFacet: ethers.utils.getAddress(currentFacetAddresses[0]),
    selectors: [...ENROOT_SELECTORS],
    libraries,
    deployed: false
  };
  console.log("EnrootFacet-only preflight:");
  console.table(preflight);

  if (!confirm) {
    console.log("Read-only preflight complete. Re-run with --confirm to deploy EnrootFacet.");
    return preflight;
  }

  let account;
  if (fork) {
    [account] = await ethers.getSigners();
  } else {
    if (!process.env.DIAMOND_DEPLOYER_PK) {
      throw new Error("DIAMOND_DEPLOYER_PK is required to deploy EnrootFacet.");
    }
    account = new ethers.Wallet(process.env.DIAMOND_DEPLOYER_PK, ethers.provider);
  }
  const deployer = ethers.utils.getAddress(await account.getAddress());
  if (
    baseArtifact.preflight?.deployer &&
    deployer !== ethers.utils.getAddress(baseArtifact.preflight.deployer)
  ) {
    throw new Error("EnrootFacet deployer does not match the base artifact deployer.");
  }

  const factory = await ethers.getContractFactory("EnrootFacet", {
    libraries,
    signer: account
  });
  const enrootFacet = await factory.deploy();
  await enrootFacet.deployed();

  const updated = appendEnrootFacetToArtifact({
    baseArtifact,
    enrootFacet: enrootFacet.address,
    ethers
  });
  const diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", diamond);
  updated.safeTransaction = {
    to: diamond,
    value: "0",
    data: diamondCutFacet.interface.encodeFunctionData("diamondCut", [
      updated.diamondCut.diamondCut,
      updated.diamondCut.initFacetAddress,
      updated.diamondCut.functionCall
    ]),
    operation: 0
  };
  updated.enrootFacet = {
    address: ethers.utils.getAddress(enrootFacet.address),
    deployer,
    transactionHash: enrootFacet.deployTransaction.hash,
    selectors: [...ENROOT_SELECTORS],
    libraries
  };

  const outputPath = `./diamondCuts/protected-underlying-enroot-${chainId}-${Math.floor(
    Date.now() / 1000
  )}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(updated, null, 2));
  console.log(`EnrootFacet deployed at ${enrootFacet.address}`);
  console.log(`Updated Safe-ready Diamond cut written to ${outputPath}`);

  return { ...preflight, deployed: true, deployer, enrootFacet: enrootFacet.address, outputPath };
}

async function preflightProtectedUnderlying({
  hre,
  amount,
  custodian = RFF_SAFE,
  diamondAddress = L2_BEANSTALK,
  fork = false
}) {
  const { ethers } = hre;
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  if (!fork && chainId !== 42161) {
    throw new Error(`Protected underlying deployment requires Arbitrum (42161), got ${chainId}.`);
  }
  if (!ethers.utils.isAddress(diamondAddress)) {
    throw new Error("A valid Beanstalk Diamond address is required.");
  }
  if (!ethers.utils.isAddress(custodian) || custodian === ethers.constants.AddressZero) {
    throw new Error("A non-zero protected custodian address is required.");
  }

  const diamond = ethers.utils.getAddress(diamondAddress);
  const protectedCustodian = ethers.utils.getAddress(custodian);
  const beanstalk = new ethers.Contract(
    diamond,
    [
      "function owner() view returns (address)",
      "function getBeanstalkTokens() view returns (tuple(address bean,address fertilizer,address urBean,address urLp))",
      "function getUnderlyingToken(address) view returns (address)",
      "function getTotalUnderlying(address) view returns (uint256)"
    ],
    ethers.provider
  );

  const unripeLp = (await beanstalk.getBeanstalkTokens()).urLp;
  const diamondOwner = await beanstalk.owner();
  const underlyingToken = ethers.utils.getAddress(await beanstalk.getUnderlyingToken(unripeLp));
  const underlying = new ethers.Contract(
    underlyingToken,
    ["function decimals() view returns (uint8)"],
    ethers.provider
  );
  const [decimals, currentLocalUnderlying] = await Promise.all([
    underlying.decimals(),
    beanstalk.getTotalUnderlying(unripeLp)
  ]);
  const protectedAmount = ethers.utils.parseUnits(amount, decimals);

  if (protectedAmount.isZero()) {
    throw new Error("Protected underlying amount must be greater than zero.");
  }
  if (protectedAmount.gt(currentLocalUnderlying)) {
    throw new Error("Protected underlying amount exceeds current local backing.");
  }

  const custodianCode = await ethers.provider.getCode(protectedCustodian);
  if (custodianCode === "0x") {
    throw new Error("Protected custodian is not a deployed contract.");
  }
  const safe = new ethers.Contract(
    protectedCustodian,
    ["function getThreshold() view returns (uint256)"],
    ethers.provider
  );
  const safeThreshold = (await safe.getThreshold()).toString();

  return {
    chainId,
    diamond,
    diamondOwner: ethers.utils.getAddress(diamondOwner),
    custodian: protectedCustodian,
    safeThreshold,
    unripeLp: ethers.utils.getAddress(unripeLp),
    underlyingToken,
    underlyingDecimals: Number(decimals),
    currentLocalUnderlying: currentLocalUnderlying.toString(),
    protectedAmount: protectedAmount.toString(),
    remainingLocalUnderlying: currentLocalUnderlying.sub(protectedAmount).toString(),
    currentLocalFormatted: ethers.utils.formatUnits(currentLocalUnderlying, decimals),
    protectedFormatted: ethers.utils.formatUnits(protectedAmount, decimals),
    remainingLocalFormatted: ethers.utils.formatUnits(
      currentLocalUnderlying.sub(protectedAmount),
      decimals
    ),
    deployed: false
  };
}

async function prepareProtectedUnderlying({ hre, confirm = false, ...args }) {
  const preflight = await preflightProtectedUnderlying({ hre, ...args });
  console.log("Protected underlying preflight:");
  console.table({
    network: preflight.chainId,
    diamond: preflight.diamond,
    diamondOwner: preflight.diamondOwner,
    custodian: preflight.custodian,
    safeThreshold: preflight.safeThreshold,
    underlyingToken: preflight.underlyingToken,
    currentLocal: preflight.currentLocalFormatted,
    protecting: preflight.protectedFormatted,
    remainingLocal: preflight.remainingLocalFormatted
  });

  if (!confirm) {
    console.log("Read-only preflight complete. Re-run with --confirm to deploy contracts.");
    return preflight;
  }

  let account;
  if (args.fork) {
    [account] = await hre.ethers.getSigners();
  } else {
    if (!process.env.DIAMOND_DEPLOYER_PK) {
      throw new Error("DIAMOND_DEPLOYER_PK is required to deploy contracts.");
    }
    account = new hre.ethers.Wallet(process.env.DIAMOND_DEPLOYER_PK, hre.ethers.provider);
  }

  const dc = await upgradeProtectedUnderlying({
    RFF: preflight.custodian,
    amount: preflight.protectedAmount,
    diamondAddress: preflight.diamond,
    account,
    execute: false,
    verbose: true
  });
  const diamondCutFacet = await hre.ethers.getContractAt(
    "DiamondCutFacet",
    preflight.diamond
  );
  const encoded = diamondCutFacet.interface.encodeFunctionData("diamondCut", [
    dc.diamondCut,
    dc.initFacetAddress,
    dc.functionCall
  ]);
  const output = {
    preflight: { ...preflight, deployed: true, deployer: await account.getAddress() },
    diamondCut: dc,
    safeTransaction: {
      to: preflight.diamond,
      value: "0",
      data: encoded,
      operation: 0
    }
  };
  const outputPath = `./diamondCuts/protected-underlying-${preflight.chainId}-${Math.floor(
    Date.now() / 1000
  )}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Safe-ready Diamond cut written to ${outputPath}`);

  return { ...preflight, deployed: true, outputPath, diamondCut: dc, encoded };
}

/**
 * Builds or executes the diamond cut that moves Unripe LP backing into RFF custody.
 * By default the cut is generated as an object and is not executed.
 */
async function upgradeProtectedUnderlying({
  RFF,
  amount,
  diamondAddress = L2_BEANSTALK,
  account,
  execute = false,
  verbose = true
}) {
  if (!ethers.utils.isAddress(RFF) || RFF === ethers.constants.AddressZero) {
    throw new Error("A non-zero RFF address is required.");
  }

  const protectedAmount = ethers.BigNumber.from(amount);
  if (protectedAmount.isZero()) {
    throw new Error("A non-zero protected underlying amount is required.");
  }

  if (account === undefined) {
    account = await impersonateBeanstalkOwner(diamondAddress);
    await mintEth(account.address);
  }

  return upgradeWithNewFacets({
    diamondAddress,
    facetNames: [
      "UnripeFacet",
      "EnrootFacet",
      "BDVFacet",
      "ConvertFacet",
      "SeasonFacet",
      "SeasonGettersFacet",
      "GaugeGettersFacet"
    ],
    libraryNames: [
      "LibLockedUnderlying",
      "LibEvaluate",
      "LibPipelineConvert",
      "LibConvert",
      "LibSilo",
      "LibTokenSilo",
      "LibGauge",
      "LibIncentive",
      "LibShipping",
      "LibFlood",
      "LibGerminate",
      "LibWellMinting"
    ],
    facetLibraries: {
      UnripeFacet: ["LibLockedUnderlying"],
      EnrootFacet: ["LibSilo", "LibTokenSilo"],
      ConvertFacet: ["LibPipelineConvert", "LibConvert", "LibSilo", "LibTokenSilo"],
      SeasonFacet: [
        "LibEvaluate",
        "LibGauge",
        "LibIncentive",
        "LibShipping",
        "LibFlood",
        "LibGerminate",
        "LibWellMinting"
      ],
      SeasonGettersFacet: ["LibLockedUnderlying", "LibWellMinting"],
      GaugeGettersFacet: ["LibLockedUnderlying"]
    },
    linkedLibraries: {
      LibEvaluate: ["LibLockedUnderlying"]
    },
    selectorsToRemove: [BEGIN_BARN_RAISE_MIGRATION_SELECTOR],
    initFacetName: "InitProtectedUnderlying",
    initArgs: [RFF, protectedAmount],
    bip: false,
    object: !execute,
    verbose,
    account,
    reportGas: false
  });
}

exports.BEGIN_BARN_RAISE_MIGRATION_SELECTOR = BEGIN_BARN_RAISE_MIGRATION_SELECTOR;
exports.ENROOT_SELECTORS = ENROOT_SELECTORS;
exports.ENROOT_LIBRARIES = ENROOT_LIBRARIES;
exports.RFF_SAFE = RFF_SAFE;
exports.appendEnrootFacetToArtifact = appendEnrootFacetToArtifact;
exports.prepareEnrootFacet = prepareEnrootFacet;
exports.preflightProtectedUnderlying = preflightProtectedUnderlying;
exports.prepareProtectedUnderlying = prepareProtectedUnderlying;
exports.upgradeProtectedUnderlying = upgradeProtectedUnderlying;
