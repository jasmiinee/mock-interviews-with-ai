export default async function handler(req, res) {
  let tempMessages = [];
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.length < 1) {
    tempMessages.push({
      role: "assistant",
      content: "Please set your GROQ_API_KEY in the .env file.",
    });
  }

  res.status(200).json({ messages: tempMessages });
}
