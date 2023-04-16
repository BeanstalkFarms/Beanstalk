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
        const leaf = ethers.utils.solidityKeccak256(
            ["address", "uint256", "uint256"],
            item
        )
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

