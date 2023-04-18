//this script generates a merkle tree for the stalk and seed discrepancies
//to be used in the mowAndMigrate function for silov3 migration

const { MerkleTree } = require('merkletreejs')
const csv = require('csv-parser');
const fs = require('fs');
const keccak256 = require("keccak256");
const ethers = require('ethers');

const csvPath = './scripts/silov3-merkle/data/seed-stalk-discrepancies.csv'
const merkleOutput = './scripts/silov3-merkle/data/seed-stalk-merkle.json'
const beansItems = []
const stalkSeedsLeaves = []

fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
        const item = [row['address'], row['stalk'], row['seeds']];

        //I initially tried these 2 methods, but they worked differently than solidity's `keccak256(abi.encodePacked(account, stalkDiff, seedsDiff));`
        //manually doing the padding like below made things line up with the solidity version
        // const leaf = ethers.utils.solidityKeccak256(
        //     ["address", "uint256", "uint256"],
        //     item
        // )

        // const packedData = ethers.utils.defaultAbiCoder.encode(
        //     ["address", "uint256", "uint256"],
        //     item
        // );
        // const leaf = ethers.utils.keccak256(packedData);


        const addressPadded = ethers.utils.hexZeroPad(row['address'], 32); // Pad address to 20 bytes
        const stalkPadded = ethers.utils.hexZeroPad(ethers.BigNumber.from(row['stalk']).toHexString(), 32); // Pad stalk to 32 bytes
        const seedsPadded = ethers.utils.hexZeroPad(ethers.BigNumber.from(row['seeds']).toHexString(), 32); // Pad seeds to 32 bytes

        const packedData = ethers.utils.hexConcat([addressPadded, stalkPadded, seedsPadded]); // Concatenate the padded values
        const leaf = ethers.utils.keccak256(packedData);

        beansItems.push(item);
        stalkSeedsLeaves.push(leaf);
    })
    .on('end', () => {
        const merkleTree = new MerkleTree(stalkSeedsLeaves, keccak256, { sortPairs: true });
        const root = merkleTree.getHexRoot();
        const d = beansItems.reduce((acc, [address, stalk, seeds], i) => {
            acc[address] = {
                stalk: stalk,
                seeds: seeds,
                leaf: stalkSeedsLeaves[i],
                proof: merkleTree.getHexProof(stalkSeedsLeaves[i])
            }
            return acc;
        }, {})
        fs.writeFile(merkleOutput, JSON.stringify(d, null, 4), (err) => {
            if (err) {
                console.error(err);
                return;
            };
            console.log(merkleOutput, "has been written with a root hash of:\n", root);
        });
    });

