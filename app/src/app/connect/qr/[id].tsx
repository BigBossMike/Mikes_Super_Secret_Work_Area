import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Btn, Notice, Pill, Screen, T, useToast } from "@/components/ui";
import { handshakeServices } from "@/handshake/services";
import { useHandshake } from "@/handshake/useHandshake";
import { qrPayload } from "@/lib/handshake";
import { personById, useApp } from "@/store/AppStore";
import { fonts, useTheme } from "@/theme";

// The QR fallback for the in-person connect: one phone shows its code, the
// other scans it. The code changes every 5 seconds, so a screenshot is useless.
export default function ConnectQr() {
  const t = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const [mode, setMode] = useState<"show" | "scan">("show");
  const [permission, requestPermission] = useCameraPermissions();
  const lastBadScan = useRef(0);
  const services = handshakeServices();
  const hs = useHandshake(id, { ...services, onConnected: () => { actions.completeConnect(id); router.replace(`/connected/${id}`); } });
  const p = personById(state, id);

  useEffect(() => {
    if (mode === "show") hs.showQr(); else hs.reset();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <Screen title="Connect"><T muted>Nobody to connect with.</T></Screen>;

  const busy = hs.phase === "checking";
  const onScan = (data: string) => {
    if (hs.scanned(data)) return;
    if (Date.now() - lastBadScan.current > 2500) { lastBadScan.current = Date.now(); toast("That's not an Intro code."); }
  };

  const statusPill = () => {
    switch (hs.phase) {
      case "connected": return <Pill kind="done" icon="checkmark" label="Connected" />;
      case "checking": return <Pill kind="wait" label="Checking…" />;
      case "showing": return <Pill kind="wait" label={`Waiting for ${p.name}…`} />;
      default: return null;
    }
  };

  return (
    <Screen title={`Connect with ${p.name}`} background={t.goSoft}>
      <View style={{ flexDirection: "row", backgroundColor: t.surface, borderRadius: 14, padding: 4 }}>
        {(["show", "scan"] as const).map(m => (
          <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center", backgroundColor: mode === m ? t.ink : "transparent" }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: mode === m ? t.surface : t.ink }}>{m === "show" ? "Show my code" : "Scan their code"}</Text>
          </Pressable>
        ))}
      </View>

      {mode === "show" ? (
        <View style={{ alignItems: "center", gap: 16 }}>
          <View style={{ backgroundColor: "#FFFFFF", padding: 18, borderRadius: 22, width: 260, height: 260, alignItems: "center", justifyContent: "center" }}>
            {hs.token ? <QRCode value={qrPayload(hs.token)} size={222} backgroundColor="#FFFFFF" color="#15213B" /> : <ActivityIndicator color={t.go} />}
          </View>
          <T style={{ textAlign: "center" }}>Ask {p.name} to open Intro and scan this.{"\n"}The code changes every 5 seconds.</T>
          {statusPill()}
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 16 }}>
          {!permission ? <ActivityIndicator color={t.go} /> : !permission.granted ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
              <T style={{ textAlign: "center" }}>Intro needs the camera to read {p.name}'s code.</T>
              <Btn small label="Allow camera" onPress={() => requestPermission()} />
            </View>
          ) : (
            <View style={{ width: 260, height: 260, borderRadius: 22, overflow: "hidden", backgroundColor: "#000" }}>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={busy || hs.phase === "connected" ? undefined : e => onScan(e.data)} />
            </View>
          )}
          <T style={{ textAlign: "center" }}>Point the camera at {p.name}'s code.</T>
          {statusPill()}
        </View>
      )}

      {hs.phase === "failed" && (
        <View style={{ gap: 10 }}>
          <Notice kind="warn">{hs.reason}</Notice>
          <Btn small variant="ghost" label="Try again" onPress={() => (mode === "show" ? hs.showQr() : hs.reset())} />
        </View>
      )}

      <T variant="small" style={{ textAlign: "center" }}>
        {services.live
          ? "Intro also checks both phones are in the same place. Only the suburb is kept."
          : "Demo: the other person is pretend, but the code is real. Another phone running Intro can scan it."}
      </T>
    </Screen>
  );
}
