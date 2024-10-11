## DEPRECATED
Beanstalk is too complex of a system to meaningfully test with Invariant testing. There is not
a finite set of actions that a user could take, due to Pipeline and convert generalization. Convert
also adds intractable complexity, because it can have an arbitrary effect on user positions. Further,
the complexity and risk of beanstalk is primarily in specifically crafted attacks, rather than 
internal accounting failures, due to the upgradeable nature of the contracts. Due to these
factors it was decided to discontinue system-wide invariant testing. The infrastructure here
is kept for reference.

# Invariant Testing
These tests implement invariant based testing of the entire Beanstalk system.

Note that these are *not* necessarily tests designed for the invariants seen in 
Invariable.sol (although they are also exercised). Instead this is invariant
testing in its more generalized definition. A semi-random set of interactions 
with Beanstalk with test-only invariants that verify if the state is healthy.

### Invariant Ideas

- All plots are harvestable/transferable
- All deposits can be accessed
- All Fert can be transferred
- Sunrise can always be called after 1 hour
- Soil <= tw deltaB
...


### Actions

Silo
- Deposit
- Withdraw
- Convert
- Farm / Mow
- Deposit transfer

Field
- Sow + Harvest
- Pod transfer + market buy/sell

Barn
- Buy Fert + Rinse
- Fert transfer

Sun
- Sunrise / gm (+ SoP)

Not Applicable
- Pipeline/Depot
- Advanced Farm
- Tractor
- Diamond functions

### References
https://medium.com/cyfrin/invariant-testing-enter-the-matrix-c71363dea37e
