const { BEAN, BEANSTALK, MAX_UINT256 } = require('./constants');
const { getMockBeanstalk } = require('../../utils/contracts');
const { to6 } = require('./helpers');
// general beanstalk test helpers to assist with testing.

/**
 * @notice initalizes the array of users. 
 * @dev 
 * - approves beanstalk to use all beans.
 * - mints 10,000 beans to each user.
 */
async function initalizeUsers(users, approve=true, mint=true) {
    const bean = await ethers.getContractAt('MockToken', BEAN);
  for (let i = 0; i < users.length; i++) {
    if(approve) {
        await bean.connect(users[i]).approve(BEANSTALK, MAX_UINT256);
    }
    if (mint) {
      await bean.mint(users[i].address, to6('10000'));
    }
  }
}

/**
 * ends germination for the beanstalk, by elasping 2 seasons.
 * @dev mockBeanstalk should be initalized prior to calling this function.
 */
async function endGermination() {
    await mockBeanstalk.siloSunrise(to6('0'))
    await mockBeanstalk.siloSunrise(to6('0'))
}

exports.endGermination = endGermination;
exports.initalizeUsers = initalizeUsers;
