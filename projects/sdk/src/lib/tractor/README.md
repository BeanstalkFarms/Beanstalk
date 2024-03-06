# Tractor SDK

Helpers for both publishers and operators using Tractor functionality.

## Terms

- **Tractor** - Tractor is a system that enables operators to perform arbitrary sequences of actions on behalf of a publisher.
- **Publisher** - The address that signs a Blueprint requesting actions to be performed on its behalf. Effectively msg.sender during Tractor operation.
- **Operator** - The address that executes the transaction performing the sequence of actions encoded in a Blueprint.
- **Blueprint** - A set of instructions containing metadata and a sequence of actions for the operator to perform on behalf of the publisher.
- **Requisition** - Contains a Blueprint, the blueprint hash, and the ERC-721/EIP-1271 signature of the publisher.
- **OperatorPasteInstrs** - A sequence of copy + paste runtime actions that will be performed on the calldata supplied by the operator. Note that the composition of these instructions is **not** the same as the composition of Clipboard PasteParams.
- **MaxNonce** - The maximum number of times the blueprint can be operated.

- **Pipeline** - Independent system for performing arbitrary sequence of actions in a single transactions. See https://evmpipeline.org/pipeline.pdf.
- **Clipboard** - A component of _Pipeline_ for using return data as calldata in subsequent actions in a sequence of actions performed in the same transaction.

## Use flow

1. Publisher signs a Requisition containing a blueprint with a sequence of requested actions encoded in the data. Signing a transaction requires no gas, unless the Publisher wants to publish the Blueprint through on-chain events.
2. Potential Operator(s) acquire the Blueprint. Either through event monitoring, P2P sharing, or a database.
3. Operator executes the Blueprint on-chain in a single transaction, possibly including their own encoded calldata.
