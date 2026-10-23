import { createAnalysis, BODY_SEED, zoneOf, corridorFor } from "/home/claude/velocity/src/lib/analysis";
import { ACTIVITIES, WEEKS, PHASES, activityLoad, plannedLoad, weekLoad, rollingCompliance, weekStatus, currentWeek, intensityOf, sportOf } from "/home/claude/velocity/src/lib/data";
import { DEFAULT_ATHLETE } from "/home/claude/velocity/src/lib/athlete";
import { workoutFor, targetFor } from "/home/claude/velocity/src/lib/workout";
import { generatePlan } from "/home/claude/velocity/src/lib/plan/generate";
import { RULES } from "/home/claude/velocity/src/lib/plan/rules";
import { targetsFor, sessionFuel, bmrOf, sessionKcal, dayTypeOf, projectWeight } from "/home/claude/velocity/src/lib/nutrition/targets";
(globalThis as any).V = { createAnalysis, BODY_SEED, zoneOf, corridorFor, ACTIVITIES, WEEKS, PHASES, activityLoad, plannedLoad, weekLoad, rollingCompliance, weekStatus, currentWeek, intensityOf, sportOf, DEFAULT_ATHLETE, workoutFor, targetFor, generatePlan, RULES, targetsFor, sessionFuel, bmrOf, sessionKcal, dayTypeOf, projectWeight };
