#!/usr/bin/env node

/**
 * Direct Firebase fix for duplicate/nested streak data
 * Uses service account to fix the data structure
 */

const admin = require("firebase-admin");
const serviceAccount = require("../moshimoshi-service-account.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixStreakData() {
  const userId = "r7r6at83BUPIjD69XatI4EGIECr1";

  console.log("=== FIXING STREAK DATA IN FIREBASE ===\n");
  console.log("User ID:", userId);

  try {
    // Reference to the activities document
    const activitiesRef = db
      .collection("users")
      .doc(userId)
      .collection("achievements")
      .doc("activities");

    // Get current data
    console.log("1. Fetching current data...");
    const doc = await activitiesRef.get();

    if (!doc.exists) {
      console.log("❌ No activities document found!");
      return;
    }

    const currentData = doc.data();
    console.log("\n2. Current data structure:");
    console.log(JSON.stringify(currentData, null, 2));

    // Extract dates (clean, only date entries)
    const dates = {};
    if (currentData.dates && typeof currentData.dates === "object") {
      Object.keys(currentData.dates).forEach((key) => {
        // Only keep actual date entries (YYYY-MM-DD format)
        if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dates[key] = true;
        }
      });
    }

    console.log("\n3. Found activity dates:", Object.keys(dates));

    // Calculate correct streak from dates
    const sortedDates = Object.keys(dates).sort().reverse();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let expectedDate = new Date(today);

    for (const dateStr of sortedDates) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) {
        // This date matches expected (today or consecutive previous day)
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else if (streak === 0 && daysDiff === 1) {
        // Yesterday - streak is still active even if today not done yet
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 2);
      } else {
        // Gap found, stop counting
        break;
      }
    }

    console.log("\n4. Calculated streak:", streak);

    // Create the correct data structure (flat, not nested)
    const fixedData = {
      dates: dates,
      currentStreak: streak,
      bestStreak: Math.max(streak, currentData.bestStreak || 0, 2), // Keep at least 2 as shown in Firebase
      lastActivity: currentData.lastActivity || Date.now(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log("\n5. Fixed data structure:");
    console.log(JSON.stringify(fixedData, null, 2));

    // Update Firebase with the corrected structure
    console.log("\n6. Updating Firebase...");
    await activitiesRef.set(fixedData);

    console.log("\n✅ SUCCESS! Streak data has been fixed!");
    console.log("   Current Streak:", fixedData.currentStreak);
    console.log("   Best Streak:", fixedData.bestStreak);
    console.log("   Active Dates:", Object.keys(fixedData.dates).join(", "));

    // Verify the fix
    console.log("\n7. Verifying the fix...");
    const verifyDoc = await activitiesRef.get();
    const verifyData = verifyDoc.data();

    if (verifyData.currentStreak === fixedData.currentStreak) {
      console.log("✅ Verification successful! Data is correctly saved.");
    } else {
      console.log("⚠️  Verification shows different data:", verifyData);
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error);
  } finally {
    console.log("\n=== DONE ===");
    process.exit(0);
  }
}

// Run the fix
fixStreakData();
