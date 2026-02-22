export class Money {
  readonly amountMinor: number;
  readonly currencyCode: string;

  constructor(amountMinor: number, currencyCode: string) {
    if (!Number.isInteger(amountMinor)) {
      throw new Error("Money amount must be integer minor units.");
    }
    if (!currencyCode || currencyCode.length !== 3) {
      throw new Error("Money currency code must be a 3-letter ISO code.");
    }
    this.amountMinor = amountMinor;
    this.currencyCode = currencyCode.toUpperCase();
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currencyCode);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currencyCode);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currencyCode !== other.currencyCode) {
      throw new Error("Cannot operate on different currencies.");
    }
  }
}
