# SiloFacet

## Inheritance

```
SiloFacet - Facet 
  is TokenSilo - Contract module that handles depositing/withdrawing/transferring deposits in and out of silo.   
    is Silo - Contract module that handles updating the state of the farmer silo deposits (update/plant)
      is SiloExit - Contract module that handles various view functions from the silo (i.e stalk, seeds, earned beans, etc)
        is ReentrancyGuard - OpenZeppelin Contract module that helps prevent reentrant calls to a function.
```
