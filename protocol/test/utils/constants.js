const { BN } = require('@openzeppelin/test-helpers')
module.exports = {
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  MAX_UINT256: (new BN('2').pow(new BN('256')).subn(1)).toString(),
  MAX_UINT32: (new BN('2').pow(new BN('32')).subn(1)).toString()
};
