import { ethers } from "ethers";
import { IPump__factory, IWellFunction__factory, Well__factory } from "generated";

export const getWell = (address: string, provider: ethers.providers.Provider) => Well__factory.connect(address, provider);

export const getPump = (address: string, provider: ethers.providers.Provider) => IPump__factory.connect(address, provider);

export const getWellFunction = (address: string, provider: ethers.providers.Provider) => IWellFunction__factory.connect(address, provider);