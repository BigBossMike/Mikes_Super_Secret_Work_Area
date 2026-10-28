import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { Btn, Chips, Field, Screen, T, useToast } from "@/components/ui";
import { ageBand, bandLabel } from "@/lib/age";
import { GROUPS, OBJECTIVE_TYPES } from "@/lib/data";
import { PLAN_ISSUE_MESSAGE, planIssue } from "@/lib/planScreen";
import { useApp } from "@/store/AppStore";

export default function NewObjective() {
  const { state, actions } = useApp();
  const toast = useToast();
  const d = state.draft;
  useEffect(() => { actions.prepareDraft(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const typeLabel = OBJECTIVE_TYPES.find(t => t.id === d.type)?.label ?? "";

  const submit = () => {
    if (d.text.trim().length < 8) return toast("Say a bit more about the plan.");
    // Same check the server makes (lib/planScreen.ts), so the reason shows straight away.
    const issue = planIssue([d.text, d.when, d.where].join(" "), actions.isMinor());
    if (issue) return toast(PLAN_ISSUE_MESSAGE[issue]);
    actions.submitObjective();
    router.replace("/searching");
  };

  return (
    <Screen title="New objective" footer={<Btn variant="go" label="Find people" onPress={submit} />}>
      <View style={{ gap: 8 }}>
        <T variant="label">What kind of thing?</T>
        <Chips options={OBJECTIVE_TYPES.map(t => t.label)} selected={[typeLabel]} onToggle={l => actions.pickType(OBJECTIVE_TYPES.find(t => t.label === l)!.id)} />
      </View>
      <Field label="What's the plan?" multiline maxLength={120} value={d.text} onChangeText={text => actions.setDraft({ text })} placeholder="e.g. A fifth player for Tuesday five-a-side" />
      <Field label="When" value={d.when} onChangeText={when => actions.setDraft({ when })} placeholder="e.g. Saturday afternoon" />
      <Field label="Where" value={d.where} onChangeText={where => actions.setDraft({ where })} placeholder="e.g. Toowong" />
      <View style={{ gap: 8 }}>
        <T variant="label">Who'll be there?</T>
        <Chips options={GROUPS} selected={[GROUPS[d.group]]} onToggle={g => actions.setDraft({ group: GROUPS.indexOf(g) })} />
        <T variant="small">The people we ask see this, so nobody walks into a surprise group.</T>
      </View>
      <T variant="small">
        Intro asks up to 5 people in your age group ({bandLabel(ageBand(state.user.age ?? 17))}). They see your first name, photo and this plan. Nobody else does.
        {actions.isMinor() && state.guardian.approveObjectives ? ` ${state.guardian.name} gets a quick request to OK it first.` : ""}
      </T>
    </Screen>
  );
}
