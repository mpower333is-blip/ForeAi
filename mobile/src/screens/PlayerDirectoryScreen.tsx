import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen, ScreenHeader, Card, Button, TextField, Stepper } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { RosterPlayer, loadRoster, saveRoster, newId } from "../lib/playerDirectory";

// Manage the device's player directory, and (in "pick" mode) choose players to
// add to an event. Route params:
//   pick?: boolean                       — show checkboxes + "Add N to event"
//   onPick?: (players: RosterPlayer[])   — called with the chosen players
export default function PlayerDirectoryScreen({ navigation, route }: any) {
  const pick: boolean = !!route?.params?.pick;
  const onPick: ((players: RosterPlayer[]) => void) | undefined = route?.params?.onPick;

  const [roster, setRoster] = React.useState<RosterPlayer[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [name, setName] = React.useState("");
  const [hcp, setHcp] = React.useState(18);
  const [team, setTeam] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    loadRoster().then((r) => { setRoster(r); setLoaded(true); });
  }, []);
  const persist = (list: RosterPlayer[]) => {
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    setRoster(sorted);
    saveRoster(sorted).catch(() => {});
  };

  const resetForm = () => { setName(""); setHcp(18); setTeam(""); setEditing(null); };

  const save = () => {
    const nm = name.trim();
    if (!nm) return;
    if (editing) {
      persist(roster.map((p) => (p.id === editing ? { ...p, name: nm, handicap: hcp, team: team.trim() || undefined } : p)));
    } else {
      persist([...roster, { id: newId(), name: nm, handicap: hcp, team: team.trim() || undefined }]);
    }
    resetForm();
  };

  const edit = (p: RosterPlayer) => { setEditing(p.id); setName(p.name); setHcp(p.handicap); setTeam(p.team ?? ""); };
  const remove = (id: string) => { persist(roster.filter((p) => p.id !== id)); if (editing === id) resetForm(); };
  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const addSelected = () => {
    const chosen = roster.filter((p) => selected[p.id]);
    if (chosen.length && onPick) onPick(chosen);
    navigation.goBack();
  };

  const q = query.trim().toLowerCase();
  const shown = q
    ? roster.filter((p) => p.name.toLowerCase().includes(q) || (p.team ?? "").toLowerCase().includes(q))
    : roster;
  const selCount = Object.values(selected).filter(Boolean).length;

  return (
    <Screen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={pick ? "Add players" : "Player directory"}
        subtitle={pick ? "Tick players to add to this event, or add new ones." : "Add players once and reuse them in any event — ideal for school leagues."}
      />

      {/* Add / edit a player */}
      <Card>
        <Text style={styles.formTitle}>{editing ? "Edit player" : "Add a player"}</Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Player name" />
        <Stepper label="Handicap" value={hcp} onChange={setHcp} step={1} min={0} max={54} unit="" />
        <TextField label="Team / school (optional)" value={team} onChangeText={setTeam} placeholder="e.g. Grade 10 A" />
        <Button label={editing ? "Save changes" : "＋ Add to directory"} onPress={save} />
        {editing && <Button variant="ghost" label="Cancel edit" onPress={resetForm} />}
      </Card>

      {/* Search + list */}
      <Card>
        <View style={styles.listHead}>
          <Text style={styles.formTitle}>{roster.length} in directory</Text>
          {pick && selCount > 0 && <Text style={styles.selCount}>{selCount} selected</Text>}
        </View>
        <TextField value={query} onChangeText={setQuery} placeholder="Search by name or team…" />

        {loaded && roster.length === 0 && <Text style={styles.empty}>No players yet. Add players above to build your directory.</Text>}
        {shown.map((p) => (
          <TouchableOpacity
            key={p.id}
            activeOpacity={0.8}
            onPress={() => (pick ? toggle(p.id) : edit(p))}
            style={[styles.row, pick && selected[p.id] && styles.rowOn]}
          >
            {pick && <Text style={styles.check}>{selected[p.id] ? "☑" : "☐"}</Text>}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              {p.team ? <Text style={styles.team}>{p.team}</Text> : null}
            </View>
            <Text style={styles.hcp}>HCP {p.handicap}</Text>
            {!pick && (
              <TouchableOpacity onPress={() => remove(p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.remove}>Delete</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
      </Card>

      {pick && (
        <Button label={selCount ? `Add ${selCount} to event` : "Done"} onPress={addSelected} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  formTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selCount: { color: colors.accent, fontSize: 13, fontWeight: "800" },
  empty: { color: colors.textFaint, fontSize: 14, marginTop: 6 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowOn: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: 6 },
  check: { fontSize: 18, color: colors.accent },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  team: { color: colors.textMuted, fontSize: 13, marginTop: 1 },
  hcp: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  remove: { color: colors.negative, fontSize: 13, fontWeight: "700", marginLeft: 4 },
});
