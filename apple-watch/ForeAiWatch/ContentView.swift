import SwiftUI

// Brand palette (navy + gold), matching the club crest used across the app + portal.
private let navy = Color(red: 8 / 255, green: 18 / 255, blue: 38 / 255)
private let navy2 = Color(red: 18 / 255, green: 44 / 255, blue: 88 / 255)
private let gold = Color(red: 243 / 255, green: 195 / 255, blue: 59 / 255)
private let goldSoft = Color(red: 1.0, green: 211 / 255, blue: 106 / 255)

struct ContentView: View {
    @StateObject private var vm = RoundViewModel()
    @StateObject private var location = LocationProvider()
    @State private var showClubs = false
    @State private var showTees = false

    var body: some View {
        Group {
            if vm.showLightning, let l = vm.lightning {
                // Lightning safety takes over the whole screen and buzzes the wrist.
                LightningAlarmView(lightning: l) { vm.dismissLightning() }
            } else {
                RoundView(vm: vm, currentLoc: location.current, accuracyM: location.accuracyM,
                          onPickClub: { showClubs = true },
                          onTees: vm.hasStatus ? { showTees = true } : nil)
            }
        }
        .onAppear {
            location.start()
            vm.startPolling()
        }
        .sheet(isPresented: $showClubs) {
            ClubPickerView(selected: vm.selectedClub) { vm.selectClub($0); showClubs = false }
        }
        .sheet(isPresented: $showTees) {
            TeeTimesView(tees: vm.teeTimes) { showTees = false }
        }
    }
}

// MARK: - Round (rangefinder)

private struct RoundView: View {
    @ObservedObject var vm: RoundViewModel
    let currentLoc: LatLng?
    let accuracyM: Double?
    let onPickClub: () -> Void
    let onTees: (() -> Void)?

    var body: some View {
        let h = vm.holeInfo()
        let d = vm.distances(from: currentLoc)

        ScrollView {
            VStack(spacing: 8) {
                Text("Hole \(vm.viewingHole) · Par \(h.par)")
                    .font(.headline).foregroundColor(gold)

                // Distance headline — GPS to the green, or the hole length until a fix.
                if d.hasGps, let mid = d.mid {
                    Text("\(mid)")
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                } else {
                    Text("\(h.meters)")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }

                Text(subLabel(d))
                    .font(.caption2).foregroundColor(.gray)
                    .multilineTextAlignment(.center)

                if d.hasGps, let f = d.front, let b = d.back {
                    HStack(spacing: 14) {
                        fbCol("Front", f)
                        fbCol("Centre", d.mid ?? 0)
                        fbCol("Back", b)
                    }.padding(.top, 2)
                }
                if let acc = accuracyM {
                    Text("±\(Int(acc))m").font(.system(size: 11)).foregroundColor(.gray)
                }

                // Club selection
                Button(action: onPickClub) {
                    HStack {
                        Text(vm.selectedClub ?? "Pick your club").fontWeight(.semibold)
                        Spacer()
                    }
                }
                .tint(vm.selectedClub != nil ? gold : navy2)
                .padding(.top, 2)

                if let onTees = onTees {
                    Button(action: onTees) {
                        HStack { Text("⛳ Tee times"); Spacer() }
                    }.tint(navy2)
                }

                // Hole navigation
                HStack(spacing: 10) {
                    Button(action: { vm.prevHole() }) { Text("‹").font(.title3) }.tint(navy2)
                    Button(action: { vm.nextHole() }) { Text("›").font(.title3) }.tint(navy2)
                }.padding(.top, 4)
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)
        }
        .background(navy.ignoresSafeArea())
    }

    private func fbCol(_ label: String, _ v: Int) -> some View {
        VStack(spacing: 0) {
            Text(label).font(.system(size: 11)).foregroundColor(.gray)
            Text("\(v)").font(.system(size: 17, weight: .bold)).foregroundColor(.white)
        }
    }

    private func subLabel(_ d: RoundViewModel.Dist) -> String {
        if d.hasGps && d.mid != nil { return "m to green" }
        if d.hasGps { return "m • locating…" }
        return "m to centre • GPS after survey"
    }
}

// MARK: - Club picker

private struct ClubPickerView: View {
    let selected: String?
    let onPick: (String) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("Your club").font(.headline).foregroundColor(gold)
                ForEach(defaultBag, id: \.name) { c in
                    Button(action: { onPick(c.name) }) {
                        HStack {
                            Text(c.name).fontWeight(.semibold)
                            Spacer()
                            Text("~\(c.meters) m").font(.caption).foregroundColor(.gray)
                        }
                    }
                    .tint(c.name == selected ? gold : navy2)
                }
            }
            .padding(.horizontal, 4)
        }
        .background(navy.ignoresSafeArea())
    }
}

// MARK: - Tee times

private struct TeeTimesView: View {
    let tees: [WTee]
    let onBack: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text("Tee times").font(.headline).foregroundColor(gold)
                if tees.isEmpty {
                    Text("No upcoming tee times.")
                        .font(.caption).foregroundColor(.gray)
                        .multilineTextAlignment(.center).padding(.top, 8)
                }
                ForEach(tees) { t in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(t.timeLabel).fontWeight(.bold).foregroundColor(.white)
                            Spacer()
                            Text("\(t.party)").font(.caption).foregroundColor(gold)
                        }
                        Text(t.names.isEmpty ? "\(t.party) players" : t.names.joined(separator: ", "))
                            .font(.caption2).foregroundColor(.gray)
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(navy2).cornerRadius(12)
                }
                Button("‹ Back", action: onBack).tint(navy2).padding(.top, 4)
            }
            .padding(.horizontal, 4)
        }
        .background(navy.ignoresSafeArea())
    }
}

// MARK: - Lightning alarm

private struct LightningAlarmView: View {
    let lightning: WLightning
    let onDismiss: () -> Void

    var body: some View {
        let overhead = lightning.level == "overhead"
        ScrollView {
            VStack(spacing: 8) {
                Text("⚡").font(.system(size: 52))
                Text(overhead ? "LIGHTNING" : "STORM NEAR")
                    .font(.title3).fontWeight(.bold).foregroundColor(goldSoft)
                Text(lightning.body ?? (overhead
                    ? "Take shelter now. Never shelter under trees."
                    : "Thunderstorm approaching — be ready to leave the course."))
                    .font(.caption2)
                    .foregroundColor(Color(red: 1.0, green: 217 / 255, blue: 217 / 255))
                    .multilineTextAlignment(.center)
                Button("I'm safe", action: onDismiss).tint(gold).padding(.top, 4)
            }
            .padding(.horizontal, 6)
            .frame(maxWidth: .infinity)
        }
        .background(Color(red: 42 / 255, green: 10 / 255, blue: 10 / 255).ignoresSafeArea())
    }
}
