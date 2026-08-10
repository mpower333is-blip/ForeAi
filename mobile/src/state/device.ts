// A per-launch device identifier used to recognize which tournament player is
// "me" on this phone. In-memory for now (stable while the app is open); a
// future enhancement can persist it via AsyncStorage so "me" survives restarts.
export const DEVICE_ID = `dev_${Math.random().toString(36).slice(2, 10)}`;
