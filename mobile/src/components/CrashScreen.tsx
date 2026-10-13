import React from "react";
import { ScrollView, Text, View, StyleSheet, Platform } from "react-native";

// Shown when the startup guard (or the error boundary) catches a launch-time
// error, so the real message + stack is visible on the device and can be
// screenshotted — instead of the app silently closing ("ForeAi keeps stopping").
export default function CrashScreen({ error, info }: { error: Error; info?: string }) {
  const msg = error?.message || String(error);
  const stack = error?.stack || "";
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Startup error</Text>
        <Text style={styles.hint}>
          Please screenshot this whole screen and send it over — it shows exactly
          what went wrong so it can be fixed.
        </Text>
        <Text style={styles.label}>Message</Text>
        <Text selectable style={styles.msg}>
          {msg}
        </Text>
        {!!stack && (
          <>
            <Text style={styles.label}>Stack</Text>
            <Text selectable style={styles.stack}>
              {stack}
            </Text>
          </>
        )}
        {!!info && (
          <>
            <Text style={styles.label}>Component stack</Text>
            <Text selectable style={styles.stack}>
              {info}
            </Text>
          </>
        )}
        <Text style={styles.meta}>
          ForeAi · {Platform.OS} {String(Platform.Version)}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f0d" },
  content: { padding: 20, paddingTop: 64, gap: 10 },
  title: { color: "#FF6B6B", fontSize: 24, fontWeight: "800" },
  hint: { color: "#cfd8d3", fontSize: 14, lineHeight: 20, marginBottom: 8 },
  label: { color: "#7fb5a0", fontSize: 12, fontWeight: "700", marginTop: 12, textTransform: "uppercase" },
  msg: { color: "#fff", fontSize: 15, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  stack: { color: "#9aa7a1", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 16 },
  meta: { color: "#5a6a63", fontSize: 11, marginTop: 20 },
});
