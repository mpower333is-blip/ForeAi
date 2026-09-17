import SwiftUI

struct ContentView: View {
    @StateObject private var model = RoundModel()

    var body: some View {
        Group {
            if model.loading {
                VStack(spacing: 8) {
                    ProgressView()
                    Text("Loading event…").font(.footnote).foregroundColor(.secondary)
                }
            } else if let err = model.error {
                VStack(spacing: 10) {
                    Text("⚠️").font(.title2)
                    Text(err).font(.footnote).multilineTextAlignment(.center)
                    Button("Retry") { model.retry() }.tint(.green)
                }.padding()
            } else if model.myPlayerId == nil {
                PlayerPicker(model: model)
            } else {
                RoundView(model: model)
            }
        }
    }
}

// Pick which player on the card this watch is (once; remembered after).
struct PlayerPicker: View {
    @ObservedObject var model: RoundModel

    var body: some View {
        List {
            Section(header: Text(model.event?.name ?? "Golf Day")) {
                ForEach(model.event?.players ?? []) { p in
                    Button(p.name.isEmpty ? "Player" : p.name) { model.choosePlayer(p.id) }
                }
            }
        }
    }
}

// The round screen: rangefinder + hole nav + score entry.
struct RoundView: View {
    @ObservedObject var model: RoundModel
    @State private var pending: Int?

    private var d: FMB { model.distances }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Hole header + nav
                HStack {
                    Button { model.prevHole(); pending = nil } label: { Image(systemName: "chevron.left") }
                        .buttonStyle(.plain).disabled(model.viewingHole <= 1)
                    Spacer()
                    VStack(spacing: 0) {
                        Text("HOLE \(model.viewingHole)").font(.caption2).foregroundColor(.secondary)
                        Text("Par \(model.hole.par) · \(model.hole.meters)m").font(.footnote)
                    }
                    Spacer()
                    Button { model.nextHole(); pending = nil } label: { Image(systemName: "chevron.right") }
                        .buttonStyle(.plain).disabled(model.viewingHole >= model.course.holes.count)
                }

                // Rangefinder — big MIDDLE metres to the green
                VStack(spacing: 2) {
                    if let mid = d.middle {
                        Text("\(mid)").font(.system(size: 46, weight: .bold, design: .rounded)).foregroundColor(.green)
                        Text("m to green").font(.caption2).foregroundColor(.secondary)
                        HStack(spacing: 14) {
                            fmb("F", d.front)
                            fmb("B", d.back)
                        }.padding(.top, 2)
                    } else if model.location.current == nil {
                        Text("Locating…").font(.footnote).foregroundColor(.secondary)
                        Text("\(model.hole.meters)m").font(.title3)
                    } else {
                        Text("\(model.hole.meters)m").font(.system(size: 40, weight: .bold, design: .rounded))
                        Text("hole length").font(.caption2).foregroundColor(.secondary)
                    }
                }

                Divider()

                // Score entry
                VStack(spacing: 6) {
                    Text("YOUR SCORE").font(.caption2).foregroundColor(.secondary)
                    let shown = pending ?? model.myScore ?? model.hole.par
                    HStack(spacing: 18) {
                        Button { pending = max(1, shown - 1) } label: { Image(systemName: "minus.circle.fill") }
                            .buttonStyle(.plain).font(.title2)
                        Text("\(shown)").font(.system(size: 34, weight: .bold, design: .rounded)).frame(minWidth: 40)
                        Button { pending = min(15, shown + 1) } label: { Image(systemName: "plus.circle.fill") }
                            .buttonStyle(.plain).font(.title2)
                    }
                    Button {
                        model.setScore(pending ?? model.myScore ?? model.hole.par)
                        pending = nil
                    } label: {
                        Text(model.busy ? "Saving…" : (model.myScore == nil ? "Save score" : "Update score"))
                            .frame(maxWidth: .infinity)
                    }
                    .tint(.green)
                    .disabled(model.busy)
                    Text("Thru \(model.thru)").font(.caption2).foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 6)
        }
    }

    private func fmb(_ label: String, _ v: Int?) -> some View {
        HStack(spacing: 3) {
            Text(label).font(.caption2).foregroundColor(.secondary)
            Text(v != nil ? "\(v!)" : "–").font(.footnote).fontWeight(.semibold)
        }
    }
}
