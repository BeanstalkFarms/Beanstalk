const { BN } = require('@openzeppelin/test-helpers')
module.exports = {
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  MAX_UINT256: (new BN('2').pow(new BN('256')).subn(1)).toString(),
  MAX_UINT32: (new BN('2').pow(new BN('32')).subn(1)).toString(),
  MIN_PLENTY_BASE: (new BN('10').pow(new BN('20'))).toString(),
  BEANSTALK: "0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5",
  BEAN: "0xdc59ac4fefa32293a95889dc396682858d52e5db"
};
