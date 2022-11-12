const { getBeanstalk, getBean, getBeanMetapool, getUsdc, getBeanstalkAdminControls, getPrice } = require("./contracts.js");
const { impersonateSigner, impersonateBeanstalkOwner } = require("./signer.js");
const { mintUsdc, mintBeans, mintEth } = require("./mint.js")
const { readPrune } = require("./read.js")
const { signSiloDepositTokenPermit, signSiloDepositTokensPermit, signTokenPermit } = require("./permit.js");


function toBN(a) {
    return ethers.BigNumber.from(a)
  }

exports.toBN = toBN
exports.getBeanstalk = getBeanstalk
exports.getBean = getBean
exports.getBeanMetapool = getBeanMetapool
exports.getUsdc = getUsdc
exports.getBeanstalkAdminControls = getBeanstalkAdminControls
exports.impersonateSigner = impersonateSigner
exports.impersonateBeanstalkOwner = impersonateBeanstalkOwner
exports.mintUsdc = mintUsdc
exports.mintBeans = mintBeans
exports.mintEth = mintEth
exports.getPrice = getPrice
exports.readPrune = readPrune
exports.signSiloDepositTokenPermit = signSiloDepositTokenPermit
exports.signSiloDepositTokensPermit = signSiloDepositTokensPermit
exports.signTokenPermit = signTokenPermit