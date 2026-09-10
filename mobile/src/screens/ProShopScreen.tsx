import React from "react";
import { View, Text, StyleSheet, Linking, Alert, TouchableOpacity } from "react-native";
import { Screen, ScreenHeader, Card, Button, TextField, Stepper } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { CLUB_CONFIG } from "../config/appVariant";

// Pro Shop bookings for a club app. No booking backend — a request is composed
// from the form and handed to the shop's real channel (WhatsApp preferred, then
// email, then an online booking link) pre-filled, so the shop gets a tidy
// message. Channels the club hasn't filled in stay hidden.
const TYPES = ["Tee time", "Lesson", "Pro shop"] as const;
type BType = (typeof TYPES)[number];

export default function ProShopScreen({ navigation }: any) {
  const club = CLUB_CONFIG;
  const shop = club?.proShop ?? {};
  const [type, setType] = React.useState<BType>("Tee time");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [players, setPlayers] = React.useState(4);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const clubName = club?.shortName ?? "the club";
  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert("Couldn't open", "No app available to handle that."));

  const message = () => {
    const L = [`Booking request — ${clubName}`, `Type: ${type}`];
    if (type !== "Pro shop") { L.push(`Date: ${date || "(not set)"}`, `Time: ${time || "(not set)"}`); }
    if (type === "Tee time") L.push(`Players: ${players}`);
    if (name) L.push(`Name: ${name}`);
    if (phone) L.push(`Phone: ${phone}`);
    if (notes) L.push(`Notes: ${notes}`);
    L.push("", "Sent from the club app.");
    return L.join("\n");
  };

  const validate = () => {
    if (type !== "Pro shop" && (!date.trim() || !time.trim())) {
      Alert.alert("Add a date & time", "Please enter the day and time you'd like."); return false;
    }
    if (!name.trim()) { Alert.alert("Add your name", "Please enter your name so the shop knows who's booking."); return false; }
    return true;
  };

  const send = () => {
    if (!validate()) return;
    const msg = message();
    if (shop.whatsapp) return open(`https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(msg)}`);
    if (shop.email) return open(`mailto:${shop.email}?subject=${encodeURIComponent(`Booking request — ${type}`)}&body=${encodeURIComponent(msg)}`);
    if (shop.bookingUrl) return open(shop.bookingUrl);
    Alert.alert("Pro shop not set up yet", "The club hasn't added their booking contact yet. Please phone the pro shop.");
  };

  const hasChannel = !!(shop.whatsapp || shop.email || shop.bookingUrl || shop.phone);

  return (
    <Screen>
      <ScreenHeader onBack={() => navigation.goBack()} title="Pro Shop" subtitle="Book a tee time or a lesson" />

      {/* Quick contact actions */}
      <Card>
        <Text style={styles.h}>Contact the shop</Text>
        {shop.phone ? <Button icon="📞" label="Call the pro shop" onPress={() => open(`tel:${shop.phone}`)} /> : null}
        {shop.whatsapp ? <Button icon="💬" variant="ghost" label="WhatsApp the shop" onPress={() => open(`https://wa.me/${shop.whatsapp}`)} /> : null}
        {shop.bookingUrl ? <Button icon="🌐" variant="ghost" label="Book online" onPress={() => open(shop.bookingUrl!)} /> : null}
        {!hasChannel && <Text style={styles.muted}>Pro shop contact details go here — add them and members can book straight from the app.</Text>}
        {shop.hours ? <Text style={styles.hours}>🕐 {shop.hours}</Text> : null}
      </Card>

      {/* Booking request form */}
      <Card accent>
        <Text style={styles.h}>Request a booking</Text>
        <Text style={styles.muted}>Fill this in and we'll open a pre-filled message to the pro shop.</Text>

        <Text style={styles.lbl}>What for?</Text>
        <View style={styles.chips}>
          {TYPES.map((t) => {
            const on = type === t;
            return (
              <TouchableOpacity key={t} activeOpacity={0.85} onPress={() => setType(t)} style={[styles.pill, on && styles.pillOn]}>
                <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {type !== "Pro shop" && (
          <View style={styles.row2}>
            <TextField label="Date" value={date} onChangeText={setDate} placeholder="e.g. Sat 20 Sep" style={styles.half} />
            <TextField label="Time" value={time} onChangeText={setTime} placeholder="e.g. 08:30" style={styles.half} />
          </View>
        )}

        {type === "Tee time" && (
          <Stepper label="Players" value={players} onChange={setPlayers} step={1} min={1} max={4} unit="players" />
        )}

        <TextField label="Your name" value={name} onChangeText={setName} placeholder="Name & surname" />
        <TextField label="Your phone" value={phone} onChangeText={setPhone} placeholder="So the shop can confirm" keyboardType="phone-pad" />
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Buggy, clubs, anything else" />

        <Button icon="📩" label="Send booking request" onPress={send} />
      </Card>

      <Text style={styles.footer}>
        Bookings are sent to the pro shop to confirm — this doesn't reserve a slot automatically.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 8 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  lbl: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 4, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: colors.bg },
  pillOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pillTxt: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  pillTxtOn: { color: colors.accent },
  row2: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  hours: { color: colors.textFaint, fontSize: 13, marginTop: 6 },
  footer: { color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: spacing.md, marginBottom: spacing.lg, lineHeight: 17 },
});
