const { MerkleTree } = require('merkletreejs')
const csv = require('csv-parser');
const fs = require('fs');
const keccak256 = require("keccak256");
const ethers = require('ethers');

const beansName = './replant/merkle/data/unripe-beans.csv'
const beansOutput = './replant/merkle/data/unripe-beans-merkle.json'
const beansItems = []
const beansLeaves = []

fs.createReadStream(beansName)
    .pipe(csv())
    .on('data', (row) => {
        const item = [row['address'], row['unripeBeans']];
        const leaf = ethers.utils.solidityKeccak256(
            ["address", "uint256"],
            item
        )
        beansItems.push(item);
        beansLeaves.push(leaf);
    })
    .on('end', () => {
        const merkleTree = new MerkleTree(beansLeaves, keccak256, { sortPairs: true });
        const root = merkleTree.getHexRoot();
        const d = beansItems.reduce((acc, [address, unripeBeans], i) => {
            acc[address] = {
                unripeBeans: unripeBeans,
                leaf: beansLeaves[i],
                proof: merkleTree.getHexProof(beansLeaves[i])
            }
            return acc;
        }, {})
        fs.writeFile(beansOutput, JSON.stringify(d, null, 4), (err) => {
            if (err) {
                console.error(err);
                return;
            };
            console.log(beansOutput, "has been written with a root hash of:\n", root);
        });
    });

const bean3crvName = './replant/merkle/data/unripe-bean3crv.csv'
const bean3crvOutput = './replant/merkle/data/unripe-bean3crv-merkle.json'
const bean3crvItems = []
const bean3crvLeaves = []

fs.createReadStream(bean3crvName)
    .pipe(csv())
    .on('data', (row) => {
        const item = [row['address'], row['unripeBean3crv']];
        const leaf = ethers.utils.solidityKeccak256(
            ["address", "uint256"],
            item
        )
        bean3crvItems.push(item);
        bean3crvLeaves.push(leaf);
    })
    .on('end', () => {
        const merkleTree = new MerkleTree(bean3crvLeaves, keccak256, { sortPairs: true });
        const root = merkleTree.getHexRoot();
        const d = bean3crvItems.reduce((acc, [address, unripeBeans], i) => {
            acc[address] = {
                unripeBeans: unripeBeans,
                leaf: bean3crvLeaves[i],
                proof: merkleTree.getHexProof(bean3crvLeaves[i])
            }
            return acc;
        }, {})
        fs.writeFile(bean3crvOutput, JSON.stringify(d, null, 4), (err) => {
            if (err) {
                console.error(err);
                return;
            };
            console.log(bean3crvOutput, "has been written with a root hash of:\n", root);
        });
    });
