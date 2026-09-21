import { NativeEventEmitter, NativeModules } from 'react-native';

export enum ProductId {
  Monthly = 'recall_premium_monthly',
  Yearly = 'recall_premium_yearly',
}

export enum BillingPeriod {
  Month = 'month',
  Year = 'year',
}

export enum StoreState {
  Idle = 'idle',
  Loading = 'loading',
  Ready = 'ready',
  Unavailable = 'unavailable',
}

export enum PurchaseStatus {
  Purchased = 'purchased',
  Cancelled = 'cancelled',
  Pending = 'pending',
}

export interface StoreProduct {
  id: ProductId;
  title: string;
  description: string;
  displayPrice: string;
  period: BillingPeriod;
  trialDays: number | null;
  eligibleForTrial: boolean;
}

export interface Entitlement {
  active: boolean;
  productId: ProductId | null;
  expiresAt: number | null;
  inTrial: boolean;
  willRenew: boolean;
}

// Contract implemented by native/RecallStore (StoreKit 2, iOS + macOS) and
// android/.../billing/RecallStoreModule.kt (Google Play Billing).
interface NativeRecallStore {
  getProducts(ids: string[]): Promise<StoreProduct[]>;
  purchase(productId: string): Promise<{ status: PurchaseStatus }>;
  getEntitlement(): Promise<Entitlement>;
  restore(): Promise<Entitlement>;
  manageSubscriptions(): Promise<void>;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

export const ENTITLEMENT_CHANGED = 'entitlementChanged';

const native: NativeRecallStore | undefined = NativeModules.RecallStore;
const emitter = native ? new NativeEventEmitter(native as never) : null;

export const NO_ENTITLEMENT: Entitlement = { active: false, productId: null, expiresAt: null, inTrial: false, willRenew: false };

export const purchases = {
  available: !!native,

  async products(): Promise<StoreProduct[]> {
    if (!native) {
      return [];
    }
    const found = await native.getProducts(Object.values(ProductId));
    return Object.values(ProductId)
      .map(id => found.find(p => p.id === id))
      .filter((p): p is StoreProduct => !!p);
  },

  async purchase(productId: ProductId): Promise<PurchaseStatus> {
    if (!native) {
      return PurchaseStatus.Cancelled;
    }
    const { status } = await native.purchase(productId);
    return status;
  },

  async entitlement(): Promise<Entitlement> {
    return native ? native.getEntitlement() : NO_ENTITLEMENT;
  },

  async restore(): Promise<Entitlement> {
    return native ? native.restore() : NO_ENTITLEMENT;
  },

  async manage(): Promise<void> {
    await native?.manageSubscriptions();
  },

  onChange(handler: (entitlement: Entitlement) => void): () => void {
    if (!emitter) {
      return () => {};
    }
    const sub = emitter.addListener(ENTITLEMENT_CHANGED, handler);
    return () => sub.remove();
  },
};
