const fs = require('fs');
const beanstalkABI = require("../abi/Beanstalk.json");
const { BEANSTALK, BEAN, BEAN_3_CURVE, USDC, FERTILIZER, PRICE } = require('../test/utils/constants');

async function getBeanstalk(contract = BEANSTALK) {
    return await ethers.getContractAt(beanstalkABI, contract);
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

async function getPrice() {
    return await ethers.getContractAt('BeanstalkPrice', PRICE)
}


async function getBeanMetapool() {
    return await ethers.getContractAt('ICurvePool', BEAN_3_CURVE);
}

async function getFertilizerPreMint() {
    return await ethers.getContractAt('FertilizerPreMint', FERTILIZER)
}

async function getFertilizer() {
    return await ethers.getContractAt('Fertilizer', FERTILIZER)
}

exports.getBeanstalk = getBeanstalk;
exports.getBean = getBean;
exports.getUsdc = getUsdc;
exports.getPrice = getPrice;
exports.getBeanMetapool = getBeanMetapool;
exports.getBeanstalkAdminControls = getBeanstalkAdminControls;
exports.getFertilizerPreMint = getFertilizerPreMint
exports.getFertilizer = getFertilizer