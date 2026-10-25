# DIY Bluetooth swing sensor for ForeAi

A small sensor that clips to the club, measures swing speed/tempo, and streams it to
ForeAi over Bluetooth — the only *cleanly linkable* path to real swing numbers (every
commercial sensor uses a closed protocol). We own the protocol, so ForeAi reads it
directly.

## 1. Buy the RIGHT board

**Seeed Studio XIAO nRF52840 *Sense*** — ~R342 (RS South Africa) / ~$19.
- ✅ Get the **Sense** variant: it has the built-in **6-axis IMU (LSM6DS3TR-C)** + BLE.
- ❌ NOT the plain "XIAO nRF52840" (~R193): **no IMU** — can't sense a swing.

### Parts list
| Part | ~Cost | Notes |
|---|---|---|
| XIAO nRF52840 **Sense** | R342 | MCU + 6-axis IMU + BLE 5 + USB-C charging, ~21×17 mm |
| LiPo battery, 3.7 V 100–250 mAh, JST | R40–80 | the XIAO has an onboard charger; keep it small/light |
| USB-C cable | — | flashing + charging |
| Mount | R0–150 | 3D-printed shaft clip OR a velcro strap; see §5 |
| (optional) ADXL375 ±200 g accel | R120 | only if we later want true impact-g; not needed for v1 |

Total for a first prototype: **~R450–600** (~$25–33).

## 2. How it works

The IMU on the club measures **angular velocity (gyro)** and acceleration. At the bottom
of the swing the shaft rotates fast; peak gyro correlates with club-head speed. Firmware
detects the swing, computes peak speed + tempo, and notifies ForeAi over BLE. No ball
needed — it's a swing sensor, not a ball tracker.

## 3. Firmware (Arduino, Seeed nRF52 board package)

- Board package: *Seeed nRF52 Boards*; IMU library: **Seeed_Arduino_LSM6DS3 v2.0.4**.
- Sample the IMU at its max ODR (gyro ±2000 °/s, accel ±16 g); buffer ~1 s.
- **Swing detect:** idle → takeaway (gyro rises) → impact (peak |gyro|) → finish.
  Reuse the shape of the app's existing `swingDetector.ts` logic.
- **Metrics:** peak gyro (°/s), est. club-head speed (calibrated map from peak gyro),
  back/down-swing times → tempo ratio.
- **Power/battery:** advertise only; `wake-on-motion` to sleep between swings (a XIAO
  IMU-BLE reference project already does state-machine sleep/idle/active).
- **Caveat — gyro clipping:** the built-in gyro maxes at ±2000 °/s. A fast driver swing
  can exceed that at the club head, so **mount near the grip** (lower angular velocity)
  and/or fit the shaft speed from the sub-peak slope. If clipping is a problem, add a
  wider-range IMU later (e.g. ICM-42688, ±4000 °/s).

## 4. Bluetooth (GATT) protocol — we define it

- **Service UUID:** `f0re-a100-...` (pick a random 128-bit UUID; keep it fixed).
- **Swing characteristic** (Notify): fired once per detected swing, little-endian:
  - `uint32 seq` — swing counter
  - `float32 peakGyroDps` — peak angular velocity
  - `float32 estSpeedMph` — estimated club-head speed
  - `float32 tempoRatio` — back:down
  - `uint8 quality` — 0–100 (balance/clean-strike proxy)
- **Battery:** standard Battery Service (0x180F) so ForeAi shows charge.

## 5. Mounting & safety

- Clip to the **shaft just below the grip** (lower g + angular velocity = less clip,
  safer, survivable). A snug velcro strap is fine for a prototype.
- Must not come loose mid-swing — swings pull real g. Tether/retain it.
- Pot/encase the board + battery; the USB-C port stays accessible for charging.

## 6. ForeAi integration

- Add **`react-native-ble-plx`** (config plugin + dev-client build — Codemagic already
  does dev-client/prebuild for expo-iap, so no new pipeline blocker; add R8 keep-rules).
- New `src/services/swingSensor.ts`: scan → connect to our service UUID → subscribe to
  the swing characteristic → emit `{ speedMph, tempo, quality }`.
- Feed that as the **"power" input** of the indoor simulator engine (`indoorSim.ts`):
  `estSpeedMph` → carry (via the player's learned club carry + a speed-to-carry map),
  `quality`/tempo → dispersion. Same engine the camera path uses — the sensor is just a
  better input than the camera for speed.

## 7. Accuracy — honest expectations

- Good: **relative** swing speed, tempo, consistency — far better than camera or
  phone-in-pocket for speed, because the sensor is ON the club.
- Estimated (not measured): true carry (no ball), face angle, spin, draw/fade.
- Needs a one-time **calibration** of peak-gyro → club-head speed (ideally against a
  cheap launch monitor or known carries) to make the mph believable.

## 8. Prototype plan

1. Buy the Sense board + a small LiPo.
2. Flash a test sketch that streams raw IMU over BLE; verify in a BLE scanner app.
3. Add swing-detect + the GATT characteristic above.
4. Build the ForeAi BLE service + wire it to `indoorSim.ts`.
5. Calibrate the speed map; mount + durability test.
