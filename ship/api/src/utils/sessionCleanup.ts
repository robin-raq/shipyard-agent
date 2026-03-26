import pg from "pg";

/**
 * Clean up expired sessions from the database
 */
export async function cleanupExpiredSessions(pool: pg.Pool): Promise<number> {
  try {
    const result = await pool.query(
      "DELETE FROM sessions WHERE expires_at < NOW()"
    );
    const deletedCount = result.rowCount || 0;
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired session(s)`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up expired sessions:", error);
    return 0;
  }
}

/**
 * Start periodic cleanup of expired sessions
 * @param pool Database connection pool
 * @param intervalMinutes Cleanup interval in minutes (default: 60)
 */
export function startSessionCleanup(
  pool: pg.Pool,
  intervalMinutes: number = 60
): NodeJS.Timeout {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Run cleanup immediately
  cleanupExpiredSessions(pool);
  
  // Schedule periodic cleanup
  const interval = setInterval(() => {
    cleanupExpiredSessions(pool);
  }, intervalMs);
  
  console.log(`Session cleanup scheduled every ${intervalMinutes} minutes`);
  
  return interval;
}
