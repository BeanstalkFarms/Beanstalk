const { upgradeWithNewFacets, deploy } = require('../scripts/diamond.js');
const { BEAN, BEANSTALK, BCM, USDC, BEAN_3_CURVE, ZERO_ADDRESS, CURVE_ZAP, TEST_GNOSIS } = require('../test/utils/constants.js');
const { to6 } = require('../test/utils/helpers.js');
const fs = require("fs");

async function replant10(account, mock) {
  console.log('-----------------------------------')
  console.log('Replant10: Replant Beanstalk\n')

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

  const diamondCutFacet = await ethers.getContractAt("DiamondCutFacet", BEANSTALK)
  const pauseFacet = await ethers.getContractAt("PauseFacet", BEANSTALK)
  const fertilizerFacet = await ethers.getContractAt("FertilizerFacet", BEANSTALK)

  console.log("Preparing Transactions for BCM submission...")

  const curveZap = await ethers.getContractAt('ICurveZap', CURVE_ZAP)
  const usdc = await ethers.getContractAt("IERC20", USDC)
  const usdcBalance = await usdc.balanceOf(BCM)
  const amount = ethers.BigNumber.from(usdcBalance).div(ethers.BigNumber.from('1000000'))

  let minLPOut = await curveZap.callStatic.calc_token_amount(BEAN_3_CURVE, [usdcBalance.mul(to6('0.866616')).div(to6('1')), '0', usdcBalance, '0'], true) // set
  minLPOut = minLPOut.mul(to6('.99')).div(to6('1'))

  const diamondCut = diamondCutFacet.interface.encodeFunctionData('diamondCut', 
    Object.values(diamondCutParams)
  )

  const approvalParams = [BEANSTALK, `${ethers.constants.MaxUint256}`]
  const approval = usdc.interface.encodeFunctionData('approve', approvalParams)

  const addFertilizerParams = ['0', `${amount}`, `${minLPOut}`]
  const addFertilizer = fertilizerFacet.interface.encodeFunctionData('addFertilizerOwner', addFertilizerParams)

  if (mock) {
    await account.sendTransaction({
      to: BCM,
      value: ethers.utils.parseEther("1")
    });

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BCM],
    });

    await hre.network.provider.send("hardhat_setCode", [BCM, "0x"]);
    await hre.network.provider.send("hardhat_setBalance", [BCM, "0xDE0B6B3A7640000"]);

    const bcm = await ethers.getSigner(BCM)

    console.log("Upgrading Beanstalk...")
    await bcm.sendTransaction({ to: BEANSTALK, value: '0', data: diamondCut })

    console.log("Approving USDC to Beanstalk...")
    await bcm.sendTransaction({ to: USDC, value: '0', data: approval })

    console.log("Adding Fertilizer...")
    await bcm.sendTransaction({ to: BEANSTALK, value: '0', data: addFertilizer })

    console.log("Unpausing Beanstalk...")
    unpause = await pauseFacet.connect(bcm).unpause()

    console.log("Beanstalk successfully upgraded...")
  } else {
    await fs.writeFileSync(`./replant/gnosis/diamondCut.json`, JSON.stringify({ to: BEANSTALK, parameters: Object.values(diamondCutParams), data: diamondCut }, null, 4));
    await fs.writeFileSync(`./replant/gnosis/approval.json`, JSON.stringify({ to: USDC, parameters: approvalParams, data: approval }, null, 4));
    await fs.writeFileSync(`./replant/gnosis/addFertilizer.json`, JSON.stringify({ to: BEANSTALK, parameters: addFertilizerParams, data: addFertilizer }, null, 4));
    console.log("BCM Transactions ready for submission")
  }
  console.log('-----------------------------------')
}
exports.replant10 = replant10