#!/usr/bin/env node
/**
 * pnpm check [--keep-going]
 * The complete verification of the delivery. Needs Docker (integration and container steps).
 */
import { runSteps, STEPS } from './lib/run-steps.mjs';

const { ok } = await runSteps(STEPS, { keepGoing: process.argv.includes('--keep-going') });
process.exit(ok ? 0 : 1);
