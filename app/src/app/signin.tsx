import { router } from "expo-router";
import { useState } from "react";
import { Btn, Field, Notice, Screen, T } from "@/components/ui";
import { useApp } from "@/store/AppStore";

// Live app only: sign in with a mobile number and the code Intro texts you.
// Parents sign in the same way, which is how they claim a teen's invite.
export default function SignIn() {
  const { actions } = useApp();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setError(""); setBusy(true);
    try { setSentTo(await actions.sendSignInCode(phone)); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't send the code. Try again."); }
    setBusy(false);
  };

  const check = async () => {
    if (!sentTo) return;
    setError(""); setBusy(true);
    try {
      const { hasProfile, isParent } = await actions.checkSignInCode(sentTo, code);
      // A parent with no profile of their own goes to the parent screen.
      router.replace(hasProfile ? "/home" : isParent ? "/parent-home" : "/verify");
    } catch (e) { setError(e instanceof Error ? e.message : "That code didn't work. Try again."); }
    setBusy(false);
  };

  return (
    <Screen title="Sign in" footer={sentTo
      ? <Btn label="Sign in" disabled={busy || code.trim().length < 4} onPress={check} />
      : <Btn label="Text me a code" disabled={busy || phone.replace(/\D/g, "").length < 9} onPress={send} />}>
      <T muted>Your mobile number is how you sign in. It's never shown to anyone until you've met them in person.</T>
      <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0412 345 678" editable={!sentTo} autoComplete="tel" />
      {sentTo && <Field label="The code we texted you" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" autoComplete="sms-otp" />}
      {sentTo && <T variant="small">Sent to {sentTo}. <T variant="small" style={{ textDecorationLine: "underline" }} onPress={() => { setSentTo(null); setCode(""); }}>Wrong number?</T></T>}
      {error ? <Notice kind="warn">{error}</Notice> : null}
    </Screen>
  );
}
