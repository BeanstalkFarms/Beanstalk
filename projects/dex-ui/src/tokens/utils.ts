export type HasSymbolAndAddress = { address: string; symbol: string };
export type HasTokenIshNames = { name: string; displayName: string };

const ETH_INDEX = "ETH";

export const getIsETH = (token: HasSymbolAndAddress) => {
    return token.symbol === "ETH" || token.symbol === 'eth';
};

export const getTokenIndex = (token: HasSymbolAndAddress) => {
    if (getIsETH(token)) return ETH_INDEX;
    return token.address;
}

export const displayTokenName = (token: HasTokenIshNames) => {
    if (token.displayName === "UNKNOWN") {
        return token.name;
    } 
    return token.displayName;
}
