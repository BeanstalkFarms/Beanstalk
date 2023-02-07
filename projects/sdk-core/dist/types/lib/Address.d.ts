export declare type AddressDefinition = {
    [id: number]: string;
};
export declare class Address {
    private addresses;
    MAINNET: string;
    LOCALHOST: string;
    static make<T extends string | AddressDefinition>(input: T): Address;
    constructor(addresses: AddressDefinition);
    get(chainId?: number): string;
    set<T extends string | AddressDefinition>(input: T): void;
}
