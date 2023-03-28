import React from 'react';

export type FC<T extends any> = React.FC<React.PropsWithChildren<T>>;
