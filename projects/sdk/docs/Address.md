## Address

A utility class to handle blochain addresses, with multi-chain support.

Addresses should be created using the static factory method `Address.make()`

```javascript
// Create an Address object that uses the same address on all supported chains
const address = Address.make("0x123...");

// Create an Address object with different addresses per supported chains
const addres2 = Address.make({
  [ChainId.MAINNET]: "0x123...", // Using available chains
  1234: "0x999..." // Using custom chain
});

// Get address string
// address.get(number?) => string
address.get();
address.get(1);
address.get(ChainId.MAINNET);

// Update an address
address.set(string | AddressDefinition);
```

#### `AddressDefinition`

```typescript
type AddressDefinition = {
  [id: number]: string;
};
```

### Address resolution logic

When `.get()`ing an address, the following logic applies to which address to return:

- if no chainId is specified, default to Mainnet (1)
- if a chainId is specified that isn't supported, throw error
- if the chainId is a test-net and there's no specific address defined for that chainId, return the Mainnet version instead.
- otherwise return the address for the specified chainId

[Back](README.md)
