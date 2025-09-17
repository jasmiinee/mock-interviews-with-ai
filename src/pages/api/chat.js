require("dotenv").config({
  path: "./.env",
});

const Groq = require("groq-sdk");

export default async function handler(req, res) {
  const sessionResponse = {
    transcription: null,
    chatResponse: null,
    messages: null,
  };

  sessionResponse.messages = req.body.messages;

  if (req.body.audio) {
    // speech-to-text handled on frontend
    sessionResponse.transcription = "Audio processing handled on frontend"
  }

  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not set" });
    }
    
    const groq = new Groq({ apikey: process.env.GROQ_API_KEY });

    const chatCompletion = await groq.chat.completions.create({
      messages: sessionResponse.messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiResponse = chatCompletion.choices[0].message.content;

    sessionResponse.messages.push({
      role: "assistant",
      content: aiResponse,
    });

    sessionResponse.chatResponse = chatCompletion.choices;

    res.status(200).json({
      ...sessionResponse,
      textResponse: aiResponse,
    });


  } catch (err) {
    console.log("Error creating chat completion:", err);
    res.status(500).json({ error: err.message });
  }
}
