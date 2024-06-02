import { SeasonalDepositedSiloAssetDocument, SeasonalInstantPriceDocument, SeasonalRRoRDocument } from "~/generated/graphql";
import useSdk from "~/hooks/sdk";
import { useMemo } from "react";
import { tickFormatBeanAmount, tickFormatBeanPrice, tickFormatPercentage, valueFormatBeanAmount } from "./formatters";

export function useChartSetupData() {

    const sdk = useSdk();
    const beanstalkAddress = sdk.addresses.BEANSTALK.MAINNET;
    const beanAddress = sdk.addresses.BEAN.MAINNET;

    return useMemo(() => {

        const output: any[] = [];
        let dataIndex = 0;

        const beanCharts = [
            {
                name: 'Bean Price',
                tooltipTitle: 'Current Bean Price',
                tooltipHoverText: 'The Current Price of Bean in USD',
                timeScaleKey: 'timestamp',
                priceScaleKey: 'price',
                document: SeasonalInstantPriceDocument,
                documentEntity: 'seasons',
                queryConfig: {
                    variables: { season_gte: 1 },
                    context: { subgraph: 'bean' },
                  },
                valueFormatter: (v: string) => Number(v),
                tickFormatter: tickFormatBeanPrice
            },
        ];
    
        const siloCharts = [
            {
                name: 'Deposited BEAN',
                tooltipTitle: 'Deposited BEANs',
                tooltipHoverText: 'The total number of deposited Beans',
                timeScaleKey: 'createdAt',
                priceScaleKey: 'depositedAmount',
                document: SeasonalDepositedSiloAssetDocument,
                documentEntity: 'seasons',
                queryConfig: {
                    variables: {
                        season_gt: 6073,
                        siloAsset: `${beanstalkAddress.toLowerCase()}-${beanAddress}`,
                    }
                },
                valueFormatter: valueFormatBeanAmount,
                tickFormatter: tickFormatBeanAmount,
            },
        ];
    
        const fieldCharts = [
            {
                name: 'Real Rate of Return',
                tooltipTitle: 'Real Rate of Return',
                tooltipHoverText: 'The return for sowing Beans, accounting for Bean price. RRoR = (1 + Temperature) / TWAP.',
                timeScaleKey: 'createdAt',
                priceScaleKey: 'realRateOfReturn',
                document: SeasonalRRoRDocument,
                documentEntity: 'seasons',
                queryConfig: undefined,
                valueFormatter: (v: string) => Number(v) * 100,
                tickFormatter: tickFormatPercentage
            },
        ];
    
       beanCharts.forEach((chartData) => {
           const chartDataToAdd = {
               ...chartData,
               type: 'Bean',
                index: dataIndex
           };
           output.push(chartDataToAdd)
            dataIndex += 1
        });
    
        siloCharts.forEach((chartData) => {
            const chartDataToAdd = {
                ...chartData,
                type: 'Silo',
                index: dataIndex
            };
            output.push(chartDataToAdd)
            dataIndex += 1
        });
    
        fieldCharts.forEach((chartData) => {
            const chartDataToAdd = {
                ...chartData,
                type: 'Field',
                index: dataIndex
            };
            output.push(chartDataToAdd)
            dataIndex += 1
        });

        return output;

    }, [beanAddress, beanstalkAddress]);
};