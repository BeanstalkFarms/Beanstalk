import { Token } from "./Token";
import { TokenValue } from "../TokenValue";
export declare class NativeToken extends Token {
    getContract(): null;
    getBalance(account: string): Promise<TokenValue>;
    getAllowance(): Promise<TokenValue | undefined>;
    hasEnoughAllowance(): boolean;
    getTotalSupply(): undefined;
    equals(other: NativeToken): boolean;
}
