import middy from 'middy';
import { Handler } from '@netlify/functions';
import { cors, rateLimit } from '~/functions/middleware';

const deposits = require('./data/Deposits.json');
const depositsTree = require('./data/deposit_tree.json');

const fertilizers = require('./data/Fertilizers.json');
const fertilizersTree = require('./data/fert_tree.json');

const farmBalances = require('./data/InternalBalances.json');
const farmBalancesTree = require('./data/internal_balance_tree.json');

const plots = require('./data/Plots.json');
const plotsTree = require('./data/plot_tree.json');

/**
 * Look `account`.
 */
const _handler: Handler = async (event) => {

    const accountNoCase = event.queryStringParameters?.account;
    const account = event.queryStringParameters?.account?.toLowerCase();

    if (!account || !accountNoCase) {
        return {
            statusCode: 400,
            body: 'Account parameter required',
        };
    }

    const userDeposits = deposits.find((depositData: Array<string>) => depositData[0].toLowerCase() === account);
    const depositMerkle = Object.entries(depositsTree.proofs).find((depositProof) => depositProof[0].toLowerCase() === account)
    const deposit = !userDeposits ? {} : {
        depositIds: userDeposits[1],
        amounts: userDeposits[2],
        bdvs: userDeposits[3],
        proofs: depositMerkle ? depositMerkle[1] : []
    }

    const userFertilizers = fertilizers.find((fertData: Array<string>) => fertData[0].toLowerCase() === account);
    const fertMerkle = Object.entries(fertilizersTree.proofs).find((fertProof) => fertProof[0].toLowerCase() === account);
    const fert = !userFertilizers ? {} : {
        fertIds: userFertilizers[1],
        amounts: userFertilizers[2],
        lastBpf: userFertilizers[3],
        proofs: fertMerkle ? fertMerkle[1] : []
    }

    const userFarmBalances = farmBalances.find((farmBalanceData: Array<string>) => farmBalanceData[0].toLowerCase() === account);
    const farmBalanceMerkle = Object.entries(farmBalancesTree.proofs).find((farmBalProof) => farmBalProof[0].toLowerCase() === account);
    const farmBal = !userFarmBalances ? {} : {
        tokens: userFarmBalances[1],
        amounts: userFarmBalances[2],
        proofs: farmBalanceMerkle ? farmBalanceMerkle[1] : []
    }

    const userPlots = plots.find((plotData: Array<string>) => plotData[0].toLowerCase() === account);
    const plotsMerkle = Object.entries(plotsTree.proofs).find((plotProof) => plotProof[0].toLowerCase() === account);
    const plot = !userPlots ? {} : {
        index: userPlots[1],
        pods: userPlots[2],
        proofs: plotsMerkle ? plotsMerkle[1] : []
    }

    function isEmpty(myObject: any) {
        return Object.keys(myObject).length === 0;
    }

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            account: accountNoCase,
            needsManualMigration: !isEmpty(deposit) || !isEmpty(farmBal) || !isEmpty(fert) || !isEmpty(plot),
            deposits: deposit ? deposit : '',
            fertilizer: fert ? fert : '',
            farmBalance: farmBal ? farmBal : '',
            plots: plot ? plot : ''
        }),
    };
};

export const handler = middy(_handler)
    .use(rateLimit())
    .use(
        cors({
            origin: process.env.NODE_ENV === 'production' ? '*.bean.money' : '*',
        })
    );
