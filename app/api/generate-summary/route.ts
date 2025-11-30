import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { documentTitle, documentContent, documentDescription } = await request.json()

    if (!documentTitle || !documentContent) {
      return Response.json({ error: "Document title and content are required" }, { status: 400 })
    }

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Please provide a concise and informative summary of the following document:

Title: ${documentTitle}
Description: ${documentDescription || "No description provided"}

Content:
${documentContent}

Generate a summary that:
1. Captures the main points and key insights
2. Highlights important findings or conclusions
3. Is 2-3 paragraphs long
4. Uses clear, professional language`,
    })

    return Response.json({ summary: text })
  } catch (error) {
    console.error("Error generating summary:", error)
    return Response.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
