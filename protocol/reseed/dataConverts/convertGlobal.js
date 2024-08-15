const fs = require('fs');

function parseStorageSystem(inputFilePath, outputFilePath) {
    const data = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

    const result = [
        // SystemInternalBalances (done)
        [
            Object.keys(data.internalTokenBalanceTotal || {"0x0000000000000000000000000000000000000000": "0"}),
            Object.values(data.internalTokenBalanceTotal || {"0x0000000000000000000000000000000000000000": "0"}).map(value => parseInt(value, 16).toString())
        ],
        // Fertilizer (done)
        [
            Object.keys(data.fert.fertilizer),
            Object.values(data.fert.fertilizer).map(value => parseInt(value, 16).toString()),
            data.fert?.activeFertilizer ? parseInt(data.fert.activeFertilizer, 16).toString() : "0",
            data.fert?.fertilizedIndex ? parseInt(data.fert.fertilizedIndex, 16).toString() : "0",
            data.fert?.unfertilizedIndex ? parseInt(data.fert.unfertilizedIndex, 16).toString() : "0",
            data.fert?.fertilizedPaidIndex ? parseInt(data.fert.fertilizedPaidIndex, 16).toString() : "0",
            data.fert?.fertFirst ? parseInt(data.fert.fertFirst, 16).toString() : "0",
            data.fert?.fertLast ? parseInt(data.fert.fertLast, 16).toString() : "0",
            data.fert?.bpf ? parseInt(data.fert.bpf, 16).toString() : "0",
            data.fert?.recapitalized ? parseInt(data.fert.recapitalized, 16).toString() : "0",
            data.fert?.leftoverBeans ? parseInt(data.fert.leftoverBeans, 16).toString() : "0"
        ],
        // Silo
        [
            data.silo?.stalk ? parseInt(data.silo.stalk, 16).toString() : "0",
            data.silo?.roots ? parseInt(data.silo.roots, 16).toString() : "0",
            data.silo?.earnedBeans ? parseInt(data.silo.earnedBeans, 16).toString() : "0",
            data.silo?.orderLockedBeans ? parseInt(data.silo.orderLockedBeans, 16).toString() : "0",
            Object.keys(data.silo?.balances || {"0x0000000000000000000000000000000000000000": {}}),
            // asset silo
            Object.values(data.silo?.balances || {"0x0000000000000000000000000000000000000000": {"deposited": "0", "depositedBdv": "0"}}).map(balance => [
                parseInt(balance.deposited, 16).toString(),
                parseInt(balance.depositedBdv, 16).toString()
            ]),
            // unripe settings
            Object.entries(data.silo?.unripeSettings || {"0x0000000000000000000000000000000000000000": {"balanceOfUnderlying": "0"}}).map(([token, settings]) => [
                token,
                settings.balanceOfUnderlying ? parseInt(settings.balanceOfUnderlying, 16).toString() : "0"
            ]),
            // germinating even
            Object.entries(data.silo?.germinating["0"]).map(([tokenAddress, { amount, bdv }]) => [
                // tokenAddress, does not need token address
                parseInt(amount, 16).toString(),
                parseInt(bdv, 16).toString()
            ]),
            // germinating odd
            Object.entries(data.silo?.germinating["1"]).map(([tokenAddress, { amount, bdv }]) => [
                // tokenAddress, does not need token address
                parseInt(amount, 16).toString(),
                parseInt(bdv, 16).toString()
            ]),
            data.silo?.unclaimedGerminating.seasons || ["0"],
            Array.isArray(data.silo?.unclaimedGerminating) ? data.silo.unclaimedGerminating.map(germ => [
                parseInt(germ.stalk, 16).toString(),
                parseInt(germ.roots, 16).toString()
            ]) : [["0", "0"]],
        ],
        // Field
        [
            data.fields?.["0"]?.pods ? parseInt(data.fields["0"].pods, 16).toString() : "0",
            data.fields?.["0"]?.harvested ? parseInt(data.fields["0"].harvested, 16).toString() : "0",
            data.fields?.["0"]?.harvestable ? parseInt(data.fields["0"].harvestable, 16).toString() : "0",
            Array(8).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // Season
        [
            data.season?.current ? parseInt(data.season.current, 16).toString() : "0",
            data.season?.lastSop ? parseInt(data.season.lastSop, 16).toString() : "0",
            data.season?.withdrawSeasons ? parseInt(data.season.withdrawSeasons, 16).toString() : "0",
            data.season?.lastSopSeason ? parseInt(data.season.lastSopSeason, 16).toString() : "0",
            data.season?.rainStart ? parseInt(data.season.rainStart, 16).toString() : "0",
            !!data.season?.raining,
            !!data.season?.fertilizing,
            data.season?.sunriseBlock ? parseInt(data.season.sunriseBlock, 16).toString() : "0",
            !!data.season?.abovePeg,
            data.season?.stemStartSeason ? parseInt(data.season.stemStartSeason, 16).toString() : "0",
            data.season?.stemScaleSeason ? parseInt(data.season.stemScaleSeason, 16).toString() : "0",
            data.season?.start ? parseInt(data.season.start, 16).toString() : "0",
            data.season?.period ? parseInt(data.season.period, 16).toString() : "3600",
            data.season?.timestamp ? parseInt(data.season.timestamp, 16).toString() : "0",
            Array(8).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // Weather
        [
            data.weather?.lastDeltaSoil ? parseInt(data.weather.lastDeltaSoil, 16).toString() : "0",
            data.weather?.lastSowTime ? parseInt(data.weather.lastSowTime, 16).toString() : "0",
            data.weather?.thisSowTime ? parseInt(data.weather.thisSowTime, 16).toString() : "0",
            data.weather?.temp ? parseInt(data.weather.temp, 16).toString() : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // SeedGauge
        [
            data.seedGauge?.averageGrownStalkPerBdvPerSeason ? parseInt(data.seedGauge.averageGrownStalkPerBdvPerSeason, 16).toString() : "0",
            data.seedGauge?.beanToMaxLpGpPerBdvRatio ? parseInt(data.seedGauge.beanToMaxLpGpPerBdvRatio, 16).toString() : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // Rain (missing from json)
        [
            data.rain?.pods ? parseInt(data.rain.pods, 16).toString() : "0",
            data.rain?.roots ? parseInt(data.rain.roots, 16).toString() : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // EvaluationParameters (missing from json)
        [
            data.evaluationParameters?.maxBeanMaxLpGpPerBdvRatio ? parseInt(data.evaluationParameters.maxBeanMaxLpGpPerBdvRatio, 16).toString() : "0",
            data.evaluationParameters?.minBeanMaxLpGpPerBdvRatio ? parseInt(data.evaluationParameters.minBeanMaxLpGpPerBdvRatio, 16).toString() : "0",
            data.evaluationParameters?.targetSeasonsToCatchUp ? parseInt(data.evaluationParameters.targetSeasonsToCatchUp, 16).toString() : "0",
            data.evaluationParameters?.podRateLowerBound ? parseInt(data.evaluationParameters.podRateLowerBound, 16).toString() : "0",
            data.evaluationParameters?.podRateOptimal ? parseInt(data.evaluationParameters.podRateOptimal, 16).toString() : "0",
            data.evaluationParameters?.podRateUpperBound ? parseInt(data.evaluationParameters.podRateUpperBound, 16).toString() : "0",
            data.evaluationParameters?.deltaPodDemandLowerBound ? parseInt(data.evaluationParameters.deltaPodDemandLowerBound, 16).toString() : "0",
            data.evaluationParameters?.deltaPodDemandUpperBound ? parseInt(data.evaluationParameters.deltaPodDemandUpperBound, 16).toString() : "0",
            data.evaluationParameters?.lpToSupplyRatioUpperBound ? parseInt(data.evaluationParameters.lpToSupplyRatioUpperBound, 16).toString() : "0",
            data.evaluationParameters?.lpToSupplyRatioOptimal ? parseInt(data.evaluationParameters.lpToSupplyRatioOptimal, 16).toString() : "0",
            data.evaluationParameters?.lpToSupplyRatioLowerBound ? parseInt(data.evaluationParameters.lpToSupplyRatioLowerBound, 16).toString() : "0",
            data.evaluationParameters?.excessivePriceThreshold ? parseInt(data.evaluationParameters.excessivePriceThreshold, 16).toString() : "0"
        ],
        // Migration
        [
            data.migration?.migratedL1Beans ? parseInt(data.migration.migratedL1Beans, 16).toString() : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // ShipmentRoute
        data.shipmentRoutes.length ? data.shipmentRoutes.map(route => [
            route.planContract || "0x0000000000000000000000000000000000000000",
            route.planSelector || "0x00000000",
            route.recipient ? parseInt(route.recipient, 16).toString() : "0",
            route.data || "0x"
        ]) : [["0x0000000000000000000000000000000000000000", "0x00000000", "0", "0x"]]
    ];

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log('JSON has been written successfully');
}

// Example usage
const inputFilePath = './reseed/data/exports/storage-system20330000.json';
const outputFilePath = './reseed/data/actual-global.json';
parseStorageSystem(inputFilePath, outputFilePath);

module.exports = parseStorageSystem;
