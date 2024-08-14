const fs = require('fs');

function parsePodListings(inputFilePath, outputFilePath, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }

        const marketData = JSON.parse(data).listings;
        const result = [];

        for (const id in marketData) {
            if (marketData.hasOwnProperty(id)) {
                const listing = marketData[id];
                result.push([
                    id,
                    listing.account,
                    listing.index,
                    listing.start,
                    listing.amount,
                    listing.pricePerPod.toString(),
                    listing.maxHarvestableIndex,
                    listing.minFillAmount,
                    listing.mode.toString(),
                ]);
            }
        }

        fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), (writeErr) => {
            if (writeErr) {
                callback(writeErr, null);
                return;
            }
            callback(null, 'Pod Listings JSON has been written successfully');
        });
    });
}

function parsePodOrders(inputFilePath, outputFilePath, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }

        const marketData = JSON.parse(data).orders;
        const result = [];

        for (const id in marketData) {
            if (marketData.hasOwnProperty(id)) {
                const order = marketData[id];
                result.push([
                    order.account,
                    id,
                    parseInt(order.beanAmount, 16).toString(),
                    order.pricePerPod.toString(),
                    order.maxPlaceInLine,
                    order.minFillAmount
                ]);
            }
        }

        fs.writeFile(outputFilePath, JSON.stringify(result, null, 2), (writeErr) => {
            if (writeErr) {
                callback(writeErr, null);
                return;
            }
            callback(null, 'Pod Orders JSON has been written successfully');
        });
    });
}

const inputFilePath = './reseed/data/exports/market-info20330000.json';
const podListingsOutputFilePath = './reseed/data/r2/pod-listings.json';
const podOrdersOutputFilePath = './reseed/data/r2/pod-orders.json';

parsePodListings(inputFilePath, podListingsOutputFilePath, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
});

parsePodOrders(inputFilePath, podOrdersOutputFilePath, (err, message) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    console.log(message);
});

// module.exports = { parsePodListings, parsePodOrders };
