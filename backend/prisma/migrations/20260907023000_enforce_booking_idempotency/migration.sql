-- Enforce idempotent booking retries and speed provider overlap checks.
CREATE UNIQUE INDEX "appointments_idempotencyKey_key" ON "appointments"("idempotencyKey");
CREATE INDEX "appointments_providerId_startTime_endTime_idx" ON "appointments"("providerId", "startTime", "endTime");
CREATE INDEX "AuditLog_patientId_timestamp_idx" ON "AuditLog"("patientId", "timestamp");
