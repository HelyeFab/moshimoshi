// Test the new logging system
// Run with: DEBUG=app:* node test-logger.js

// Test debug logger
import { debugLog } from "../src/lib/logger/debug-logger.ts";

console.log("🧪 Testing Debug Logger\n");

// Enable streak logging
process.env.DEBUG = "app:streak,app:pokemon";

// Test different modules
debugLog.streak("Streak updated successfully", { current: 5, longest: 10 });
debugLog.pokemon("Pokemon caught!", { id: 25, name: "Pikachu" });
debugLog.auth("User logged in", { userId: "123" }); // Won't show (not enabled)
debugLog.review("Review completed", { correct: 8, total: 10 });

console.log("\n📊 Current status:");
debugLog.status();

console.log("\n✅ Logger test complete!");
