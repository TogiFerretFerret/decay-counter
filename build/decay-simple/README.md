# decay — minimal pp counter

A stripped-down variant of the decay pp counter. Same live data (tosu), same
theming/settings, but only the essentials:

- **pp** — current (hero), plus *max curr* and *if fc*
- **SR** + **mods**
- **song** — title, difficulty, mapper
- **100 / 50 / miss / sb**

500 × 118. Drop the folder into your tosu `counters/` directory (or add the zip
in the tosu dashboard). Colors, tagline, and background toggle live from the
tosu settings panel — same knobs as the full counter.

Built from the full counter's JS (unchanged) with a minimal layout, so fixes to
the shared logic carry over on the next build (`dev/build-simple.sh`).
