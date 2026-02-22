import type { CountryAdapter } from "@curra/domain-core";
import { UgandaAdapter } from "@curra/country-adapter-ug";

export class CountryAdapterRegistry {
  private readonly adapters: Map<string, CountryAdapter>;

  constructor() {
    this.adapters = new Map<string, CountryAdapter>([["UG", new UgandaAdapter()]]);
  }

  resolve(countryCode: string): CountryAdapter {
    const adapter = this.adapters.get(countryCode.toUpperCase());
    if (!adapter) {
      throw new Error(`No adapter registered for country code '${countryCode}'.`);
    }
    return adapter;
  }
}
