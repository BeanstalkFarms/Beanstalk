import { createAction } from '@reduxjs/toolkit';
import { Unripe } from '.';

export const resetUnripe = createAction('bean/unripe/reset');

export const updateUnripe = createAction<Unripe>('bean/unripe/update');
