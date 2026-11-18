/**
 * Nurse Child Monitoring
 *
 * Reuses the shared Midwife/BNS child monitoring workflow.
 * MidwifeChildMonitoring already supports role === "nurse":
 * it checks child_monitoring_access for the signed-in nurse's
 * district and hides records until access is granted.
 *
 * Both roles read and write the same child monitoring tables.
 */
import MidwifeChildMonitoring from "../midwife/MidwifeChildMonitoring";

export default function NurseChildMonitoring() {
  return <MidwifeChildMonitoring />;
}
