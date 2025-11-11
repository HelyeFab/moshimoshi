/**
 * Bilingual thank you messages for Stripe invoices
 * Featuring Doshi the red panda mascot
 */

export const thankYouMessages = [
  {
    en: "Thank you for learning with Dōshi! Every step forward is progress. 🐾",
    ja: "どうしと一緒に学んでくれてありがとう！一歩一歩が成長です。🐾"
  },
  {
    en: "Arigatō for your trust! Keep going, you're doing great! 🎌",
    ja: "ご信頼ありがとうございます！その調子で頑張って！🎌"
  },
  {
    en: "Thank you! Remember: consistency beats perfection. Ganbatte! 💪",
    ja: "ありがとうございます！継続は力なり。頑張って！💪"
  },
  {
    en: "Dōmo arigatō! Your Japanese journey continues. We're proud of you! 🌸",
    ja: "どうもありがとう！日本語の旅は続きます。あなたを誇りに思います！🌸"
  },
  {
    en: "Thank you for choosing Moshimoshi! Every lesson brings you closer to fluency. 📚",
    ja: "もしもしをお選びいただきありがとうございます！毎回のレッスンで流暢さに近づいています。📚"
  },
  {
    en: "Arigatō gozaimasu! Your dedication inspires us. Keep shining! ✨",
    ja: "ありがとうございます！あなたの努力に感動しています。輝き続けて！✨"
  },
  {
    en: "Thank you! Every kanji learned is a victory. You're amazing! 🏆",
    ja: "ありがとう！学んだ漢字一つ一つが勝利です。素晴らしい！🏆"
  },
  {
    en: "Dōshi says arigatō! Your progress makes us happy. Smile and learn! 😊",
    ja: "どうしからありがとう！あなたの成長が嬉しいです。笑顔で学ぼう！😊"
  }
];

/**
 * Get a random thank you message
 */
export function getRandomThankYouMessage(): string {
  const message = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
  return `${message.en}\n${message.ja}`;
}

/**
 * Get the full invoice footer with thank you message
 */
export function getInvoiceFooter(): string {
  const message = getRandomThankYouMessage();
  return `${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Moshimoshi - Learn Japanese with Dōshi 🐾
Your friendly red panda tutor
https://moshimoshi.app
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

