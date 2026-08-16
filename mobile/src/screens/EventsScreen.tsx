import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image } from "react-native";
import { Screen, ScreenHeader, Card, Button, Segmented, Stepper, TextField, EmptyState } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { COURSES, getCourse, searchCourses, hasCourse } from "../data/courses";
import {
  searchOnline,
  fetchCourse,
  ensureCourse,
  isConfigured as apiConfigured,
  isOnlineCourseId,
  CourseSummary,
} from "../services/golfCourseApi";
import { useTournament } from "../state/TournamentContext";
import { useProfile } from "../state/ProfileContext";
import {
  TEvent,
  EventFormat,
  ContestType,
  groupTeeTime,
  groupThru,
  leaderboard,
  formatToPar,
  contestLeader,
  contestName,
  contestUnit,
  currentHole,
  teamStandings,
  teamCaptain,
  shotgunStartHole,
  SponsorTier,
  sponsorTierLabel,
} from "../lib/tournament";

function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Bundled sponsor/organizer logos shown at the top of an event page. Drop a new
// PNG in assets and add it here to brand another event.
const EVENT_LOGOS: Record<string, any> = {
  ecs: require("../../assets/ecs-logo.png"),
};

export default function EventsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (selectedId) {
    return <EventDetail eventId={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <EventList onOpen={setSelectedId} />;
}

// ---------------------------------------------------------------------------
// Event list + create
// ---------------------------------------------------------------------------

function EventList({ onOpen }: { onOpen: (id: string) => void }) {
  const { events, createEvent, createEcsGolfDay, createEcsGolfDayLive, createSharedEvent, joinByCode } =
    useTournament();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [format, setFormat] = useState<EventFormat>("stroke");
  const [firstTee, setFirstTee] = useState(8 * 60);
  const [interval, setInterval] = useState(10);
  const [shared, setShared] = useState(true);
  const [shotgun, setShotgun] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [onlineCourses, setOnlineCourses] = useState<CourseSummary[]>([]);
  const [courseSearching, setCourseSearching] = useState(false);
  const [courseLoadingId, setCourseLoadingId] = useState<string | null>(null);

  const apiOn = apiConfigured();
  const selectedCourse = getCourse(courseId);
  const courseResults = searchCourses(courseQuery).slice(0, 6);

  // Debounced online course search for events.
  useEffect(() => {
    if (!apiOn || courseQuery.trim().length < 2) {
      setOnlineCourses([]);
      return;
    }
    let cancelled = false;
    setCourseSearching(true);
    const t = setTimeout(async () => {
      const res = await searchOnline(courseQuery);
      if (!cancelled) {
        setOnlineCourses(res.slice(0, 8));
        setCourseSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [courseQuery, apiOn]);

  const pickOnlineCourse = async (apiId: string) => {
    setCourseLoadingId(apiId);
    const course = await fetchCourse(apiId);
    setCourseLoadingId(null);
    if (course) {
      setCourseId(course.id);
      setCourseQuery("");
      setOnlineCourses([]);
    }
  };

  const create = async () => {
    setError("");
    const input = {
      name: name.trim() || "Golf Day",
      courseId,
      format,
      firstTeeMin: firstTee,
      intervalMin: interval,
      date: "",
      shotgun,
    };
    if (shared) {
      setBusy(true);
      const ev = await createSharedEvent(input);
      setBusy(false);
      if (!ev) {
        setError("Couldn't reach the server. Check the connection or create a local event instead.");
        return;
      }
      finishCreate(ev.id);
    } else {
      finishCreate(createEvent(input).id);
    }
  };

  const finishCreate = (id: string) => {
    setCreating(false);
    setName("");
    onOpen(id);
  };

  // One tap: create the ECS Golf Day on the backend (with a join code) + branding.
  const loadEcsLive = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    const ev = await createEcsGolfDayLive();
    setBusy(false);
    if (ev) onOpen(ev.id);
    else
      setError(
        "Couldn't reach the backend to create a live event. Check your connection and try again — or load the offline demo below."
      );
  };

  const join = async () => {
    setError("");
    setBusy(true);
    const ev = await joinByCode(joinCode);
    setBusy(false);
    if (!ev) {
      setError("No event found for that code (or the server is unreachable).");
      return;
    }
    setJoining(false);
    setJoinCode("");
    onOpen(ev.id);
  };

  return (
    <Screen>
      <ScreenHeader title="Events" subtitle="Run a tournament or a golf day — players, tee times, live scoring." />

      {!creating && !joining && (
        <>
          <View style={styles.formRow}>
            <Button label="+ New event" onPress={() => setCreating(true)} style={{ flex: 1 }} />
            <Button label="Join by code" variant="ghost" onPress={() => setJoining(true)} style={{ flex: 1 }} />
          </View>
          {events.length === 0 && (
            <>
              <Button
                label={busy ? "Creating…" : "🏁 Create the ECS Golf Day (gets a join code)"}
                onPress={loadEcsLive}
              />
              <Button
                label="💚 Load ECS demo (offline, no code)"
                variant="ghost"
                onPress={() => onOpen(createEcsGolfDay().id)}
              />
            </>
          )}
        </>
      )}

      {error !== "" && (
        <Card>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      )}

      {joining && (
        <Card>
          <Text style={styles.formTitle}>Join an event</Text>
          <Text style={styles.hint}>Enter the code the organizer shared with you.</Text>
          <TextField
            label="Join code"
            value={joinCode}
            onChangeText={(v) => setJoinCode(v.toUpperCase())}
            placeholder="ABC123"
          />
          <View style={styles.formRow}>
            <Button label={busy ? "Joining…" : "Join"} onPress={join} style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={() => setJoining(false)} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {creating && (
        <Card>
          <Text style={styles.formTitle}>New event</Text>
          <TextField label="Event name" value={name} onChangeText={setName} placeholder="Saturday Cup" />

          <Text style={styles.fieldLabel}>Course — {selectedCourse.name}</Text>
          <TextField
            value={courseQuery}
            onChangeText={setCourseQuery}
            placeholder={apiOn ? "Search any course worldwide…" : "Search SA courses"}
          />

          {apiOn && courseQuery.trim().length >= 2 && (
            <>
              <View style={styles.onlineHead}>
                <Text style={styles.onlineLabel}>Online</Text>
                {courseSearching && <ActivityIndicator size="small" color={colors.accent} />}
              </View>
              {onlineCourses.map((c) => (
                <TouchableOpacity
                  key={c.apiId}
                  onPress={() => pickOnlineCourse(c.apiId)}
                  activeOpacity={0.8}
                  style={styles.courseRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName}>{c.name}</Text>
                    <Text style={styles.coursePar}>{c.location}</Text>
                  </View>
                  {courseLoadingId === c.apiId ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={styles.realTag}>real card</Text>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          {courseResults.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setCourseId(c.id)}
              activeOpacity={0.8}
              style={[styles.courseRow, courseId === c.id && styles.courseRowActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.courseName}>{c.name}</Text>
                <Text style={styles.coursePar}>{c.location}</Text>
              </View>
              <Text style={styles.coursePar}>Par {c.par}</Text>
            </TouchableOpacity>
          ))}

          <View style={{ height: spacing.md }} />
          <Segmented
            label="Format"
            options={[
              { key: "stroke", label: "Stroke" },
              { key: "stableford", label: "Stableford" },
              { key: "scramble", label: "Scramble (teams)" },
            ]}
            value={format}
            onChange={setFormat}
          />
          <Segmented
            label="Start"
            options={[
              { key: "sequential", label: "Tee times" },
              { key: "shotgun", label: "Shotgun" },
            ]}
            value={shotgun ? "shotgun" : "sequential"}
            onChange={(v) => setShotgun(v === "shotgun")}
          />
          <Stepper
            label={shotgun ? `Shotgun time — ${hhmm(firstTee)}` : `First tee — ${hhmm(firstTee)}`}
            value={firstTee}
            onChange={setFirstTee}
            step={5}
            min={5 * 60}
            max={18 * 60}
            unit=""
          />
          {!shotgun && (
            <Stepper label="Tee interval" value={interval} onChange={setInterval} step={1} min={6} max={15} unit="min" />
          )}
          {shotgun && (
            <Text style={styles.hint}>
              Every group tees off at {hhmm(firstTee)} on a different hole (group 1 → hole 1, group 2
              → hole 2 …).
            </Text>
          )}

          <Segmented
            label="Type"
            options={[
              { key: "shared", label: "Shared (multi-device)" },
              { key: "local", label: "Local only" },
            ]}
            value={shared ? "shared" : "local"}
            onChange={(v) => setShared(v === "shared")}
          />
          <Text style={styles.hint}>
            {shared
              ? "Players join from their own phones with a code and scores sync live."
              : "Everything stays on this device — good with no signal."}
          </Text>

          <View style={styles.formRow}>
            <Button label={busy ? "Creating…" : "Create"} onPress={create} style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={() => setCreating(false)} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {events.length === 0 && !creating && (
        <EmptyState
          emoji="🏆"
          title="No golf days yet"
          body="Create one to register players, set tee times, and follow everyone live as they move around the course."
          actionLabel="+ New event"
          onAction={() => setCreating(true)}
        />
      )}

      {events.map((e) => {
        const course = getCourse(e.courseId);
        return (
          <TouchableOpacity key={e.id} activeOpacity={0.85} onPress={() => onOpen(e.id)}>
            <Card>
              <View style={styles.cardTitleRow}>
                <Text style={styles.eventName}>{e.name}</Text>
                {e.remote ? (
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>{e.code}</Text>
                  </View>
                ) : (
                  <View style={styles.localBadge}>
                    <Text style={styles.localBadgeText}>local</Text>
                  </View>
                )}
              </View>
              <Text style={styles.eventMeta}>
                {course.name} • {e.format === "stroke" ? "Stroke play" : "Stableford"}
              </Text>
              <Text style={styles.eventMeta}>
                {e.players.length} players • {e.groups.length} groups • first tee {hhmm(e.firstTeeMin)}
              </Text>
            </Card>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Event detail (Players / Tee times / Live)
// ---------------------------------------------------------------------------

type Tab = "players" | "tees" | "live" | "games" | "sponsors";

function EventDetail({ eventId, onBack }: { eventId: string; onBack: () => void }) {
  const t = useTournament();
  const event = t.getEvent(eventId);
  const [tab, setTab] = useState<Tab>("players");
  const [, setCourseReady] = useState(0);
  const isRemote = !!event?.remote;

  // Poll the server so every device sees live changes.
  useEffect(() => {
    if (!isRemote) return;
    const iv = setInterval(() => {
      t.refreshEvent(eventId);
    }, 6000);
    return () => clearInterval(iv);
  }, [isRemote, eventId]);

  // If this event's course came from the online database, make sure THIS device
  // has its real card too (so pars/leaderboard are correct after joining).
  const eventCourseId = event?.courseId;
  useEffect(() => {
    if (eventCourseId && isOnlineCourseId(eventCourseId) && !hasCourse(eventCourseId)) {
      ensureCourse(eventCourseId).then((ok) => ok && setCourseReady((x) => x + 1));
    }
  }, [eventCourseId]);

  if (!event) {
    return (
      <Screen>
        <Button label="‹ Back" variant="ghost" onPress={onBack} />
        <Text style={styles.empty}>Event not found.</Text>
      </Screen>
    );
  }

  const course = getCourse(event.courseId);

  return (
    <Screen>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>‹ Events</Text>
      </TouchableOpacity>
      {(() => {
        // Local events carry a logoKey; shared events (from the backend) don't,
        // so fall back to matching the event name.
        const logo = EVENT_LOGOS[event.logoKey ?? ""] ?? (/\becs\b/i.test(event.name) ? EVENT_LOGOS.ecs : null);
        return logo ? (
          <View style={styles.eventLogoWrap}>
            <Image source={logo} style={styles.eventLogo} resizeMode="contain" />
          </View>
        ) : null;
      })()}
      <Text style={styles.detailTitle}>{event.name}</Text>
      <Text style={styles.detailMeta}>
        {course.name} • Par {course.par} • {formatLabel(event.format)}
        {event.shotgun ? " • Shotgun" : ""}
      </Text>

      {event.remote && (
        <Card accent>
          <View style={styles.codeRow}>
            <View>
              <Text style={styles.codeLabel}>JOIN CODE</Text>
              <Text style={styles.codeBig}>{event.code}</Text>
            </View>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>Live sync</Text>
            </View>
          </View>
          <Text style={styles.hint}>Share this code — players join from their own phones.</Text>
        </Card>
      )}

      {event.cause ? (
        <Card accent>
          <Text style={styles.causeHeart}>💚 Fundraiser</Text>
          <Text style={styles.causeText}>{event.cause}</Text>
        </Card>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={{ gap: 8 }}
      >
        {(["players", "tees", "live", "games", "sponsors"] as Tab[]).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setTab(k)}
            style={[styles.tab, tab === k && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {k === "players" ? "Players" : k === "tees" ? "Tees" : k === "live" ? "Live" : k === "games" ? "Games" : "Sponsors"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === "players" && <PlayersTab event={event} />}
      {tab === "tees" && <TeesTab event={event} />}
      {tab === "live" && <LiveTab event={event} />}
      {tab === "games" && <GamesTab event={event} />}
      {tab === "sponsors" && <SponsorsTab event={event} />}
    </Screen>
  );
}

function PlayersTab({ event }: { event: TEvent }) {
  const { addPlayer, removePlayer, registerSelf, myPlayerId } = useTournament();
  const { name: profileName, handicap: profileHcp } = useProfile();
  const [name, setName] = useState("");
  const [hcp, setHcp] = useState(18);
  const [meName, setMeName] = useState(profileName);
  const [meHcp, setMeHcp] = useState(profileHcp);
  const [busy, setBusy] = useState(false);

  const meId = myPlayerId(event.id);

  const add = () => {
    if (!name.trim()) return;
    addPlayer(event.id, name.trim(), hcp);
    setName("");
    setHcp(18);
  };

  const joinAsSelf = async () => {
    if (!meName.trim()) return;
    setBusy(true);
    await registerSelf(event.id, meName.trim(), meHcp);
    setBusy(false);
    setMeName("");
  };

  return (
    <>
      {event.remote && !meId && (
        <Card accent>
          <Text style={styles.formTitle}>Join as a player</Text>
          <Text style={styles.hint}>Add yourself to this event from your phone.</Text>
          <TextField label="Your name" value={meName} onChangeText={setMeName} placeholder="You" />
          <Stepper label="Your handicap" value={meHcp} onChange={setMeHcp} step={1} min={0} max={54} unit="" />
          <Button label={busy ? "Joining…" : "Register me"} onPress={joinAsSelf} />
        </Card>
      )}

      <Card>
        <Text style={styles.formTitle}>{event.remote ? "Add another player" : "Register player"}</Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Player name" />
        <Stepper label="Handicap" value={hcp} onChange={setHcp} step={1} min={0} max={54} unit="" />
        <Button label="Add player" onPress={add} />
      </Card>

      <Card>
        <Text style={styles.formTitle}>{event.players.length} registered</Text>
        {event.players.length === 0 && <Text style={styles.empty}>No players yet.</Text>}
        {event.players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <Text style={styles.playerName}>
              {p.name}
              {p.id === meId ? <Text style={styles.youTag}>  you</Text> : null}
            </Text>
            <View style={styles.playerRight}>
              <Text style={styles.playerHcp}>HCP {p.handicap}</Text>
              <TouchableOpacity onPress={() => removePlayer(event.id, p.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function TeesTab({ event }: { event: TEvent }) {
  const { addGroup, removeGroup, togglePlayerInGroup, updateEvent } = useTournament();
  const assigned = new Set(event.groups.flatMap((g) => g.playerIds));
  const unassigned = event.players.filter((p) => !assigned.has(p.id));

  return (
    <>
      <Card>
        <Text style={styles.formTitle}>Tee sheet</Text>
        <Stepper
          label={`First tee — ${hhmm(event.firstTeeMin)}`}
          value={event.firstTeeMin}
          onChange={(v) => updateEvent(event.id, { firstTeeMin: v })}
          step={5}
          min={5 * 60}
          max={18 * 60}
          unit=""
        />
        <Stepper
          label="Interval"
          value={event.intervalMin}
          onChange={(v) => updateEvent(event.id, { intervalMin: v })}
          step={1}
          min={6}
          max={15}
          unit="min"
        />
        <Button label="+ Add group" onPress={() => addGroup(event.id)} />
      </Card>

      {unassigned.length > 0 && (
        <Card>
          <Text style={styles.hint}>
            Unassigned: {unassigned.map((p) => p.name).join(", ")}. Tap a player below to add them to
            a group.
          </Text>
        </Card>
      )}

      {event.groups.map((g, i) => (
        <Card key={g.id}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTime}>
              {event.shotgun
                ? `⛳ Group ${i + 1} · Start hole ${shotgunStartHole(i)}`
                : `⛳ ${groupTeeTime(event, i)}`}
            </Text>
            <TouchableOpacity onPress={() => removeGroup(event.id, g.id)}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            {event.format === "scramble" ? "Team " + (i + 1) + " · tap players to add/remove" : "Tap players to add/remove from this group"}
          </Text>
          <View style={styles.chipWrap}>
            {event.players.map((p) => {
              const inGroup = g.playerIds.includes(p.id);
              const elsewhere = !inGroup && assigned.has(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => togglePlayerInGroup(event.id, g.id, p.id)}
                  style={[
                    styles.chip,
                    inGroup && styles.chipActive,
                    elsewhere && styles.chipDisabled,
                  ]}
                >
                  <Text style={[styles.chipText, inGroup && styles.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      ))}

      {event.groups.length === 0 && (
        <Card>
          <Text style={styles.empty}>No groups yet. Add a group to build the tee sheet.</Text>
        </Card>
      )}
    </>
  );
}

function LiveTab({ event }: { event: TEvent }) {
  const { setScore } = useTournament();
  const course = getCourse(event.courseId);
  const [scoringGroup, setScoringGroup] = useState<string | null>(null);
  const isScramble = event.format === "scramble";

  return (
    <>
      <Card>
        <Text style={styles.formTitle}>On the course</Text>
        {event.groups.length === 0 && <Text style={styles.empty}>Set up groups in the Tees tab.</Text>}
        {event.groups.map((g, i) => {
          const hole = currentHole(event, g, i);
          const names = g.playerIds
            .map((id) => event.players.find((p) => p.id === id)?.name)
            .filter(Boolean)
            .join(", ");
          const teeLabel = event.shotgun
            ? `Start hole ${shotgunStartHole(i)}`
            : `Off at ${groupTeeTime(event, i)}`;
          const captain = teamCaptain(g);
          const teamThru = isScramble && captain ? Object.keys(event.scores[captain] ?? {}).length : 0;
          return (
            <TouchableOpacity
              key={g.id}
              activeOpacity={0.85}
              onPress={() => setScoringGroup(scoringGroup === g.id ? null : g.id)}
            >
              <View style={styles.liveGroup}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveNames}>
                    {isScramble ? `Team ${i + 1}: ` : ""}
                    {names || "(no players)"}
                  </Text>
                  <Text style={styles.liveTee}>{teeLabel}</Text>
                </View>
                <View style={styles.liveRight}>
                  {hole === null ? (
                    <Text style={styles.liveFinished}>Finished</Text>
                  ) : (
                    <>
                      <Text style={styles.liveHole}>Hole {hole}</Text>
                      {isScramble && <Text style={styles.liveThru}>thru {teamThru}</Text>}
                    </>
                  )}
                </View>
              </View>
              {scoringGroup === g.id && hole !== null && (
                isScramble ? (
                  <TeamScoreEntry
                    event={event}
                    group={g}
                    hole={hole}
                    course={course}
                    onScore={(strokes) => {
                      const cap = teamCaptain(g);
                      if (cap) setScore(event.id, cap, hole, strokes);
                    }}
                  />
                ) : (
                  <ScoreEntry
                    event={event}
                    groupId={g.id}
                    hole={hole}
                    course={course}
                    onScore={(pid, strokes) => setScore(event.id, pid, hole, strokes)}
                  />
                )
              )}
            </TouchableOpacity>
          );
        })}
      </Card>

      {isScramble ? <TeamBoard event={event} /> : <IndividualBoard event={event} course={course} />}
    </>
  );
}

function IndividualBoard({ event, course }: { event: TEvent; course: ReturnType<typeof getCourse> }) {
  const board = leaderboard(event, course);
  return (
    <Card>
      <Text style={styles.formTitle}>Leaderboard</Text>
      <View style={styles.lbHead}>
        <Text style={[styles.lbCell, styles.lbPos]}>#</Text>
        <Text style={[styles.lbCell, { flex: 1 }]}>Player</Text>
        <Text style={[styles.lbCell, styles.lbNum]}>Thru</Text>
        <Text style={[styles.lbCell, styles.lbNum]}>{event.format === "stableford" ? "Pts" : "Score"}</Text>
      </View>
      {board.length === 0 && <Text style={styles.empty}>No players registered.</Text>}
      {board.map((s, i) => (
        <View key={s.player.id} style={styles.lbRow}>
          <Text style={[styles.lbCell, styles.lbPos]}>{s.thru > 0 ? i + 1 : "-"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.lbName}>{s.player.name}</Text>
            <Text style={styles.lbHcp}>HCP {s.player.handicap}</Text>
          </View>
          <Text style={[styles.lbCell, styles.lbNum, styles.lbMuted]}>{s.thru > 0 ? s.thru : "-"}</Text>
          <Text style={[styles.lbCell, styles.lbNum, styles.lbScore]}>
            {s.thru === 0 ? "-" : event.format === "stableford" ? s.stableford : formatToPar(s.toPar)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

function TeamBoard({ event }: { event: TEvent }) {
  const rows = teamStandings(event);
  return (
    <Card>
      <Text style={styles.formTitle}>Team leaderboard</Text>
      <View style={styles.lbHead}>
        <Text style={[styles.lbCell, styles.lbPos]}>#</Text>
        <Text style={[styles.lbCell, { flex: 1 }]}>Team</Text>
        <Text style={[styles.lbCell, styles.lbNum]}>Thru</Text>
        <Text style={[styles.lbCell, styles.lbNum]}>Score</Text>
      </View>
      {rows.length === 0 && <Text style={styles.empty}>No teams yet.</Text>}
      {rows.map((r, i) => (
        <View key={r.group.id} style={styles.lbRow}>
          <Text style={[styles.lbCell, styles.lbPos]}>{r.thru > 0 ? i + 1 : "-"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.lbName}>Team {r.index + 1}</Text>
            <Text style={styles.lbHcp}>{r.names || "no players"}</Text>
          </View>
          <Text style={[styles.lbCell, styles.lbNum, styles.lbMuted]}>{r.thru > 0 ? r.thru : "-"}</Text>
          <Text style={[styles.lbCell, styles.lbNum, styles.lbScore]}>{r.thru > 0 ? r.gross : "-"}</Text>
        </View>
      ))}
    </Card>
  );
}

function formatLabel(f: string): string {
  return f === "stroke" ? "Stroke play" : f === "stableford" ? "Stableford" : "4-Ball Scramble";
}

function ScoreEntry({
  event,
  groupId,
  hole,
  course,
  onScore,
}: {
  event: TEvent;
  groupId: string;
  hole: number;
  course: ReturnType<typeof getCourse>;
  onScore: (playerId: string, strokes: number) => void;
}) {
  const group = event.groups.find((g) => g.id === groupId);
  const holeInfo = course.holes[hole - 1];
  if (!group) return null;

  return (
    <View style={styles.scoreBox}>
      <Text style={styles.scoreTitle}>
        Hole {hole} • Par {holeInfo.par} • {holeInfo.yards} yds
      </Text>
      {group.playerIds.map((pid) => {
        const player = event.players.find((p) => p.id === pid);
        if (!player) return null;
        const current = event.scores[pid]?.[hole] ?? holeInfo.par;
        return (
          <View key={pid} style={styles.scorePlayer}>
            <Text style={styles.scoreName}>{player.name}</Text>
            <View style={styles.scoreControls}>
              <TouchableOpacity
                style={styles.scoreBtn}
                onPress={() => onScore(pid, Math.max(1, current - 1))}
              >
                <Text style={styles.scoreBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.scoreVal}>{current}</Text>
              <TouchableOpacity
                style={styles.scoreBtn}
                onPress={() => onScore(pid, Math.min(15, current + 1))}
              >
                <Text style={styles.scoreBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      <Text style={styles.scoreHint}>
        Set each score to record the hole. The group advances automatically once everyone has a
        score.
      </Text>
    </View>
  );
}

function TeamScoreEntry({
  event,
  group,
  hole,
  course,
  onScore,
}: {
  event: TEvent;
  group: TEvent["groups"][number];
  hole: number;
  course: ReturnType<typeof getCourse>;
  onScore: (strokes: number) => void;
}) {
  const holeInfo = course.holes[hole - 1];
  const cap = teamCaptain(group);
  const current = (cap ? event.scores[cap]?.[hole] : undefined) ?? holeInfo.par;
  return (
    <View style={styles.scoreBox}>
      <Text style={styles.scoreTitle}>
        Hole {hole} • Par {holeInfo.par} • {holeInfo.yards} yds
      </Text>
      <View style={styles.scorePlayer}>
        <Text style={styles.scoreName}>Team score</Text>
        <View style={styles.scoreControls}>
          <TouchableOpacity style={styles.scoreBtn} onPress={() => onScore(Math.max(1, current - 1))}>
            <Text style={styles.scoreBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.scoreVal}>{current}</Text>
          <TouchableOpacity style={styles.scoreBtn} onPress={() => onScore(current + 1)}>
            <Text style={styles.scoreBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.scoreHint}>
        Enter the team's best-ball score for the hole. The team advances automatically.
      </Text>
    </View>
  );
}

function GamesTab({ event }: { event: TEvent }) {
  const { addContest, removeContest, setContestResult } = useTournament();
  const [type, setType] = useState<ContestType>("closest");
  const [hole, setHole] = useState(3);
  const [openId, setOpenId] = useState<string | null>(null);
  const contests = event.contests ?? [];

  return (
    <>
      <Card>
        <Text style={styles.formTitle}>Add a side game</Text>
        <Segmented
          label="Game"
          options={[
            { key: "closest", label: "Closest to Pin" },
            { key: "longest", label: "Longest Drive" },
          ]}
          value={type}
          onChange={setType}
        />
        <Stepper label="On hole" value={hole} onChange={setHole} step={1} min={1} max={18} unit="" />
        <Button label="Add game" onPress={() => addContest(event.id, type, hole)} />
      </Card>

      {contests.length === 0 && (
        <Card>
          <Text style={styles.empty}>
            No side games yet. Add closest-to-the-pin on the par-3s or a longest-drive hole.
          </Text>
        </Card>
      )}

      {contests.map((c) => {
        const leader = contestLeader(event, c);
        const open = openId === c.id;
        const step = c.type === "closest" ? 1 : 5;
        return (
          <Card key={c.id}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpenId(open ? null : c.id)}>
              <View style={styles.groupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contestName}>{contestName(c)}</Text>
                  <Text style={styles.hint}>Hole {c.hole} · {contestUnit(c)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeContest(event.id, c.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            <Text style={styles.leaderLine}>
              {leader ? `🏆 ${leader.player.name} — ${leader.value} yds` : "No results in yet"}
            </Text>

            {open && (
              <View style={styles.scoreBox}>
                <Text style={styles.scoreTitle}>Tap ± to record each player's {contestUnit(c)}</Text>
                {event.players.length === 0 && <Text style={styles.empty}>Register players first.</Text>}
                {event.players.map((p) => {
                  const val = event.contestResults?.[c.id]?.[p.id] ?? 0;
                  return (
                    <View key={p.id} style={styles.scorePlayer}>
                      <Text style={styles.scoreName}>{p.name}</Text>
                      <View style={styles.scoreControls}>
                        <TouchableOpacity
                          style={styles.scoreBtn}
                          onPress={() => setContestResult(event.id, c.id, p.id, Math.max(0, val - step))}
                        >
                          <Text style={styles.scoreBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.scoreVal}>{val || "–"}</Text>
                        <TouchableOpacity
                          style={styles.scoreBtn}
                          onPress={() => setContestResult(event.id, c.id, p.id, val + step)}
                        >
                          <Text style={styles.scoreBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        );
      })}
    </>
  );
}

function SponsorsTab({ event }: { event: TEvent }) {
  const { addSponsor, removeSponsor, updateEvent } = useTournament();
  const [name, setName] = useState("");
  const [tier, setTier] = useState<SponsorTier>("hole");
  const [hole, setHole] = useState(1);
  const [cause, setCause] = useState(event.cause ?? "");

  const sponsors = event.sponsors ?? [];
  const add = () => {
    if (!name.trim()) return;
    addSponsor(event.id, name.trim(), tier, tier === "hole" ? hole : undefined);
    setName("");
  };

  const tiers: SponsorTier[] = ["title", "hole", "prize", "general"];

  return (
    <>
      <Card>
        <Text style={styles.formTitle}>The cause</Text>
        <Text style={styles.hint}>
          Who this golf day supports — shown across the app and on the clubhouse board.
        </Text>
        <TextField
          label="Cause / beneficiary"
          value={cause}
          onChangeText={setCause}
          placeholder="Supporting Lyla Roux in her fight against ALK+ ALCL"
        />
        <Button label="Save cause" onPress={() => updateEvent(event.id, { cause })} />
      </Card>

      <Card>
        <Text style={styles.formTitle}>Add a sponsor</Text>
        <TextField label="Sponsor name" value={name} onChangeText={setName} placeholder="e.g. Engine Control Systems" />
        <Segmented
          label="Type"
          options={[
            { key: "title", label: "Title" },
            { key: "hole", label: "Hole" },
            { key: "prize", label: "Prize" },
            { key: "general", label: "General" },
          ]}
          value={tier}
          onChange={setTier}
        />
        {tier === "hole" && <Stepper label="Hole" value={hole} onChange={setHole} step={1} min={1} max={18} unit="" />}
        <Button label="Add sponsor" onPress={add} />
      </Card>

      {sponsors.length === 0 && (
        <Card>
          <Text style={styles.empty}>No sponsors yet. Add title, hole and prize sponsors to thank them.</Text>
        </Card>
      )}

      {tiers.map((t) => {
        const list = sponsors.filter((s) => s.tier === t);
        if (!list.length) return null;
        return (
          <Card key={t}>
            <Text style={styles.formTitle}>{sponsorTierLabel(t)}s</Text>
            {list.map((s) => (
              <View key={s.id} style={styles.playerRow}>
                <Text style={styles.playerName}>
                  {s.name}
                  {s.tier === "hole" && s.hole ? <Text style={styles.hint}>{`  ·  Hole ${s.hole}`}</Text> : null}
                </Text>
                <TouchableOpacity onPress={() => removeSponsor(event.id, s.id)}>
                  <Text style={styles.remove}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  formTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: spacing.sm },
  fieldLabel: { color: colors.textMuted, fontSize: 14, marginBottom: 8 },
  formRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  empty: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.textFaint, fontSize: 13, marginBottom: spacing.sm },

  courseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  courseRowActive: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  courseName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  coursePar: { color: colors.textMuted, fontSize: 14 },
  onlineHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  onlineLabel: { color: colors.textFaint, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  realTag: { color: colors.accent, fontSize: 12, fontWeight: "600", marginLeft: spacing.sm },

  eventName: { color: colors.text, fontSize: 20, fontWeight: "800" },
  eventMeta: { color: colors.textMuted, fontSize: 14, marginTop: 3 },

  back: { color: colors.accent, fontSize: 16, marginBottom: spacing.sm },
  eventLogoWrap: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  eventLogo: { width: 240, height: 70 },
  detailTitle: { color: colors.text, fontSize: 28, fontWeight: "800" },
  detailMeta: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.md },

  tabs: { marginBottom: spacing.md },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  causeHeart: { color: colors.accent, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  causeText: { color: colors.text, fontSize: 16, fontWeight: "600", lineHeight: 22, marginTop: 4 },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "700" },
  tabTextActive: { color: "#062012" },

  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  playerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  playerHcp: { color: colors.textMuted, fontSize: 14 },
  remove: { color: colors.negative, fontSize: 14, fontWeight: "600" },

  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  groupTime: { color: colors.accent, fontSize: 18, fontWeight: "800" },
  contestName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  leaderLine: { color: colors.accent, fontSize: 15, fontWeight: "600", marginTop: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: "#062012" },

  liveGroup: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  liveNames: { color: colors.text, fontSize: 16, fontWeight: "600" },
  liveTee: { color: colors.textFaint, fontSize: 13, marginTop: 2 },
  liveRight: { alignItems: "flex-end" },
  liveHole: { color: colors.accent, fontSize: 18, fontWeight: "800" },
  liveThru: { color: colors.textFaint, fontSize: 12 },
  liveFinished: { color: colors.positive, fontSize: 15, fontWeight: "700" },

  scoreBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scoreTitle: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: spacing.sm },
  scorePlayer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  scoreName: { color: colors.text, fontSize: 16 },
  scoreControls: { flexDirection: "row", alignItems: "center", gap: 14 },
  scoreBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreBtnText: { color: colors.accent, fontSize: 24, fontWeight: "700" },
  scoreVal: { color: colors.text, fontSize: 22, fontWeight: "800", minWidth: 34, textAlign: "center" },
  scoreHint: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm },

  lbHead: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  lbRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  lbCell: { color: colors.textMuted, fontSize: 14 },
  lbPos: { width: 26 },
  lbNum: { width: 56, textAlign: "right" },
  lbName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  lbHcp: { color: colors.textFaint, fontSize: 12 },
  lbMuted: { color: colors.textFaint },
  lbScore: { color: colors.accent, fontWeight: "800", fontSize: 16 },

  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  codeBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  codeBadgeText: { color: "#062012", fontWeight: "800", letterSpacing: 2 },
  localBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  localBadgeText: { color: colors.textFaint, fontSize: 12, fontWeight: "600" },
  errorText: { color: colors.negative, fontSize: 15, lineHeight: 22 },

  codeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  codeLabel: { color: colors.textFaint, fontSize: 12, letterSpacing: 2 },
  codeBig: { color: colors.accent, fontSize: 34, fontWeight: "800", letterSpacing: 4 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.positive },
  liveLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  youTag: { color: colors.accent, fontSize: 13, fontWeight: "700" },
});
