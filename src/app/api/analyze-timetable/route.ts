import { generateText, Output } from "ai";
import { z } from "zod";

const timetableSchema = z.object({
  stopName: z
    .string()
    .nullable()
    .describe("The name of the bus stop shown on the display board"),
  stopLabel: z
    .string()
    .nullable()
    .describe("Additional label or location info for the stop"),
  buses: z
    .array(
      z.object({
        lineNumber: z.string().describe("The bus line number (e.g., 1, 2, 5)"),
        destination: z.string().describe("The final destination of the bus"),
        departureTime: z
          .string()
          .describe("The departure time shown (e.g., 5 min, 12:30)"),
        platform: z
          .string()
          .nullable()
          .describe("Platform or stall number if shown"),
      })
    )
    .describe("List of buses shown on the timetable display"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence level of the extraction (0-1)"),
});

export type TimetableAnalysis = z.infer<typeof timetableSchema>;

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    const { output } = await generateText({
      model: "anthropic/claude-sonnet-4.6",
      output: Output.object({
        schema: timetableSchema,
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this bus timetable display board image from TPL (Trasporti Pubblici Luganesi) in Lugano, Switzerland.
              
Extract:
1. The bus stop name (usually shown at the top of the display)
2. Any additional stop label or location info
3. All visible bus departures with:
   - Line number
   - Destination
   - Departure time (could be in minutes like "5 min" or absolute time like "12:30")
   - Platform/stall number if visible

Be precise with the stop name as it will be used to match against a database of stops.
If you cannot read something clearly, use null for that field.
Set confidence based on image quality and how clearly you can read the information.`,
            },
            {
              type: "image",
              image: image,
            },
          ],
        },
      ],
    });

    return Response.json({ analysis: output });
  } catch (error) {
    console.error("Error analyzing timetable:", error);
    return Response.json(
      { error: "Failed to analyze timetable image" },
      { status: 500 }
    );
  }
}
