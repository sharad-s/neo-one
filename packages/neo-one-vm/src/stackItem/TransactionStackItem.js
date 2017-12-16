/* @flow */
import type { Transaction } from '@neo-one/core';

import ObjectStackItem from './ObjectStackItem';

export default class TransactionStackItem extends ObjectStackItem<Transaction> {
  asTransaction(): Transaction {
    return this.value;
  }
}
