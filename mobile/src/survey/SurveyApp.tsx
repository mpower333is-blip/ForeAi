import React from "react";
import { View, Text, StyleSheet, Platform, Share, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system";
import { SURVEY_HTML } from "./surveyHtml";

// The standalone "ForeAi Survey" app (com.foreai.surveyor). It's the same
// map-drawing survey tool used on the web, wrapped full-screen so a course can
// be mapped on a phone/tablet — tap the satellite view to place tees (multiple
// tee boxes), greens, fairways and hazards, or hit 📍 to drop a point at your
// live GPS position. "⬇ Download coords" hands the JSON to the Share sheet.
export default function SurveyApp() {
  const [ready, setReady] = React.useState(false);

  // Ask for location once up front so the WebView's navigator.geolocation (the
  // 📍 button) can get a fix without a per-request prompt.
  React.useEffect(() => {
    Location.requestForegroundPermissionsAsync().finally(() => setReady(true));
  }, []);

  // The web tool posts { kind:"export", filename, json } when you tap download —
  // there's no browser file system here, so we write it to a temp file and open
  // the native Share sheet (email / Drive / WhatsApp / Files).
  const onMessage = async (e: any) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d?.kind !== "export" || !d.json) return;
      const uri = (FileSystem.cacheDirectory || "") + (d.filename || "course-coords.json");
      await FileSystem.writeAsStringAsync(uri, d.json);
      await Share.share(
        Platform.OS === "ios"
          ? { url: uri }
          : { title: d.filename, message: d.json },
      );
    } catch {
      /* user cancelled the share, or write failed — the tool keeps the data */
    }
  };

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.brand}>ForeAi Survey</Text>
        <ActivityIndicator color="#39d98a" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
      <WebView
        originWhitelist={["*"]}
        // A real https baseUrl so localStorage (progress saving) and the CDN /
        // satellite-tile requests all have a proper origin.
        source={{ html: SURVEY_HTML, baseUrl: "https://foreai.co.za/" }}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        allowFileAccess
        onMessage={onMessage}
        // Android: grant the WebView's geolocation prompt automatically (the app
        // itself already holds the OS location permission from above).
        onGeolocationPermissionsShowPrompt={
          Platform.OS === "android"
            ? (_origin: string, cb: any) => cb(_origin, true, false)
            : undefined
        }
        style={styles.fill}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.splash}>
            <ActivityIndicator color="#39d98a" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0a1f14" },
  splash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0a1f14", alignItems: "center", justifyContent: "center" },
  brand: { color: "#eafff2", fontSize: 26, fontWeight: "800" },
});
