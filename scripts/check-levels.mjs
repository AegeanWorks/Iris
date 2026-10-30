import { applySolution, traceGame, validateLevel } from "../src/game/engine.js";
import { LEVELS } from "../src/game/levels.js";
import { solutionMoves, solveLevel } from "../src/game/solver.js";

let failed = false;

for (const level of LEVELS) {
  validateLevel(level);
  const stored = applySolution(level);
  const storedTrace = traceGame(stored);
  const solved = solveLevel(level);
  const storedMoves = solutionMoves(level);
  const parMatches = solved.par === level.par;
  const storedWins = storedTrace.solved;
  const storedOptimal = storedMoves === solved.par;
  if (!parMatches || !storedWins || !storedOptimal) {
    failed = true;
  }
  console.log(
    [
      level.id.padEnd(18),
      `mirrors=${String(solved.mirrors).padStart(2)}`,
      `par=${String(level.par).padStart(2)}`,
      `solver=${String(solved.par).padStart(4)}`,
      `stored=${String(storedMoves).padStart(2)}`,
      `wins=${storedWins}`,
      parMatches && storedWins && storedOptimal ? "OK" : "FAIL",
    ].join(" "),
  );
  if (!parMatches || !storedWins || !storedOptimal) {
    console.log("  stored solution:", JSON.stringify(level.solution));
    console.log("  solver solution:", JSON.stringify(solved.states));
    console.log("  receivers:", storedTrace.receivers.map((receiver) => ({
      at: `${receiver.x},${receiver.y}`,
      target: receiver.target,
      colors: receiver.colors,
      charged: receiver.charged,
    })));
  }
}

if (failed) {
  process.exitCode = 1;
}
