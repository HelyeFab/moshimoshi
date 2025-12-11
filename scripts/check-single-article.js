const admin = require("firebase-admin");
const serviceAccount = require("../moshimoshi-service-account.json");

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const articleId = process.argv[2] || "cbc50c350fdc8899b4419eca717f016a";

async function checkArticle() {
  const doc = await db.collection("news_articles").doc(articleId).get();

  if (doc.exists === false) {
    console.log("Article not found!");
    return;
  }

  const data = doc.data();
  console.log("=== Article:", articleId, "===");
  console.log("Title:", data.title);
  console.log("");
  console.log("Audio Fields:");
  console.log("  nhkAudioUrl:", data.nhkAudioUrl || "NONE");
  console.log("  generatedTitleAudioUrl:", data.generatedTitleAudioUrl || "NONE");
  console.log("  generatedSummaryAudioUrl:", data.generatedSummaryAudioUrl || "NONE");
  console.log("  generatedContentAudioUrl:", data.generatedContentAudioUrl || "NONE");
  console.log("  audioStatus:", data.audioStatus || "NONE");
  console.log("  audioProvider:", data.audioProvider || "NONE");
  console.log("  audioGeneratedAt:", data.audioGeneratedAt ? data.audioGeneratedAt.toDate() : "NONE");
}

checkArticle().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
