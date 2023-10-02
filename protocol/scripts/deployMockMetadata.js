const hre = require("hardhat");


async function main() {
    const MockMetadataFacet = await ethers.getContractFactory('MockMetadataFacet');
    console.log('Deploying MockMetadataFacet...');
    const mockMetadataFacet = await MockMetadataFacet.deploy();
    await mockMetadataFacet.deployed();
    console.log('mockMetadataFacet deployed to:', mockMetadataFacet.address);

   // only needs to be deployed once. Deploy a new mockMetdata facet, then change the address on MockMetadataERC1155.
    const MockMetadataERC1155 = await ethers.getContractFactory('MockMetadataERC1155');
    console.log('Deploying MockMetadataERC1155...');
    const mockMetadataERC1155 = await MockMetadataERC1155.deploy('TEST', '0x12a5c6fdF938F276bdf67961a9cc0B58092eDAC9');
    await mockMetadataERC1155.deployed();
    console.log('metadataMockERC1155 deployed to:', mockMetadataERC1155.address);

 }
 
 main()
    .then(() => process.exit(0))
    .catch((error) => {
       console.error(error);
       process.exit(1);
    });