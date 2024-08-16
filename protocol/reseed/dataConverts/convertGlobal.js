const fs = require('fs');
const { BigNumber } = require('ethers');

function convertHexToString(hexValue) {
    return BigNumber.from(hexValue).toString();
}

function parseGlobals(inputFilePath, outputFilePath) {
    const data = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

    const result = [
        // SystemInternalBalances
        [
            Object.keys(data.internalTokenBalanceTotal || { "0x0000000000000000000000000000000000000000": "0" }),
            Object.values(data.internalTokenBalanceTotal || { "0x0000000000000000000000000000000000000000": "0" }).map(convertHexToString)
        ],
        // Fertilizer
        [
            Object.keys(data.fert?.fertilizer || {}).map(convertHexToString),
            Object.values(data.fert?.fertilizer || {}).map(convertHexToString),
            data.fert?.activeFertilizer ? convertHexToString(data.fert.activeFertilizer) : "0",
            data.fert?.fertilizedIndex ? convertHexToString(data.fert.fertilizedIndex) : "0",
            data.fert?.unfertilizedIndex ? convertHexToString(data.fert.unfertilizedIndex) : "0",
            data.fert?.fertilizedPaidIndex ? convertHexToString(data.fert.fertilizedPaidIndex) : "0",
            data.fert?.fertFirst ? convertHexToString(data.fert.fertFirst) : "0",
            data.fert?.fertLast ? convertHexToString(data.fert.fertLast) : "0",
            data.fert?.bpf ? convertHexToString(data.fert.bpf) : "0",
            data.fert?.recapitalized ? convertHexToString(data.fert.recapitalized) : "0",
            data.fert?.leftoverBeans ? convertHexToString(data.fert.leftoverBeans) : "0"
        ],
        // Silo
        [
            data.silo?.stalk ? convertHexToString(data.silo.stalk) : "0",
            data.silo?.roots ? convertHexToString(data.silo.roots) : "0",
            data.silo?.earnedBeans ? convertHexToString(data.silo.earnedBeans) : "0",
            data.silo?.orderLockedBeans ? convertHexToString(data.silo.orderLockedBeans) : "0",
            Object.keys(data.silo?.balances || { "0x0000000000000000000000000000000000000000": {} }),
            Object.values(data.silo?.balances || { "0x0000000000000000000000000000000000000000": { "deposited": "0", "depositedBdv": "0" } }).map(balance => [
                convertHexToString(balance.deposited),
                convertHexToString(balance.depositedBdv)
            ]),
            Object.entries(data.silo?.unripeSettings || { "0x0000000000000000000000000000000000000000": { "balanceOfUnderlying": "0" } }).map(([token, settings]) => [
                token,
                settings.balanceOfUnderlying ? convertHexToString(settings.balanceOfUnderlying) : "0"
            ]),
            Object.entries(data.silo?.germinating?.["0"] || {}).map(([_, { amount, bdv }]) => [
                convertHexToString(amount),
                convertHexToString(bdv)
            ]),
            Object.entries(data.silo?.germinating?.["1"] || {}).map(([_, { amount, bdv }]) => [
                convertHexToString(amount),
                convertHexToString(bdv)
            ]),
            data.silo?.unclaimedGerminating?.seasons || ["0"],
            Array.isArray(data.silo?.unclaimedGerminating) ? data.silo.unclaimedGerminating.map(germ => [
                convertHexToString(germ.stalk),
                convertHexToString(germ.roots)
            ]) : [["0", "0"]],
        ],
        // Field
        [
            data.fields?.["0"]?.pods ? convertHexToString(data.fields["0"].pods) : "0",
            data.fields?.["0"]?.harvested ? convertHexToString(data.fields["0"].harvested) : "0",
            data.fields?.["0"]?.harvestable ? convertHexToString(data.fields["0"].harvestable) : "0",
            Array(8).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // Season
        [
            data.season?.current ? convertHexToString(data.season.current) : "0",
            data.season?.lastSop ? convertHexToString(data.season.lastSop) : "0",
            data.season?.withdrawSeasons ? convertHexToString(data.season.withdrawSeasons) : "0",
            data.season?.lastSopSeason ? convertHexToString(data.season.lastSopSeason) : "0",
            data.season?.rainStart ? convertHexToString(data.season.rainStart) : "0",
            !!data.season?.raining,
            !!data.season?.fertilizing,
            data.season?.sunriseBlock ? convertHexToString(data.season.sunriseBlock) : "0",
            !!data.season?.abovePeg,
            data.season?.stemStartSeason ? convertHexToString(data.season.stemStartSeason) : "0",
            data.season?.stemScaleSeason ? convertHexToString(data.season.stemScaleSeason) : "0",
            data.season?.start ? convertHexToString(data.season.start) : "0",
            data.season?.period ? convertHexToString(data.season.period) : "3600",
            data.season?.timestamp ? convertHexToString(data.season.timestamp) : "0",
            Array(8).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // Weather
        [
            data.weather?.lastDeltaSoil ? convertHexToString(data.weather.lastDeltaSoil) : "0",
            data.weather?.lastSowTime ? convertHexToString(data.weather.lastSowTime) : "0",
            data.weather?.thisSowTime ? convertHexToString(data.weather.thisSowTime) : "0",
            data.weather?.temp ? convertHexToString(data.weather.temp) : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // SeedGauge
        [
            data.seedGauge?.averageGrownStalkPerBdvPerSeason ? convertHexToString(data.seedGauge.averageGrownStalkPerBdvPerSeason) : "0",
            data.seedGauge?.beanToMaxLpGpPerBdvRatio ? convertHexToString(data.seedGauge.beanToMaxLpGpPerBdvRatio) : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // Rain
        [
            data.rain?.pods ? convertHexToString(data.rain.pods) : "0",
            data.rain?.roots ? convertHexToString(data.rain.roots) : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // EvaluationParameters
        [
            data.evaluationParameters?.maxBeanMaxLpGpPerBdvRatio ? convertHexToString(data.evaluationParameters.maxBeanMaxLpGpPerBdvRatio) : "0",
            data.evaluationParameters?.minBeanMaxLpGpPerBdvRatio ? convertHexToString(data.evaluationParameters.minBeanMaxLpGpPerBdvRatio) : "0",
            data.evaluationParameters?.targetSeasonsToCatchUp ? convertHexToString(data.evaluationParameters.targetSeasonsToCatchUp) : "0",
            data.evaluationParameters?.podRateLowerBound ? convertHexToString(data.evaluationParameters.podRateLowerBound) : "0",
            data.evaluationParameters?.podRateOptimal ? convertHexToString(data.evaluationParameters.podRateOptimal) : "0",
            data.evaluationParameters?.podRateUpperBound ? convertHexToString(data.evaluationParameters.podRateUpperBound) : "0",
            data.evaluationParameters?.deltaPodDemandLowerBound ? convertHexToString(data.evaluationParameters.deltaPodDemandLowerBound) : "0",
            data.evaluationParameters?.deltaPodDemandUpperBound ? convertHexToString(data.evaluationParameters.deltaPodDemandUpperBound) : "0",
            data.evaluationParameters?.lpToSupplyRatioUpperBound ? convertHexToString(data.evaluationParameters.lpToSupplyRatioUpperBound) : "0",
            data.evaluationParameters?.lpToSupplyRatioOptimal ? convertHexToString(data.evaluationParameters.lpToSupplyRatioOptimal) : "0",
            data.evaluationParameters?.lpToSupplyRatioLowerBound ? convertHexToString(data.evaluationParameters.lpToSupplyRatioLowerBound) : "0",
            data.evaluationParameters?.excessivePriceThreshold ? convertHexToString(data.evaluationParameters.excessivePriceThreshold) : "0"
        ],
        // Migration
        [
            data.migration?.migratedL1Beans ? convertHexToString(data.migration.migratedL1Beans) : "0",
            Array(4).fill("0x0000000000000000000000000000000000000000000000000000000000000000")
        ],
        // ShipmentRoute
        data.shipmentRoutes.length ? data.shipmentRoutes.map(route => [
            route.planContract || "0x0000000000000000000000000000000000000000",
            route.planSelector || "0x00000000",
            route.recipient ? convertHexToString(route.recipient) : "0",
            route.data || "0x"
        ]) : [["0x0000000000000000000000000000000000000000", "0x00000000", "0", "0x"]]
    ];

    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
    console.log('JSON has been written successfully');
}

exports.parseGlobals = parseGlobals;
