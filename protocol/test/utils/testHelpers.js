const {
  BEAN,
  BEANSTALK,
  MAX_UINT256,
  BEAN_ETH_WELL,
  UNRIPE_BEAN,
  UNRIPE_LP,
  ZERO_BYTES
} = require("./constants");
const { getMockBeanstalk } = require("../../utils/contracts");
const { to6, to18 } = require("./helpers");
// general beanstalk test helpers to assist with testing.

/**
 * @notice initalizes the array of users.
 * @dev
 * - approves beanstalk to use all beans.
 * - mints `amount` to `users`.
 */
async function initalizeUsersForToken(tokenAddress, users, amount) {
  const token = await ethers.getContractAt("MockToken", tokenAddress);
  for (let i = 0; i < users.length; i++) {
    await token.connect(users[i]).approve(BEANSTALK, MAX_UINT256);
    await token.mint(users[i].address, amount);
  }
  return token;
}

/**
 * ends germination for the beanstalk, by elasping 2 seasons.
 * @dev mockBeanstalk should be initalized prior to calling this function.
 */
async function endGermination() {
  await mockBeanstalk.siloSunrise(to6("0"));
  await mockBeanstalk.siloSunrise(to6("0"));
}

/**
 * ends germination for the beanstalk, by elasping 2 seasons.
 * Also ends total germination for a specific token.
 * @dev mockBeanstalk should be initalized prior to calling this function.
 */
async function endGerminationWithMockToken(token) {
  await mockBeanstalk.siloSunrise(to6("0"));
  await mockBeanstalk.siloSunrise(to6("0"));
  await mockBeanstalk.mockEndTotalGerminationForToken(token);
}

/**
 * @notice Mints and adds the underlying token to the unripe.
 * @dev Used in `SiloToken.test.js`.
 */
async function addMockUnderlying(unripeToken, underlyingToken, amount, user) {
  token = await ethers.getContractAt("MockToken", underlyingToken);
  await token.mint(user.address, amount);
  if ((await beanstalk.getUnderlyingToken(unripeToken)) != underlyingToken) {
    await beanstalk.switchUnderlyingToken(unripeToken, underlyingToken);
  }
  await token.connect(user).approve(BEANSTALK, MAX_UINT256);
  await mockBeanstalk.connect(user).addUnderlying(unripeToken, amount);
}

/**
 * @notice sets various parameters regarding fertilizer and the barn raise.
 */
async function setRecapitalizationParams(
  user,
  isFertilizing = true,
  totalUnfertilizedbeans = to6("10000"),
  underlyingUnripeLP = BEAN_ETH_WELL,
  usdcRecapitalized = to6("500"),
  fertilizedIndex = 0,
  beansUnderlyingUnripeBean = to6("1000"),
  LpUnderlyingUnripeLP = to18("3162.277660")
) {
  await mockBeanstalk.setFertilizerE(isFertilizing, totalUnfertilizedbeans);
  await mockBeanstalk.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
  await mockBeanstalk.addUnripeToken(UNRIPE_LP, underlyingUnripeLP, ZERO_BYTES);
  await bean.mint(user.address, beansUnderlyingUnripeBean);
  await mockBeanstalk.setPenaltyParams(usdcRecapitalized, fertilizedIndex);
  await mockBeanstalk.connect(user).addUnderlying(UNRIPE_BEAN, beansUnderlyingUnripeBean);
  await mockBeanstalk.connect(user).addUnderlying(
    UNRIPE_LP,
    LpUnderlyingUnripeLP // 3162.2776601683793319
  );
}

exports.addMockUnderlying = addMockUnderlying;
exports.endGermination = endGermination;
exports.endGerminationWithMockToken = endGerminationWithMockToken;
exports.initalizeUsersForToken = initalizeUsersForToken;
exports.setRecapitalizationParams = setRecapitalizationParams;
