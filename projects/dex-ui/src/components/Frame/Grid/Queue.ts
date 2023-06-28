export class Queue<T> {
  maxLength: number = 5;
  items: T[] = [];
  constructor(size: number) {
    this.maxLength = size;
  }

  push(item: T) {
    if (this.items.length < this.maxLength) {
      this.items.push(item);
    } else {
      this.items = this.items.splice(1);
      this.items.push(item);
    }
  }

  last() {
    return this.items[this.items.length - 1];
  }

  pop(): T {
    const result = this.items.splice(1);
    const item = this.items[0];
    this.items = result;

    return item;
  }

  get length(): number {
    return this.items.length;
  }
}
