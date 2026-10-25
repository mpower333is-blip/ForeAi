# Indoor "no-ball" swing tracking — feasibility assessment

Can ForeAi do the Benchmark / "Golf Daddy" thing — a phone camera that watches you
swing (no ball) and reports club speed, carry and draw/fade — on-device? Research
spike, Oct 2026.

## Bottom line

- **A phone CAMERA cannot honestly measure club speed, carry, launch or draw/fade.**
  It's physics: a ~100 mph club head travels ~186 mm *between frames* even at 240 fps,
  and phones can't expose short enough (~1/10,000 s) to avoid smearing it into a blur.
  The exact impact instant — the one that defines club speed and face/path — is the
  least measurable moment on a phone.
- **Off-the-shelf models track the human skeleton, not the club.** Pose (MediaPipe /
  BlazePose / YOLO-pose) gives tempo, swing plane, body sequence, posture, and a
  *relative* hand/arm speed — but nothing tracks a club head. A club-head tracker would
  be a from-scratch ML project (labelled golf-video dataset + custom model + a mat for
  scale), months of work, and still only a rough estimate.
- **Even Benchmark / Golf Daddy isn't camera-only magic.** It reads your body pose in
  3D **plus** a passive *sequined impact mat* (the club flips the sequins white; the
  camera reads that mark). It is explicitly **not** a launch monitor and does not track
  a ball — its distances are AI *predictions*, and independent reviewers (MyGolfSpy and
  others) still call its yardages inconsistent. So the product we'd be copying is itself
  a rough, gamified estimator that needs a physical reference.

## What ForeAi *can* credibly ship (camera-only, honest)

A real upgrade over today's accelerometer coach, at ~medium effort:

1. **Camera swing coach** — real-time on-device body pose for tempo, swing sequence,
   posture and balance (strictly better than the current accelerometer coach).
2. **An "effort / power" index** — from lead-arm / hand peak angular velocity — mapped
   onto the player's **own learned club carries** (reuse `golfEngine.learnDistances` /
   `dispersionWindow` from the My Bag feature). Present it as *"85% effort → ~150 m with
   your 7-iron (± your dispersion)"* — never as mph or launch-monitor data.
3. Shot-shape only as an experimental, low-confidence tag (not a primary claim).

This is essentially what the $100 Benchmark does, presented honestly as estimates.

## Build reality (the plumbing is fine; the accuracy is the wall)

- **Stack fit: good.** ForeAi is already on Expo SDK 57 / RN 0.86.3 with
  worklets + reanimated and config-plugin / dev-client builds on Codemagic — exactly
  what `react-native-vision-camera` v5 + an on-device pose model
  (`react-native-executorch` or `react-native-fast-tflite`) need. The old worklets /
  Expo-Go headaches don't apply here. The Firebase metro flag doesn't interact with CV.
- **Effort:** ~2–4 weeks to wire live on-device pose (mostly CI / Podfile / R8 /
  device-perf shakeout). Turning pose into *trustworthy* club speed/carry/shape is a
  separate, much larger R&D effort (data vs a real launch monitor + model training) and
  is the real schedule driver — open-ended, many months.

## For REAL numbers → hardware (and the linkable option)

Everything accurate uses one of: **Doppler radar** (PRGR ~$200 no-ball club speed,
Garmin R10 ~$400), **photometric high-speed cameras** imaging the ball (Foresight,
Golfzon — thousands of fps), or a **motion sensor on the club** (Phigolf/Blast/Zepp,
9-axis).

- Commercial sensors/monitors are **closed** — no public SDK — so ForeAi can't just
  "link" to them without reverse-engineering their Bluetooth (fragile, often against ToS).
- **DIY Bluetooth club sensor = the only cleanly linkable path.** A tiny
  **Seeed XIAO nRF52840 Sense** (~$15–20, built-in 6-axis IMU + BLE + charging) on the
  club shaft, custom firmware broadcasting swing speed/tempo over a BLE protocol *we own*,
  read by ForeAi via `react-native-ble-plx`. An IMU on the club measures swing speed far
  better than a camera or a phone in your pocket. ~$20–30 parts; real firmware + a mount
  that survives high-g swings + a ForeAi BLE module.

## Recommendation

Two complementary moves, and one thing to drop:

- **Ship** the honest **camera swing-coach + effort→your-distances** indoor mode (no
  hardware, achievable, genuinely useful, labelled as estimates).
- **Prototype** the **DIY BLE club sensor** for real swing-speed that links cleanly to
  ForeAi — the one route to trustworthy, "linkable" numbers.
- **Don't** chase camera-measured club speed / draw-fade on a phone — the physics
  doesn't allow it, and even the product we're copying doesn't really do it.

## Sources
Benchmark/Golf Daddy product + reviews (benchmarkgolf.com, golfdaddy.com, MyGolfSpy);
react-native-vision-camera v5, react-native-executorch (Software Mansion),
react-native-fast-tflite; MediaPipe / ML Kit pose; Seeed XIAO nRF52840 Sense;
Blast Golf / GolfSense / Zepp; PRGR / Garmin R10. (Full research in the session log.)
