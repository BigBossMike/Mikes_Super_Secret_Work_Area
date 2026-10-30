import { router } from "expo-router";
import { useState } from "react";
import { Btn, Field, Notice, Screen, T } from "@/components/ui";
import { useApp } from "@/store/AppStore";

// Live app only: sign in with an email address and the code Intro emails you.
// Parents sign in the same way, with the email their teen entered.
// Development builds can also use the test mobile numbers (fixed codes, no email).
export default function SignIn() {
  const { actions } = useApp();
  const [address, setAddress] = useState("");
  const [testNumber, setTestNumber] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setError(""); setBusy(true);
    try { setSentTo(await actions.sendSignInCode(address)); }
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

  const ready = testNumber ? address.replace(/\D/g, "").length >= 9 : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address.trim());
  return (
    <Screen title="Sign in" footer={sentTo
      ? <Btn label="Sign in" disabled={busy || code.trim().length < 6} onPress={check} />
      : <Btn label="Email me a code" disabled={busy || !ready} onPress={send} />}>
      <T muted>{testNumber ? "Development build: sign in as one of the test people." : "Sign in with your email. Intro emails you a 6-digit code. Your email is never shown to anyone."}</T>
      {testNumber
        ? <Field label="Test mobile number" value={address} onChangeText={setAddress} keyboardType="phone-pad" placeholder="0491 570 106" editable={!sentTo} />
        : <Field label="Email" value={address} onChangeText={setAddress} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="you@example.com" editable={!sentTo} autoComplete="email" />}
      {sentTo && <Field label="The code we sent you" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" autoComplete="one-time-code" maxLength={6} />}
      {sentTo && <T variant="small">Sent to {sentTo}. Check your junk folder if it's not there in a minute. <T variant="small" style={{ textDecorationLine: "underline" }} onPress={() => { setSentTo(null); setCode(""); }}>Wrong {testNumber ? "number" : "email"}?</T></T>}
      {error ? <Notice kind="warn">{error}</Notice> : null}
      {__DEV__ && !sentTo && <T variant="small" style={{ textDecorationLine: "underline" }} onPress={() => { setTestNumber(!testNumber); setAddress(""); }}>{testNumber ? "Use an email instead" : "Use a test number (development only)"}</T>}
    </Screen>
  );
}
