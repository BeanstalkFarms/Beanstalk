const fs = require('fs');

function parsePodListings(inputFilePath, outputFilePath, callback) {
    fs.readFile(inputFilePath, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }

        const storageData = JSON.parse(data);
        const podListings = storageData.podListings["0"]; // Accessing the podListings object
        const result = [];

        for (const podIndex in podListings) {
            if (podListings.hasOwnProperty(podIndex)) {
                const podListingId = podListings[podIndex];
                const podIndexStr = parseInt(podIndex, 10).toString();
                result.push([podIndexStr, podListingId]);
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

        const storageData = JSON.parse(data);
        const podOrders = storageData.podOrders; // Accessing the podOrders object
        const result = [];

        for (const orderIndex in podOrders) {
            if (podOrders.hasOwnProperty(orderIndex)) {
                const orderBeanAmount = podOrders[orderIndex];
                result.push([orderIndex, parseInt(orderBeanAmount, 16).toString()]);
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

const inputFilePath = "./reseed/data/exports/storage-system20330000.json";
const podListingsOutputFilePath = "./reseed/data/r2/pod-listings.json";
const podOrdersOutputFilePath = "./reseed/data/r2/pod-orders.json";

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
