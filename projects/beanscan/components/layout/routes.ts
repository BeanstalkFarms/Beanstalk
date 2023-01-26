import { ReactNode } from "react";

export interface IRoute {
  name: string;
  path: string;
  external: boolean;
}

export interface IRoutes {
  [key: string]: {
    segment: string;
    nested: IRoute[];
    icon?: ReactNode;
  }
}

export const ROUTES : IRoutes = {
  Silo: {
    segment: 'silo',
    nested: [
      { name: 'Overview', path: '/silo', external: false },
    ],
    icon: undefined
  },
  Wells: {
    segment: 'wells',
    nested: [
      { name: 'All Wells', path: '/wells', external: false },
      { name: 'Inspector', path: '/wells/inspect', external: false },
    ],
  },
  Infra: {
    segment: 'infra',
    nested: [
      { name: 'State', path: '/infra/state', external: false },
      { name: 'Subgraphs', path: '/infra/subgraphs', external: false },
      { name: 'Events', path: '/infra/events', external: false },
    ]
  }
}