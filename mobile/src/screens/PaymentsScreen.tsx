import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Screen, ScreenHeader, Card, Button, Chip, EmptyState, Loading, StatTile } from "../components/ui";
import { colors, spacing, radius, type as typ } from "../theme";
import { useMember } from "../state/MemberContext";
import {
  paymentsApi,
  Invoice,
  PayConfig,
  money,
  INVOICE_LABEL,
} from "../services/paymentsApi";

// The member's account — outstanding invoices (dues, green fees, competition
// entries, levies) and payment history. Paying opens PayFast in the browser, or
// (EFT mode) shows the club's banking details + a reference to quote.

export default function PaymentsScreen({ navigation }: any) {
  const { member } = useMember();
  const [config, setConfig] = React.useState<PayConfig | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [outstanding, setOutstanding] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [eft, setEft] = React.useState<{ invoice: Invoice; banking: string | null; reference: string } | null>(null);
  const [payingId, setPayingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!member) return;
    try {
      const [cfg, mine] = await Promise.all([paymentsApi.config(), paymentsApi.mine(member.id)]);
      setConfig(cfg);
      setInvoices(mine.invoices);
      setOutstanding(mine.outstandingCents);
    } catch (e: any) {
      Alert.alert("Couldn't load your account", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [member]);

  React.useEffect(() => {
    load();
  }, [load]);

  const currency = config?.currency ?? "ZAR";

  const pay = async (inv: Invoice) => {
    setPayingId(inv.id);
    try {
      const r = await paymentsApi.checkout(inv.id);
      if (r.mode === "payfast") {
        await Linking.openURL(r.url);
        Alert.alert("Payment", "Complete the payment in your browser, then pull down to refresh.");
      } else {
        setEft({ invoice: inv, banking: r.banking, reference: r.reference });
      }
    } catch (e: any) {
      Alert.alert("Payment", e?.message ?? "Couldn't start the payment.");
    } finally {
      setPayingId(null);
    }
  };

  if (!member) {
    return (
      <Screen>
        <ScreenHeader title="My account" subtitle="Dues, green fees & competition entries" onBack={() => navigation.goBack()} />
        <EmptyState
          emoji="💳"
          title="Link your membership"
          body="Link your club membership to see your invoices and pay online."
          actionLabel="Link membership"
          onAction={() => navigation.navigate("Membership")}
        />
      </Screen>
    );
  }

  const unpaid = invoices.filter((i) => i.status === "unpaid");
  const history = invoices.filter((i) => i.status !== "unpaid");

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
      >
        <ScreenHeader title="My account" subtitle={member.memberNumber} onBack={() => navigation.goBack()} />

        {loading ? (
          <Loading label="Loading your account…" />
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile
                label="Outstanding"
                value={money(outstanding, currency)}
                tone={outstanding > 0 ? "gold" : "positive"}
                hint={unpaid.length ? `${unpaid.length} invoice${unpaid.length > 1 ? "s" : ""}` : "All settled"}
              />
              <StatTile label="Pay by" value={config?.mode === "payfast" ? "Card / EFT" : "EFT"} tone="neutral" />
            </View>

            {unpaid.length === 0 ? (
              <EmptyState emoji="✅" title="You're all paid up" body="No outstanding invoices right now." />
            ) : (
              <>
                <Text style={styles.section}>Outstanding</Text>
                {unpaid.map((inv) => (
                  <Card key={inv.id} accent>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.tagRow}>
                          <Chip label={INVOICE_LABEL[inv.type]} tone="gold" />
                          <Text style={styles.ref}>{inv.number}</Text>
                        </View>
                        <Text style={styles.desc}>{inv.description}</Text>
                        {inv.dueAt ? <Text style={styles.due}>Due {new Date(inv.dueAt).toLocaleDateString()}</Text> : null}
                      </View>
                      <Text style={styles.amount}>{money(inv.amountCents, currency)}</Text>
                    </View>
                    {payingId === inv.id ? (
                      <View style={styles.payBusy}><ActivityIndicator color={colors.accent} /></View>
                    ) : (
                      <Button
                        label={config?.mode === "payfast" ? "Pay now" : "Pay by EFT"}
                        icon={config?.mode === "payfast" ? "💳" : "🏦"}
                        onPress={() => pay(inv)}
                        style={{ marginTop: spacing.sm }}
                      />
                    )}
                  </Card>
                ))}
              </>
            )}

            {history.length > 0 && (
              <>
                <Text style={styles.section}>History</Text>
                {history.map((inv) => (
                  <Card key={inv.id}>
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.tagRow}>
                          <Chip label={INVOICE_LABEL[inv.type]} tone="muted" />
                          <Chip
                            label={inv.status === "paid" ? "Paid" : inv.status === "cancelled" ? "Cancelled" : "Refunded"}
                            tone={inv.status === "paid" ? "accent" : "muted"}
                          />
                        </View>
                        <Text style={styles.desc}>{inv.description}</Text>
                        <Text style={styles.due}>
                          {inv.status === "paid" && inv.paidAt
                            ? `Paid ${new Date(inv.paidAt).toLocaleDateString()}`
                            : inv.number}
                        </Text>
                      </View>
                      <Text style={[styles.amount, styles.amountMuted]}>{money(inv.amountCents, currency)}</Text>
                    </View>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* EFT details modal */}
      <Modal visible={!!eft} transparent animationType="fade" onRequestClose={() => setEft(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pay by EFT</Text>
            <Text style={styles.modalSub}>Transfer the amount below and use the reference so we can match your payment.</Text>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Amount</Text>
              <Text style={styles.modalValue}>{eft ? money(eft.invoice.amountCents, currency) : ""}</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Reference</Text>
              <Text style={[styles.modalValue, { color: colors.accent }]}>{eft?.reference}</Text>
            </View>

            {eft?.banking ? (
              <View style={styles.bankingBox}>
                <Text style={styles.bankingText}>{eft.banking}</Text>
              </View>
            ) : (
              <Text style={styles.modalSub}>Ask the club office for the banking details.</Text>
            )}

            <Text style={styles.modalNote}>
              Once we receive your EFT the office will mark this invoice paid — pull down to refresh to check.
            </Text>
            <Button label="Done" onPress={() => setEft(null)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  section: { ...typ.small, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint, marginTop: spacing.md, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: 6, flexWrap: "wrap" },
  ref: { ...typ.small, color: colors.textFaint },
  desc: { ...typ.body, color: colors.text, fontWeight: "600" },
  due: { ...typ.small, color: colors.textMuted, marginTop: 2 },
  amount: { ...typ.h2, color: colors.text, fontWeight: "800" },
  amountMuted: { color: colors.textMuted },
  payBusy: { paddingVertical: spacing.sm, alignItems: "center" },

  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  modalTitle: { ...typ.h2, color: colors.text, marginBottom: 6 },
  modalSub: { ...typ.body, color: colors.textMuted, marginBottom: spacing.md },
  modalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  modalLabel: { ...typ.body, color: colors.textMuted },
  modalValue: { ...typ.body, color: colors.text, fontWeight: "700" },
  bankingBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  bankingText: { ...typ.body, color: colors.text, lineHeight: 22 },
  modalNote: { ...typ.small, color: colors.textFaint, marginTop: spacing.md, lineHeight: 18 },
});
