import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { Screen, ScreenHeader, Card, Button } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { useAuth } from "../state/AuthContext";

// Staff / organiser sign-in — the SAME email + password used on the clubhouse
// website. Signing in unlocks the in-app Clubhouse tools (course survey, etc.),
// so club staff use one app instead of a separate survey app.
export default function StaffLoginScreen({ navigation }: any) {
  const { signIn, available } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const p = await signIn(email, password);
      if (!p.isStaff) {
        setError("This account isn't set up as club staff. Ask an admin to grant access.");
        setBusy(false);
        return;
      }
      navigation.replace("Clubhouse");
    } catch (e: any) {
      const code = String(e?.code || e?.message || "");
      setError(
        code.includes("wrong-password") || code.includes("invalid-credential")
          ? "Wrong email or password."
          : code.includes("user-not-found")
          ? "No account for that email."
          : code.includes("too-many-requests")
          ? "Too many attempts — try again in a bit."
          : "Couldn't sign in. Check your connection and try again."
      );
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Clubhouse sign-in"
        subtitle="For club staff & organisers"
        onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
      />

      {!available ? (
        <Card>
          <Text style={styles.note}>Sign-in isn't available in this version of the app.</Text>
        </Card>
      ) : (
        <Card accent>
          <Text style={styles.lead}>
            Sign in with the same email and password you use on the ForeAi clubhouse website.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@club.co.za"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.note}>Signing in…</Text>
            </View>
          ) : (
            <Button label="Sign in" onPress={submit} />
          )}

          <Text style={styles.hint}>
            Don't have an account yet? Set it up on the clubhouse website, then sign in here.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  error: { color: colors.negative, fontSize: 14, fontWeight: "600", marginBottom: spacing.sm },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
});
