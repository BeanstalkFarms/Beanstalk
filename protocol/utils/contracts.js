const fs = require('fs');
const beanstalkABI = require("../abi/Beanstalk.json");
const { BEANSTALK, BEAN, BEAN_3_CURVE, USDC } = require('../test/utils/constants');

async function getBeanstalk() {
    return await ethers.getContractAt(beanstalkABI, BEANSTALK);
}

async function getBeanstalkAdminControls() {
    return await ethers.getContractAt('MockAdminFacet', BEANSTALK);
}

async function getBean() {
    return await ethers.getContractAt('Bean', BEAN);
}

async function getUsdc() {
    return await ethers.getContractAt('IBean', USDC);
}


async function getBeanMetapool() {
    return await ethers.getContractAt('ICurvePool', BEAN_3_CURVE);
}

exports.getBeanstalk = getBeanstalk;
exports.getBean = getBean;
exports.getUsdc = getUsdc;
exports.getBeanMetapool = getBeanMetapool;
exports.getBeanstalkAdminControls = getBeanstalkAdminControls;