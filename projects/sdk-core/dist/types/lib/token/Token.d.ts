import { BigNumber, BaseContract, ContractTransaction, ethers, providers, Signer } from "ethers";
import { TokenValue } from "../TokenValue";
import { PromiseOrValue } from "../../constants/generated/common";
declare type TokenMetadata = {
    name?: string;
    displayName?: string;
    logo?: string;
    color?: string;
    displayDecimals?: number;
    isLP?: boolean;
};
export declare abstract class Token {
    /** Provider for chain interactions */
    private providerOrSigner?;
    /** The chain id of the chain this token lives on */
    chainId: number;
    /** The contract address on the chain on which this token lives */
    address: string;
    /** The decimals used in representing currency amounts */
    decimals: number;
    /** The name of the currency, i.e. a descriptive textual non-unique identifier */
    name: string;
    /** The display name of the currency, i.e. a descriptive textual non-unique identifier */
    displayName: string;
    /** The symbol of the currency, i.e. a short textual non-unique identifier */
    symbol: string;
    /** The square logo of the token. */
    logo?: string;
    /** The color to use when displaying the token in charts, etc. */
    color?: string;
    /** The number of decimals this token is recommended to be truncated to. */
    displayDecimals: number;
    /** Whether or not this is a LP token representing a position in a Pool. */
    isLP: boolean;
    constructor(chainId: number, address: string | null, decimals?: number, symbol?: string, metadata?: TokenMetadata, signerOrProvider?: providers.Provider | Signer);
    abstract getContract(): BaseContract | null;
    abstract getBalance(account: string): Promise<TokenValue>;
    abstract getAllowance(account: string, spender: string): Promise<TokenValue | undefined>;
    abstract hasEnoughAllowance(account: string, spender: string, amount: TokenValue | ethers.BigNumber): boolean | Promise<boolean>;
    abstract getTotalSupply(): Promise<TokenValue> | undefined;
    setSignerOrProvider(provider: providers.Provider | Signer): void;
    getSignerOrProvider(): providers.Provider | Signer;
    /**
     * Returns whether this currency is functionally equivalent to the other currency
     * @param other the other currency
     */
    equals(other: Token): boolean;
    toString(): string;
    setMetadata(metadata: {
        logo?: string;
        color?: string;
    }): void;
    /**
     * Converts from a blockchain amount to a TokenValue with this token's decimals set
     *
     * Ex: BEAN.fromBlockchain("3140000") => TokenValue holding value "3140000" and 6 decimals
     *
     * @param amount A string value in blockchain format
     * @returns TokenValue
     */
    fromBlockchain(amount: string | number | BigNumber): TokenValue;
    /**
     * Converts from a human amount to a TokenAmount with this token's decimals set
     *
     * Ex: BEAN.fromHuman("3.14") => TokenValue holding value "3140000" and 6 decimals
     *
     * @param amount human readable amout, ex: "3.14" ether
     * @returns TokenValue
     */
    fromHuman(amount: string | number): TokenValue;
    /**
     * Alias to `.fromHuman()`
     *
     * Converts from a human amount to a TokenAmount with this token's decimals set
     *
     * Ex: BEAN.fromHuman("3.14") => TokenValue holding value "3140000" and 6 decimals
     *
     * @param amount human readable amout, ex: "3.14" ether
     * @returns TokenValue
     */
    amount(amount: string | number): TokenValue;
    /**
     * Converts from a blockchain value to a human readable form
     *
     * Ex: BEAN.toHuman(BigNumber.from('3140000)) => "3.14"
     * @param value A BigNumber with a value of this token, for ex: 1000000 would be 1 BEAN
     * @returns string
     */
    toHuman(value: BigNumber): string;
    toTokenValue(value: BigNumber): TokenValue;
    approve(spenderContract: PromiseOrValue<string>, amount: TokenValue | BigNumber): Promise<ContractTransaction>;
}
export {};
