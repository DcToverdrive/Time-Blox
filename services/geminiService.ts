import { GoogleGenAI, Type } from "@google/genai";
import { ScheduleItem, ActivityCategory } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scheduleSchema = {
    type: Type.OBJECT,
    properties: {
        schedule: {
            type: Type.ARRAY,
            description: "An array of schedule blocks for the day.",
            items: {
                type: Type.OBJECT,
                properties: {
                    startTime: { type: Type.STRING, description: "The start time of the event in HH:MM AM/PM format (e.g., '09:00 AM')." },
                    endTime: { type: Type.STRING, description: "The end time of the event in HH:MM AM/PM format (e.g., '10:00 AM')." },
                    title: { type: Type.STRING, description: "The title of the task or event." },
                    category: { type: Type.STRING, description: "A category for the task, chosen from the provided list." },
                    color: { type: Type.STRING, description: "The Tailwind CSS background color class associated with the chosen category from the list." },
                    notes: { type: Type.STRING, description: "Optional notes for the task." },
                },
                required: ['startTime', 'endTime', 'title', 'category', 'color'],
            },
        },
    },
    required: ['schedule'],
};

export async function generateSchedule(inputText: string, targetDate: Date, categories: ActivityCategory[]): Promise<ScheduleItem[]> {
    const dateString = targetDate.toDateString();
    const categoriesString = categories.map(c => `${c.name} (use color '${c.color}')`).join(', ');
    
    const prompt = `
        You are TimeBlox, an intelligent daily planner. Your task is to take a user's unordered list of tasks and create a clean, visually ordered schedule for the specified date: ${dateString}, using time-blocking principles.

        **Instructions:**
        1.  Parse the user's input, which includes tasks, durations, optional preferred times, and workday hours.
        2.  Create a coherent, non-overlapping schedule for the given date.
        3.  Intelligently fill empty time slots with appropriate blocks like "Focus Time", "Lunch", "Short Break", or "Planning/Review".
        4.  **Crucially, you must assign a category and its corresponding color for each schedule item from the following list of available categories:** [${categoriesString}]. Do not invent new categories.
        5.  The final output must be a valid JSON object matching the provided schema. Do not output markdown or any other format.

        **User Input:**
        "${inputText}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: scheduleSchema,
            },
        });

        const jsonText = response.text.trim();
        const scheduleData = JSON.parse(jsonText);

        if (scheduleData && Array.isArray(scheduleData.schedule)) {
            return scheduleData.schedule;
        } else {
            throw new Error("Invalid schedule format received from API.");
        }
    } catch (error) {
        console.error("Error generating schedule:", error);
        throw new Error("Failed to generate schedule. The AI might be temporarily unavailable or the input could not be processed.");
    }
}
