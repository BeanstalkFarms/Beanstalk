import { BigNumber, ContractTransaction } from "ethers";
import { ERC20Permit } from "../../constants/generated";
import { PromiseOrValue } from "../../constants/generated/common";
import { Token } from "./Token";
import { TokenValue } from "../../lib/TokenValue";
export declare class ERC20Token extends Token {
    private contract;
    getContract(): ERC20Permit;
    getName(): Promise<string>;
    loadFromChain(): Promise<void>;
    getBalance(account: string): Promise<TokenValue>;
    getAllowance(account: string, spender: string): Promise<TokenValue>;
    hasEnoughAllowance(account: string, spender: string, amount: TokenValue | BigNumber): Promise<boolean>;
    getTotalSupply(): Promise<TokenValue>;
    approve(spenderContract: PromiseOrValue<string>, amount: TokenValue | BigNumber): Promise<ContractTransaction>;
}
