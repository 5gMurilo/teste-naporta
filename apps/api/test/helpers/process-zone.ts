/**
 * Time-zone proofs run in whatever zone the Node process was started in (`TZ=... jest`): changing
 * `process.env.TZ` inside a Jest ESM sandbox does not switch the zone, so the scripts launch one
 * process per zone instead. This guard makes a run fail if the requested zone was not applied.
 */
export function assertRequestedZoneApplied(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const requested = process.env.TZ;
  if (requested && zone !== requested) {
    throw new Error(`TZ=${requested} was requested but the process runs in ${zone}`);
  }
  return zone;
}
