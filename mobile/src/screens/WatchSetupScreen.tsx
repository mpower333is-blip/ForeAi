import React from "react";
import { View, Text, StyleSheet, Linking, Platform } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Screen, ScreenHeader, Card, Button } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { useTournament } from "../state/TournamentContext";
import { WEAR_PACKAGE, WEAR_PLAY_URL, WEAR_APK_URL } from "../config/appConfig";

// A scannable QR on a white tile (QR codes need light background + dark modules
// to scan reliably, whatever the app theme).
function QrTile({ url, caption }: { url: string; caption: string }) {
  return (
    <View style={styles.qrWrap}>
      <View style={styles.qrTile}>
        <QRCode value={url} size={150} backgroundColor="#ffffff" color="#0b0b0b" />
      </View>
      <Text style={styles.qrCaption}>{caption}</Text>
    </View>
  );
}

// "Set up your watch" — get the ForeAi Wear OS app onto the player's watch.
//
// The real install path is the Play Store: on a phone paired with a Wear OS
// watch, the app's Play listing offers "Install on <watch>". Until the watch
// app is published, players sideload the APK. Both options are here, plus the
// join code the watch uses so it drops straight into the golf day.
export default function WatchSetupScreen({ navigation }: any) {
  const { events, myPlayerId } = useTournament();
  const live = events.find((e) => e.remote && !!myPlayerId(e.id));
  const code = live?.code;

  const openPlay = () => {
    // Prefer the Play Store app (shows the "Install on watch" control), fall
    // back to the web listing.
    const market = `market://details?id=${WEAR_PACKAGE}`;
    Linking.canOpenURL(market).then((ok) =>
      Linking.openURL(ok ? market : WEAR_PLAY_URL).catch(() => {})
    );
  };

  const openApk = () => Linking.openURL(WEAR_APK_URL).catch(() => {});

  return (
    <Screen>
      <ScreenHeader
        title="Set up your watch"
        subtitle="Put ForeAi on your Wear OS watch — pick clubs, see distances and log shots from your wrist."
        onBack={() => navigation.goBack()}
      />

      <Card accent>
        <Text style={styles.h}>What the watch does</Text>
        <Text style={styles.li}>🎒  Pick your club on your wrist</Text>
        <Text style={styles.li}>📍  Live GPS distance to the green</Text>
        <Text style={styles.li}>⛳  Log each shot — phone can stay in the cart</Text>
        <Text style={styles.li}>🏆  Enter scores that sync to the leaderboard</Text>
      </Card>

      <Card>
        <Text style={styles.h}>Install on your watch</Text>
        <Text style={styles.p}>
          Make sure your Wear OS watch is paired to this phone, then open the Play Store listing —
          it has an <Text style={styles.b}>Install on watch</Text> option that sends it straight to
          your watch.
        </Text>
        <Button label="📲 Open on the Play Store" onPress={openPlay} />
        <QrTile url={WEAR_PLAY_URL} caption="Scan to open the watch app listing" />
        {Platform.OS === "ios" && (
          <Text style={styles.note}>
            Wear OS watches install from the Google Play Store. On an iPhone, do this step from the
            watch's own Play Store or from an Android phone.
          </Text>
        )}
      </Card>

      <Card>
        <Text style={styles.h}>Not on the Play Store yet? Sideload it</Text>
        <Text style={styles.p}>
          While the watch app is in testing you can install the APK directly:
        </Text>
        <Text style={styles.step}>1. Download the ForeAi watch APK.</Text>
        <Text style={styles.step}>2. On the watch: Settings → Developer options → turn on ADB / Wireless debugging.</Text>
        <Text style={styles.step}>3. From a computer: <Text style={styles.mono}>adb connect &lt;watch-ip&gt;</Text> then <Text style={styles.mono}>adb install foreai-watch.apk</Text>.</Text>
        <Button label="⬇ Download the watch APK" variant="ghost" onPress={openApk} />
        <QrTile url={WEAR_APK_URL} caption="Scan on a computer to download the APK" />
      </Card>

      <Card>
        <Text style={styles.h}>On the watch</Text>
        <Text style={styles.p}>
          Open ForeAi on the watch and pick your name. It joins the golf day automatically.
        </Text>
        {code ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Your golf day join code</Text>
            <Text style={styles.code}>{code}</Text>
            <Text style={styles.codeHint}>The watch presets to the event — enter this only if it asks.</Text>
          </View>
        ) : (
          <Text style={styles.note}>
            Join a golf day on this phone first and its code will show here for the watch.
          </Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 8 },
  p: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  b: { color: colors.text, fontWeight: "800" },
  li: { color: colors.textMuted, fontSize: 15, lineHeight: 26 },
  step: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  mono: { color: colors.accent, fontWeight: "700" },
  note: { color: colors.textFaint, fontSize: 13, lineHeight: 18, marginTop: spacing.sm },
  codeBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  codeLabel: { color: colors.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  code: { color: colors.accent, fontSize: 34, fontWeight: "800", letterSpacing: 4, marginTop: 4 },
  codeHint: { color: colors.textFaint, fontSize: 12, marginTop: 6, textAlign: "center" },
  qrWrap: { alignItems: "center", marginTop: spacing.md },
  qrTile: { backgroundColor: "#ffffff", padding: 12, borderRadius: radius.md },
  qrCaption: { color: colors.textFaint, fontSize: 12, marginTop: 8, textAlign: "center" },
});
