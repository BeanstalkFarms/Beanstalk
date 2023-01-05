import { combineReducers } from '@reduxjs/toolkit';

import barn from './barn/reducer';
import field from './field/reducer';
import governance from './governance/reducer';
import silo from './silo/reducer';
import sun from './sun/reducer';
import tokenPrices from './tokenPrices/reducer';

export default combineReducers({
  barn,
  field,
  governance,
  silo,
  sun,
  tokenPrices,
});
