const fs = require("fs");
const { convertToBigNum } = require("../../utils/read.js");

function parsePodListings(inputFilePath, outputFilePath) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const marketData = JSON.parse(data).listings;
    const result = [];

    for (const id in marketData) {
      if (marketData.hasOwnProperty(id)) {
        const listing = marketData[id];
        result.push([
          id,
          listing.account,
          convertToBigNum(listing.index),
          convertToBigNum(listing.start),
          convertToBigNum(listing.amount),
          listing.pricePerPod.toString(),
          convertToBigNum(listing.maxHarvestableIndex),
          convertToBigNum(listing.minFillAmount),
          listing.mode.toString()
        ]);
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("Pod Listings JSON has been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

function parsePodOrders(inputFilePath, outputFilePath) {
  try {
    const data = fs.readFileSync(inputFilePath, "utf8");
    const marketData = JSON.parse(data).orders;
    const result = [];

    for (const id in marketData) {
      if (marketData.hasOwnProperty(id)) {
        const order = marketData[id];
        result.push([
          order.account,
          id,
          convertToBigNum(order.orderBeans),
          order.pricePerPod.toString(),
          convertToBigNum(order.maxPlaceInLine),
          convertToBigNum(order.minFillAmount)
        ]);
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log("Pod Orders JSON has been written successfully");
  } catch (err) {
    console.error("Error:", err);
  }
}

function parsePodMarketplace(inputFilePath, outputFiilePathListings, outputFilePathOrders) {
  parsePodListings(inputFilePath, outputFiilePathListings);
  parsePodOrders(inputFilePath, outputFilePathOrders);
}

exports.parsePodMarketplace = parsePodMarketplace;
