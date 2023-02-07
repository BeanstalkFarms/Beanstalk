import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { WellsSDK } from "./WellsSDK";
export declare const loadToken: (sdk: WellsSDK, address: string) => Promise<ERC20Token>;
export declare const validateToken: (token: Token, name: string) => void;
export declare const validateAmount: (value: TokenValue, name: string) => void;
export declare const validateAddress: (address: string, name: string) => void;
export declare const setReadOnly: (obj: any, prop: string, value: any, visible?: boolean) => void;
