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
//
// PRECISE LOCATION: the WebView's own navigator.geolocation on Android often
// returns a coarse network fix. For an accurate survey we override it with a
// shim that asks the NATIVE side for a highest-accuracy GPS fix (BestForNavigation),
// so every point dropped is a real GPS coordinate.

// Runs before the page's own script, so survey.html's 📍 button uses our shim.
const GPS_BRIDGE = `
(function(){
  var cbs = {}, seq = 0;
  window.__gpsResolve = function(id, lat, lng, acc){
    var c = cbs[id]; if(!c) return; delete cbs[id];
    if(c.success) c.success({ coords:{ latitude:lat, longitude:lng, accuracy:acc,
      altitude:null, altitudeAccuracy:null, heading:null, speed:null }, timestamp: Date.now() });
  };
  window.__gpsReject = function(id, msg){
    var c = cbs[id]; if(!c) return; delete cbs[id];
    if(c.error) c.error({ code:2, message: msg || 'Location unavailable' });
  };
  var native = window.ReactNativeWebView;
  if(native){
    navigator.geolocation = navigator.geolocation || {};
    navigator.geolocation.getCurrentPosition = function(success, error){
      var id = ++seq; cbs[id] = { success:success, error:error };
      native.postMessage(JSON.stringify({ kind:'reqGPS', id:id }));
    };
    // survey.html only uses getCurrentPosition; make watch a one-shot too.
    navigator.geolocation.watchPosition = function(success, error){
      var id = ++seq; cbs[id] = { success:success, error:error };
      native.postMessage(JSON.stringify({ kind:'reqGPS', id:id })); return id;
    };
    navigator.geolocation.clearWatch = function(){};
  }
  true;
})();
`;

export default function SurveyApp() {
  const [ready, setReady] = React.useState(false);
  const webRef = React.useRef<WebView>(null);

  // Ask for location up front, requesting foreground permission. The actual
  // fixes are taken at highest accuracy below.
  React.useEffect(() => {
    Location.requestForegroundPermissionsAsync().finally(() => setReady(true));
  }, []);

  const nativeGps = async (id: number) => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation, // highest-precision GPS fix
      });
      const { latitude, longitude, accuracy } = pos.coords;
      webRef.current?.injectJavaScript(
        `window.__gpsResolve(${id}, ${latitude}, ${longitude}, ${accuracy ?? 0});true;`,
      );
    } catch (e) {
      webRef.current?.injectJavaScript(
        `window.__gpsReject(${id}, ${JSON.stringify(String((e as any)?.message || e))});true;`,
      );
    }
  };

  const onMessage = async (e: any) => {
    let d: any;
    try {
      d = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    // Precise-location request from the page's 📍 button.
    if (d?.kind === "reqGPS" && typeof d.id === "number") {
      nativeGps(d.id);
      return;
    }
    // Export: no browser file system here, so write the JSON to a temp file and
    // open the native Share sheet (email / Drive / WhatsApp / Files).
    if (d?.kind === "export" && d.json) {
      try {
        const uri = (FileSystem.cacheDirectory || "") + (d.filename || "course-coords.json");
        await FileSystem.writeAsStringAsync(uri, d.json);
        await Share.share(Platform.OS === "ios" ? { url: uri } : { title: d.filename, message: d.json });
      } catch {
        /* user cancelled the share, or write failed — the tool keeps the data */
      }
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
        ref={webRef}
        originWhitelist={["*"]}
        // A real https baseUrl so localStorage (progress saving) and the CDN /
        // satellite-tile requests all have a proper origin.
        source={{ html: SURVEY_HTML, baseUrl: "https://foreai.co.za/" }}
        injectedJavaScriptBeforeContentLoaded={GPS_BRIDGE}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        allowFileAccess
        onMessage={onMessage}
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
