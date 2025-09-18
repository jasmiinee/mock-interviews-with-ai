// This API access point is for parsing the user's job description input and summarizing it

require("dotenv").config({
  path: "./.env",
});

const Groq = require("groq-sdk");

export default async function handler(req, res) {
  let messages = [
    {
      role: "system",
      content:
        "Summarize the following job description. Fit the description into 50 words. Remove any unnecessary characters or words. Remove any mention of locations or compensation.",
    },
    { role: "user", content: req.body.jobDescription },
  ];

  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "GROQ_API_KEY is not set" });
    }

    const groq = new Groq({ apikey: process.env.GROQ_API_KEY });

    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = chatCompletion.choices[0].message.content;

    res.status(200).json({
      summary: summary,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}