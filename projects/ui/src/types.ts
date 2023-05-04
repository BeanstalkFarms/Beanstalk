import React from 'react';

export type FC<T extends any> = React.FC<React.PropsWithChildren<T>>;

export type MayPromise<V> = V | Promise<V>;

export type MayArray<V> = V | V[];
