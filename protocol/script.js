const Web3 = require('web3');
const fs = require('fs').promises;
const abi = require('https://raw.githubusercontent.com/BeanstalkFarms/Beanstalk/master/protocol/abi/Beanstalk.json');
const contractAddress = '0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5';

async function getBalanceOfStalk(account) {
    const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
    const contract = new web3.eth.Contract(abi, contractAddress);
    const stalkWithTenDecimals = await contract.methods.balanceOfStalk(account).call();
    return stalkWithTenDecimals
}

async function getStalkPerStalkholder() {
    const data = await fs.readFile('stalkholderAccounts.json');
    const accounts = JSON.parse(data);

    let stalkholders = {}

    for (const account of accounts) {
        stalkWithTenDecimals = await getBalanceOfStalk(account)
        stalk = Math.trunc(stalkWithDecimals / Math.pow(10, 10));
        console.log(account, stalk)
        stalkholders[account] = stalk
    }

    fs.writeFile('stalkholders.json', JSON.stringify(stalkholders), (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
}

getStalkForStalkholders()