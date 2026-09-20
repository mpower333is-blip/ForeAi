import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from "react-native";
import { Screen, ScreenHeader, Card, Button, TextField, Stepper, Chip } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { CLUB_CONFIG } from "../config/appVariant";
import { useMember } from "../state/MemberContext";
import { membershipApi, ClubInfo, DaySheet, Slot, Booking, PlayerCard } from "../services/membershipApi";

// Member tee-time booking. Pick a day, tap an open slot, choose the party and
// build your 4-ball — pick partners from the club's shared player directory or
// add a new name + mobile (saved for everyone next time). My upcoming bookings
// sit at the top with a cancel action. All reads/writes go through the club store.

// A partner slot while building the 4-ball. `playerId` is set when picked from
// the directory (so we don't re-save them); a typed-in partner is saved on book.
type Partner = { name: string; phone: string; playerId?: string };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabel(d: Date, i: number): string {
  if (i === 0) return "Today";
  if (i === 1) return "Tom’w";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default function TeeTimesScreen({ navigation }: any) {
  const { member } = useMember();
  const [club, setClub] = React.useState<ClubInfo | null>(null);
  const [date, setDate] = React.useState(ymd(new Date()));
  const [sheet, setSheet] = React.useState<DaySheet | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [mine, setMine] = React.useState<Booking[]>([]);
  const [sel, setSel] = React.useState<Slot | null>(null);
  const [party, setParty] = React.useState(1);
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [directory, setDirectory] = React.useState<PlayerCard[]>([]);
  const [openGame, setOpenGame] = React.useState(false);
  const [booking, setBooking] = React.useState(false);

  const windowDays = club?.bookingWindowDays ?? 14;

  React.useEffect(() => { membershipApi.club().then(setClub).catch(() => {}); }, []);
  const loadDirectory = React.useCallback(() => {
    membershipApi.players().then((rows) => setDirectory(rows ?? [])).catch(() => {});
  }, []);
  React.useEffect(() => { loadDirectory(); }, [loadDirectory]);
  const loadMine = React.useCallback(() => {
    if (member) membershipApi.myBookings(member.id).then(setMine).catch(() => {});
  }, [member]);
  React.useEffect(() => { loadMine(); }, [loadMine]);

  const loadSheet = React.useCallback((d: string) => {
    setLoading(true);
    setSel(null);
    membershipApi.slots(d).then(setSheet).catch(() => setSheet(null)).finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { loadSheet(date); }, [date, loadSheet]);

  const days = React.useMemo(() => {
    const out: { d: Date; str: string; label: string; dow: number }[] = [];
    for (let i = 0; i <= windowDays; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      out.push({ d, str: ymd(d), label: dayLabel(d, i), dow: d.getDay() });
    }
    return out;
  }, [windowDays]);

  const openDays = React.useMemo(() => new Set((club?.openDays ?? "0,1,2,3,4,5,6").split(",").map((n) => Number(n))), [club]);

  const pickSlot = (s: Slot) => {
    if (s.available <= 0) return;
    setSel(s);
    setParty(1);
    setPartners([]);
    setOpenGame(false);
  };

  // Update one partner slot (keeps the array length stable).
  const setPartner = (i: number, patch: Partial<Partner>) =>
    setPartners((prev) => {
      const next = [...prev];
      const base: Partner = next[i] ?? { name: "", phone: "" };
      next[i] = { ...base, ...patch };
      return next;
    });
  const clearPartner = (i: number) => setPartner(i, { name: "", phone: "", playerId: undefined });

  const confirm = async () => {
    if (!member || !sel) return;
    setBooking(true);
    try {
      if (openGame) {
        // Post an open game: reserve the 4-ball and let members join the spots.
        await membershipApi.book({ memberId: member.id, date, minute: sel.minute, open: true, maxPlayers: party });
        Alert.alert("Open game posted", `Your ${sel.time} game on ${date} is on the Open Games board — members can now join.`);
      } else {
        const chosen = partners.slice(0, party - 1)
          .map((p) => ({ name: (p?.name ?? "").trim(), phone: (p?.phone ?? "").trim(), playerId: p?.playerId }))
          .filter((p) => p.name);
        // Save any newly typed partners (not picked from the directory) so the whole
        // club can reuse them next time. Best-effort — never block the booking.
        await Promise.all(
          chosen.filter((p) => !p.playerId).map((p) => membershipApi.savePlayer({ name: p.name, phone: p.phone || undefined }).catch(() => null)),
        );
        const players = [`${member.firstName} ${member.lastName}`, ...chosen.map((p) => p.name)];
        await membershipApi.book({ memberId: member.id, date, minute: sel.minute, partySize: party, players });
        Alert.alert("Booked", `You're on the tee at ${sel.time} on ${date}.`);
      }
      setSel(null);
      loadSheet(date);
      loadMine();
      loadDirectory();
    } catch (e: any) {
      Alert.alert("Couldn't book", e?.message ?? "That slot may have just filled up.");
      loadSheet(date);
    } finally {
      setBooking(false);
    }
  };

  const cancel = (b: Booking) => {
    if (!member) return;
    Alert.alert("Cancel booking?", `${new Date(b.teeAt).toLocaleString()} — remove this tee time?`, [
      { text: "Keep", style: "cancel" },
      { text: "Cancel booking", style: "destructive", onPress: async () => {
        try {
          await membershipApi.cancel(b.id, member.id);
          loadMine();
          loadSheet(date);
        } catch (e: any) {
          Alert.alert("Couldn't cancel", e?.message ?? "Please try again.");
        }
      } },
    ]);
  };

  if (!member) {
    return (
      <Screen>
        <ScreenHeader onBack={() => navigation.goBack()} title="Tee Times" subtitle="Book your round" />
        <Card>
          <Text style={styles.lead}>Link your membership first, then you can book tee times here.</Text>
          <Button icon="🪪" label="Link my membership" onPress={() => navigation.navigate("Membership")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader onBack={() => navigation.goBack()} title="Tee Times" subtitle={CLUB_CONFIG?.shortName ?? "Book your round"} />

      {/* My upcoming bookings */}
      {mine.length > 0 && (
        <Card accent>
          <Text style={styles.h}>My tee times</Text>
          {mine.map((b) => (
            <View key={b.id} style={styles.mineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mineWhen}>{new Date(b.teeAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                <Text style={styles.mineWho}>{(b.players ?? []).join(", ") || `${b.partySize} player${b.partySize > 1 ? "s" : ""}`}</Text>
              </View>
              <TouchableOpacity onPress={() => cancel(b)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}

      {/* Day picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((day) => {
          const active = day.str === date;
          const closed = !openDays.has(day.dow);
          return (
            <TouchableOpacity key={day.str} onPress={() => setDate(day.str)} activeOpacity={0.8} style={[styles.day, active && styles.dayActive, closed && styles.dayClosed]}>
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.label}</Text>
              <Text style={[styles.dayNum, active && styles.dayLabelActive]}>{day.d.getDate()}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Booking panel for the selected slot */}
      {sel && (
        <Card accent>
          <Text style={styles.h}>Book {sel.time}</Text>
          <Text style={styles.sub}>{sel.available} of {sel.capacity} seat{sel.capacity > 1 ? "s" : ""} open in this slot.</Text>
          <View style={styles.openRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.openLabel}>Open game</Text>
              <Text style={styles.openSub}>Let other members join the open spots.</Text>
            </View>
            <Switch value={openGame} onValueChange={setOpenGame} trackColor={{ true: colors.accent }} />
          </View>
          <Stepper label={openGame ? "Spots in the 4-ball" : "Players in your group"} value={party} onChange={(v) => setParty(v)} step={1} min={openGame ? 2 : 1} max={sel.available} />
          {openGame ? (
            <Text style={styles.pickerHint}>Members will fill the remaining {Math.max(0, party - 1)} spot{party - 1 === 1 ? "" : "s"} from the Open Games board.</Text>
          ) : (
            <>
          {party > 1 && <Text style={styles.pickerHint}>Build your 4-ball — pick a saved partner or add a new name.</Text>}
          {Array.from({ length: Math.max(0, party - 1) }).map((_, i) => {
            const p: Partner = partners[i] ?? { name: "", phone: "" };
            const q = p.name.trim().toLowerCase();
            const qDigits = q.replace(/[^0-9]/g, "");
            const chosenIds = partners.map((x) => x?.playerId).filter(Boolean) as string[];
            const suggestions = !p.playerId && q.length >= 1
              ? directory
                  .filter((d) => !chosenIds.includes(d.id))
                  .filter((d) => d.name.toLowerCase().includes(q) || (qDigits && (d.phone || "").replace(/[^0-9]/g, "").includes(qDigits)))
                  .slice(0, 5)
              : [];
            return (
              <View key={i} style={styles.partner}>
                <View style={styles.partnerHead}>
                  <Text style={styles.partnerLabel}>Partner {i + 1}{p.playerId ? "" : " (optional)"}</Text>
                  {p.playerId ? <Chip label="Saved" tone="accent" /> : null}
                  {(p.name || p.phone) ? (
                    <TouchableOpacity onPress={() => clearPartner(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.partnerClear}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TextField value={p.name} onChangeText={(v) => setPartner(i, { name: v, playerId: undefined })} placeholder="Search or type a name" style={{ marginBottom: suggestions.length ? spacing.xs : spacing.sm }} />
                {suggestions.map((d) => (
                  <TouchableOpacity key={d.id} style={styles.suggest} activeOpacity={0.8} onPress={() => setPartner(i, { name: d.name, phone: d.phone || "", playerId: d.id })}>
                    <Text style={styles.suggestName}>{d.name}{d.memberId ? "  ·  member" : ""}</Text>
                    {d.phone ? <Text style={styles.suggestPhone}>{d.phone}</Text> : null}
                  </TouchableOpacity>
                ))}
                {!p.playerId && p.name.trim().length > 0 ? (
                  <TextField value={p.phone} onChangeText={(v) => setPartner(i, { phone: v })} placeholder="Mobile — so they can pick themselves later" keyboardType="phone-pad" />
                ) : null}
              </View>
            );
          })}
            </>
          )}
          {booking ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.sm }} /> : (
            <>
              <Button icon="✅" label={openGame ? `Post open game at ${sel.time}` : `Confirm ${sel.time} tee time`} onPress={confirm} />
              <Button variant="ghost" label="Choose another time" onPress={() => setSel(null)} />
            </>
          )}
        </Card>
      )}

      {/* The day's tee sheet */}
      <Card>
        <Text style={styles.h}>{new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} />
        ) : !sheet ? (
          <Text style={styles.sub}>Couldn't load the tee sheet. Pull a different day or try again.</Text>
        ) : !sheet.open ? (
          <Text style={styles.sub}>The course is closed on this day.</Text>
        ) : (
          sheet.slots.map((s) => {
            const full = s.available <= 0;
            return (
              <TouchableOpacity key={s.minute} disabled={full} activeOpacity={0.8} onPress={() => pickSlot(s)} style={[styles.slot, sel?.minute === s.minute && styles.slotSel]}>
                <Text style={[styles.slotTime, full && styles.slotDim]}>{s.time}</Text>
                <View style={{ flex: 1 }}>
                  {s.names.length > 0 ? (
                    <Text style={[styles.slotNames, full && styles.slotDim]} numberOfLines={1}>{s.names.join(", ")}</Text>
                  ) : (
                    <Text style={styles.slotOpen}>Open</Text>
                  )}
                </View>
                {s.blocked ? <Chip label="Closed" tone="muted" /> : full ? <Chip label="Full" tone="muted" /> : <Chip label={`${s.available} open`} tone="accent" />}
              </TouchableOpacity>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  h: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: spacing.xs },
  sub: { color: colors.textMuted, marginBottom: spacing.sm },

  mineRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  mineWhen: { color: colors.text, fontWeight: "700" },
  mineWho: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  cancel: { color: colors.negative, fontWeight: "700" },

  days: { gap: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.md },
  day: { width: 54, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  dayActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  dayClosed: { opacity: 0.4 },
  dayLabel: { color: colors.textFaint, fontSize: 11, textTransform: "uppercase" },
  dayNum: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 2 },
  dayLabelActive: { color: colors.accent },

  openRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  openLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  openSub: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  pickerHint: { color: colors.textFaint, fontSize: 12, marginBottom: spacing.sm },
  partner: { marginBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  partnerHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  partnerLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700", flex: 1 },
  partnerClear: { color: colors.negative, fontSize: 12, fontWeight: "700" },
  suggest: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs },
  suggestName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  suggestPhone: { color: colors.textFaint, fontSize: 12 },

  slot: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  slotSel: { backgroundColor: colors.accentSoft, borderRadius: radius.sm },
  slotTime: { color: colors.text, fontWeight: "800", width: 52 },
  slotNames: { color: colors.textMuted, fontSize: 13 },
  slotOpen: { color: colors.textFaint, fontSize: 13, fontStyle: "italic" },
  slotDim: { opacity: 0.5 },
});
