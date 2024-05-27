import { Alchemy } from "alchemy-sdk";

export const alchemy = new Alchemy(import.meta.env.VITE_ALCHEMY_API_KEY);
