import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Btn, Chips, Field, Notice, Screen, T, useToast } from "@/components/ui";
import { blockedReason } from "@/lib/contactFilter";
import { dayOptions, meetAt, meetLabel, parseTime } from "@/lib/meetTime";
import { PLAN_ISSUE_MESSAGE, planIssue } from "@/lib/planScreen";
import { personById, useApp } from "@/store/AppStore";

// Meet-up check-in (16 and 17 year olds, when their parent has it on): the place and time go to the parent before meeting.
export default function MeetupCheckin() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const toast = useToast();
  const p = personById(state, id);
  const days = useMemo(() => dayOptions(), []);
  const [place, setPlace] = useState("");
  const [day, setDay] = useState(days[0].label);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const parent = state.guardian.name || "your parent";

  const share = async () => {
    const where = place.trim();
    if (where.length < 2) return toast("Say where you're meeting.");
    const contact = blockedReason(where);
    if (contact) return toast(`That looks like ${contact}. Just the place, please.`);
    const issue = planIssue(where, true);
    if (issue) return toast(PLAN_ISSUE_MESSAGE[issue]);
    const t = parseTime(time);
    if (!t) return toast("Enter a time like 6:30pm.");
    const at = meetAt(days.find(d => d.label === day)!.date, t);
    if (at.getTime() < Date.now() - 60 * 60 * 1000) return toast("That time has already passed.");
    setBusy(true);
    const ok = await actions.shareMeetup(id, where, at.toISOString(), meetLabel(at));
    setBusy(false);
    if (ok) router.back();
  };

  return (
    <Screen title="Where and when" footer={<Btn variant="go" label={busy ? "Sharing…" : `Share with ${parent}`} disabled={busy} onPress={share} />}>
      <T muted>{parent} asked to know where and when you meet {p?.name ?? "them"}. They see the place and time, never your chats.</T>
      <Field label="Where" value={place} onChangeText={setPlace} maxLength={120} placeholder="e.g. Toowong Sports Centre" />
      <View style={{ gap: 8 }}>
        <T variant="label">Day</T>
        <Chips options={days.map(d => d.label)} selected={[day]} onToggle={setDay} />
      </View>
      <Field label="Time" value={time} onChangeText={setTime} placeholder="e.g. 6:30pm" autoCapitalize="none" />
      <Notice>Meet somewhere public the first time. It's fine to bring a friend.</Notice>
    </Screen>
  );
}
