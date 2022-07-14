const { upgradeWithNewFacets, deploy } = require('../scripts/diamond.js');
const { BEAN, BEANSTALK, BCM, USDC, BEAN_3_CURVE, ZERO_ADDRESS } = require('../test/utils/constants.js');

async function replant10(account) {
  console.log('-----------------------------------')
  console.log('Replant10:\n')

  const Fertilizer = await ethers.getContractFactory("Fertilizer", account);
  const fertilizer = await Fertilizer.deploy();
  await fertilizer.deployed()
  console.log(`Fertilzer deployed to : ${fertilizer.address}`);

  const diamondCutParams = await upgradeWithNewFacets({
    diamondAddress: BEANSTALK,
    facetNames:
      [
        'BDVFacet',
        'CurveFacet',
        'ConvertFacet',
        'FarmFacet',
        'FertilizerFacet',
        'FieldFacet',
        'FundraiserFacet',
        'MarketplaceFacet',
        'OwnershipFacet',
        'PauseFacet',
        'SeasonFacet',
        'SiloFacet',
        'TokenFacet',
        'UnripeFacet',
        'WhitelistFacet'
      ],
    initFacetName: 'InitReplant',
    initArgs: [fertilizer.address],
    object: true,
    verbose: false,
    account: account
  });

  const deployingSelectors = diamondCutParams.diamondCut.map((d) => d[2]).flat()

  const loupe = await ethers.getContractAt('DiamondLoupeFacet', BEANSTALK)
  const deployedSelectors = await loupe.facets()
  selectorsToRemove = deployedSelectors
    .filter((d) => d.facetAddress !== '0xDFeFF7592915bea8D040499E961E332BD453C249' &&
                d.facetAddress !== '0xB51D5C699B749E0382e257244610039dDB272Da0')
    .map((d) => d.functionSelectors)
    .flat()
    .filter((d) => !deployingSelectors.includes(d))

  if (selectorsToRemove.length > 0) {
    diamondCutParams.diamondCut.push([
      ZERO_ADDRESS,
      2,
      selectorsToRemove
    ])
  }

  await account.sendTransaction({
    to: BCM,
    value: ethers.utils.parseEther("1")
  });

  const diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", BEANSTALK)
  const pauseFacet = await ethers.getContractAt("PauseFacet", BEANSTALK)
  const fertilizerFacet = await ethers.getContractAt("FertilizerFacet", BEANSTALK)

  console.log("Upgrading Beanstalk:")

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [BCM],
  });

  await hre.network.provider.send("hardhat_setCode", [BCM, "0x"]);
  await hre.network.provider.send("hardhat_setBalance", [BCM, "0xDE0B6B3A7640000"]);

  const bcm = await ethers.getSigner(BCM)
  // const bcm = account

  diamondCut = await diamondCutFacet.connect(bcm).diamondCut(
    diamondCutParams.diamondCut,
    diamondCutParams.initFacetAddress,
    diamondCutParams.functionCall
  )

  console.log("Beanstalk upgraded...")

  const usdc = await ethers.getContractAt("IERC20", USDC)
  const bean = await ethers.getContractAt("IERC20", BEAN)
  const amount = ethers.BigNumber.from(await usdc.balanceOf(BCM)).div(ethers.BigNumber.from('1000000'))

  console.log("Approving USDC to Beanstalk...")
  await usdc.connect(bcm).approve(BEANSTALK, ethers.constants.MaxUint256)

  console.log("Adding Fertilizer...")
  addFertilizer = await fertilizerFacet.connect(bcm).addFertilizerOwner(
      '6074',
      amount,
      '0' // SET !!!!!!!!!!!!!!!!!!!!!!!!!!!!
  )

  console.log("Unpausing Beanstalk...")
  unpause = await pauseFacet.connect(bcm).unpause()

  console.log("Beanstalk successfully upgraded")
  console.log('-----------------------------------')
}
exports.replant10 = replant10