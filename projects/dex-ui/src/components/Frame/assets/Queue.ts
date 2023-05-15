export class Queue {
  maxLenth: number = 5;
  items: any[] = [];
  constructor(size: number) {
    this.maxLenth = size;
  }

  push(item: any) {
    if (this.items.length < this.maxLenth) {
      this.items.push(item);
    } else {
      this.items = this.items.splice(1);
      this.items.push(item);
    }
  }

  last() {
    return this.items[this.items.length - 1];
  }

  pop(): any {
    const result = this.items.splice(1);
    const item = this.items[0];
    this.items = result;

    return item;
  }
}
