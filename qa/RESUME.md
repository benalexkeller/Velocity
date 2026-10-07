# Resume note (read after BRIEF.md)

Your earlier run was cut off by a usage limit before you wrote your report. Your working folder `qa/work/<YOUR-ID>/` still holds everything you produced: scripts, their outputs (`*.txt`, `*.log`, `*.md`, `*.json`), and screenshots. The local app is running again at http://localhost:3111 (same seed data; browser state is fresh).

Rules for this run, to stay inside the limit:

1. **Write first.** Within your first few steps, write `qa/findings/<YOUR-ID>.md` in the brief's format with whatever you already know from your logs. Then improve it. A partial report on disk beats a perfect one that never lands.
2. **Do not redo exploration you already did.** Read your own outputs and screenshots (Read tool on the PNGs you need; do not open all of them) and turn them into findings. Only run new scripts for gaps that matter to your lens.
3. Keep tool calls lean: no re-reading whole large files you summarised before; no new full-page screenshot sweeps — `qa/shots/` already has every state at 1440 and 390.
4. Finish by re-saving the final file. Your last message to the orchestrator should be: the path, the number of findings by severity, and your lens score.
