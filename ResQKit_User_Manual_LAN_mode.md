# LAN mode (dev/demo only)

> Not yet folded into `ResQKit_User_Manual.docx` — that's a binary Word file
> and can't be edited directly by the assistant. This is a standalone note
> until the manual gets a markdown source (see the planned doc conversion
> pass). Fold this section in when that happens.

## What it is

By default, `app/start.ps1` binds the backend (FastAPI, port 8001) and
frontend (Vite, port 5174) to `127.0.0.1` — reachable only from this machine.
That's the safe default and matches the app's "nothing leaves this device"
posture.

**LAN mode** is an explicit opt-in that instead binds both to `0.0.0.0`, so a
phone or tablet on the same Wi-Fi network can reach them. It exists for two
things that genuinely can't be tested from this machine alone:

- The React Native app's camera-based kit scanner and CPR metronome, which
  need a physical phone (see "why physical-device testing" below).
- The ISU dashboard demo, where a tablet/PC loads the web dashboard and a
  phone running the RN app sends it live updates.

## How to use it

```powershell
./app/start.ps1 -Lan
```

The script detects your machine's LAN IP and prints it, e.g.:

```
LAN mode: binding 0.0.0.0. Detected LAN IP: 172.24.1.205 (WiFi)
Backend:  http://172.24.1.205:8001  (OK)
Frontend: http://172.24.1.205:5174  (OK)  <-- open this one in your browser
Mobile app .env should point EXPO_PUBLIC_API_BASE_URL at: http://172.24.1.205:8001
```

If it detects more than one plausible network adapter, it lists the other
candidates too — pick whichever one your phone/tablet actually shares with
this machine (same Wi-Fi network).

For the RN app: set `EXPO_PUBLIC_API_BASE_URL` in `app/mobile/.env` to the
printed backend URL, then restart the Expo dev server so the change is
picked up (`EXPO_PUBLIC_*` vars are inlined at bundle time, not read live).

## What actually changes

- Backend: `--host 0.0.0.0` instead of `127.0.0.1`, and `FRONTEND_URL` is set
  to the LAN address for that run, so CORS accepts requests from the
  dashboard loaded via the LAN IP instead of `127.0.0.1`.
- Frontend (Vite): `--host 0.0.0.0` instead of `127.0.0.1`.
- Without `-Lan`, behavior is unchanged — loopback-only, exactly as before.

## The trade-off, plainly

Turning this on means **any device on the same Wi-Fi network** can reach
these servers for as long as they're running — not just this computer. Still
not internet-exposed (no port forwarding), but it's a real widening of the
"this machine only" guarantee described elsewhere in the app (Settings →
Local backend mode). Use it on trusted networks (home, a private event
Wi-Fi), and prefer the default loopback-only mode otherwise.

## Why physical-device testing (not just LAN mode)

Camera and CPR-metronome behavior can't be judged in this dev environment or
in an emulator/simulator:

- Haptics don't exist in a simulator — there's no vibration motor to fake.
- The simulator/emulator camera feed is synthetic, not a real sensor with
  real autofocus/exposure/lighting.
- Audio and touch timing run through virtualized drivers, which don't
  reproduce the jitter that matters for pacing real chest compressions.

LAN mode is what makes the backend reachable for that physical-device test —
it's a prerequisite, not the test itself.
