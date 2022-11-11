async function deploy(name, account) {
  const contract = await (await ethers.getContractFactory(name, account)).deploy();
  await contract.deployed()
  return contract
}

exports.deployContract = deploy