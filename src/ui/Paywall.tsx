import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FREE_REMINDER_LIMIT, PREMIUM_FEATURES, TRIAL_DAYS } from '../lib/premium';
import { BillingPeriod, ProductId, StoreState, type StoreProduct } from '../lib/purchases';
import { links } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Button } from './common';
import { Overlay } from './Overlay';
import { isDesktop, useTheme } from './theme';

const PERIOD_LABEL: Record<BillingPeriod, string> = {
  [BillingPeriod.Month]: 'month',
  [BillingPeriod.Year]: 'year',
};

const STORE_NAME = Platform.OS === 'android' ? 'Google Play' : 'Apple ID';
const CAN_PURCHASE = Platform.OS !== 'web';

export function Paywall() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const feature = useStore(s => s.paywall);
  const products = useStore(s => s.products);
  const storeState = useStore(s => s.storeState);
  const loadStore = useStore(s => s.loadStore);
  const purchasing = useStore(s => s.purchasing);
  const closePaywall = useStore(s => s.closePaywall);
  const buy = useStore(s => s.buy);
  const restorePurchases = useStore(s => s.restorePurchases);
  const [selected, setSelected] = useState<ProductId>(ProductId.Yearly);

  useEffect(() => {
    if (feature) {
      Keyboard.dismiss();
    }
  }, [feature]);

  useEffect(() => {
    if (feature && products.length && !products.some(p => p.id === selected)) {
      setSelected(products[0].id);
    }
  }, [feature, products, selected]);

  const product = products.find(p => p.id === selected);
  const trial = product?.eligibleForTrial && product.trialDays ? product.trialDays : null;
  const reason = PREMIUM_FEATURES.find(f => f.feature === feature);

  return (
    <Overlay visible={feature !== null} transparent={false} onRequestClose={closePaywall}>
      <View style={[styles.wrap, { backgroundColor: t.bg, paddingTop: isDesktop ? 16 : insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.header, { paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]}>
          <Pressable testID="paywall-close" accessibilityRole="button" accessibilityLabel="Close" onPress={closePaywall} hitSlop={8} style={styles.close}>
            <Text style={[styles.closeText, { color: t.textSecondary }]}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}>
          <View style={[styles.badge, { backgroundColor: t.accentFill }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text style={[styles.badgeGlyph, { color: t.onAccent }]}>★</Text>
          </View>
          <Text style={[styles.title, { color: t.text }]} accessibilityRole="header">
            Recall Premium
          </Text>
          {reason ? (
            <Text testID="paywall-reason" style={[styles.reason, { color: t.textSecondary }]}>
              {reason.title} is a Premium feature.
            </Text>
          ) : null}

          <View style={[styles.features, { backgroundColor: t.pane, borderColor: t.border }]}>
            {PREMIUM_FEATURES.map(f => (
              <View key={f.feature} style={styles.feature}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={styles.flex}>
                  <Text style={[styles.featureTitle, { color: t.text, fontWeight: f.feature === feature ? '800' : '600' }]}>{f.title}</Text>
                  <Text style={[styles.featureDetail, { color: t.muted }]}>{f.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {!CAN_PURCHASE ? (
            <View style={styles.loading}>
              <Text testID="paywall-web" style={[styles.featureDetail, styles.center, { color: t.textSecondary }]}>
                Start your free trial in the Recall app for iPhone, Mac or Android. Premium then works here too, on the same account.
              </Text>
              <LinkButton label="I’ve subscribed, check again" onPress={() => loadStore()} />
            </View>
          ) : products.length === 0 ? (
            <View style={styles.loading}>
              {storeState === StoreState.Unavailable ? (
                <>
                  <Text testID="paywall-unavailable" style={[styles.featureDetail, { color: t.muted }]}>
                    Plans couldn’t be loaded. Check your connection and that you’re signed in to {STORE_NAME}.
                  </Text>
                  <LinkButton label="Try Again" onPress={() => loadStore()} />
                </>
              ) : (
                <>
                  <ActivityIndicator />
                  <Text style={[styles.featureDetail, { color: t.muted }]}>Loading plans…</Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.plans} accessibilityRole="radiogroup">
              {products.map(p => (
                <Plan key={p.id} product={p} selected={p.id === selected} onPress={() => setSelected(p.id)} />
              ))}
            </View>
          )}

          {CAN_PURCHASE ? (
            <Button
              testID="paywall-subscribe"
              title={purchasing ? 'Please wait…' : trial ? `Start ${trial}-day free trial` : 'Subscribe'}
              disabled={!product || !!purchasing}
              onPress={() => product && buy(product.id)}
              style={styles.cta}
            />
          ) : null}
          {CAN_PURCHASE ? (
            <Text style={[styles.terms, { color: t.muted }]}>
              {product
                ? `${trial ? `Free for ${trial} days, then ` : ''}${product.displayPrice} per ${PERIOD_LABEL[product.period]}. `
                : `Includes a ${TRIAL_DAYS}-day free trial for new subscribers. `}
              Payment is charged to your {STORE_NAME} account{trial ? ' when the trial ends' : ' at confirmation of purchase'}. The subscription renews automatically unless you cancel at least 24
              hours before the end of the current period. Manage or cancel any time in your {STORE_NAME} subscription settings. Free plan: unlimited notes and {FREE_REMINDER_LIMIT} active reminders.
            </Text>
          ) : null}

          <View style={styles.links}>
            {CAN_PURCHASE ? <LinkButton testID="paywall-restore" label="Restore Purchases" onPress={restorePurchases} /> : null}
            {links.termsUrl ? <LinkButton label="Terms of Use" onPress={() => Linking.openURL(links.termsUrl!)} /> : null}
            {links.privacyPolicyUrl ? <LinkButton label="Privacy Policy" onPress={() => Linking.openURL(links.privacyPolicyUrl!)} /> : null}
          </View>
        </ScrollView>
      </View>
    </Overlay>
  );
}

function Plan({ product, selected, onPress }: { product: StoreProduct; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      testID={`plan-${product.id}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${product.period === BillingPeriod.Year ? 'Yearly' : 'Monthly'}, ${product.displayPrice} per ${PERIOD_LABEL[product.period]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.plan, { borderColor: selected ? t.accentFill : t.border, backgroundColor: selected ? t.accentSoft : t.card, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.radio, { borderColor: selected ? t.accentFill : t.check }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: t.accentFill }]} /> : null}</View>
      <View style={styles.flex}>
        <Text style={[styles.planTitle, { color: t.text }]}>{product.period === BillingPeriod.Year ? 'Yearly' : 'Monthly'}</Text>
        {product.eligibleForTrial && product.trialDays ? <Text style={[styles.planDetail, { color: t.textSecondary }]}>{product.trialDays} days free</Text> : null}
      </View>
      <Text style={[styles.planPrice, { color: t.text }]}>
        {product.displayPrice}
        <Text style={[styles.planDetail, { color: t.muted }]}> / {PERIOD_LABEL[product.period]}</Text>
      </Text>
    </Pressable>
  );
}

function LinkButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.linkText, { color: t.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 20, fontWeight: '600' },
  content: { alignItems: 'stretch', paddingBottom: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  badge: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  badgeGlyph: { fontSize: 32, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  reason: { fontSize: 15, textAlign: 'center', marginTop: 6 },
  features: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12, marginTop: 20 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  featureTitle: { fontSize: 15 },
  featureDetail: { fontSize: 13, lineHeight: 18 },
  center: { textAlign: 'center' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 20, paddingHorizontal: 8 },
  plans: { gap: 10, marginTop: 20 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 14, paddingHorizontal: 14, minHeight: 60 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planTitle: { fontSize: 16, fontWeight: '700' },
  planDetail: { fontSize: 13, fontWeight: '500' },
  planPrice: { fontSize: 16, fontWeight: '700' },
  cta: { marginTop: 20, minHeight: 52 },
  terms: { fontSize: 12, lineHeight: 17, marginTop: 12, textAlign: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 12 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '600' },
});
