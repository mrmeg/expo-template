/**
 * Compile-time contract: the locally declared SDK shapes (`sdkTypes.ts`) stay
 * assignable from the real `react-native-purchases` / `react-native-purchases-ui`
 * types, which are devDependencies here so `tsc` on this package checks it.
 * The runtime assertions only keep Jest from reporting an empty file.
 */
import type Purchases from "react-native-purchases";
import type { CustomerInfo, PurchasesOffering, PurchasesOfferings } from "react-native-purchases";
import type RevenueCatUI from "react-native-purchases-ui";

import type { PaywallUi, PurchasesSdk, RcCustomerInfo, RcOffering, RcOfferings } from "../sdkTypes";

type Assignable<From, To> = From extends To ? true : never;

const sdkAssignable: Assignable<typeof Purchases, PurchasesSdk> = true;
const uiAssignable: Assignable<typeof RevenueCatUI, PaywallUi> = true;
const customerInfoAssignable: Assignable<CustomerInfo, RcCustomerInfo> = true;
const offeringAssignable: Assignable<PurchasesOffering, RcOffering> = true;
const offeringsAssignable: Assignable<PurchasesOfferings, RcOfferings> = true;

describe("sdkTypes", () => {
  it("mirrors the real SDK types (checked by tsc; see the type assertions above)", () => {
    expect([sdkAssignable, uiAssignable, customerInfoAssignable, offeringAssignable, offeringsAssignable]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
