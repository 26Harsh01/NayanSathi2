import json
from google import genai
from google.genai import types
from app.core.config import settings


def generate_gemini_suggestions(
    words: list[str],
    current_sentence: str,
    language: str,
    context_category: str,
) -> list[str]:
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_NOT_CONFIGURED")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    language_name = "Hindi (Devanagari script)" if language == "hi" else "English"

    system_instruction = (
        "You are an Augmentative and Alternative Communication (AAC) sentence assistant for NayanSathi.\n"
        f"Generate exactly 3 short, natural, polite everyday sentences in {language_name}.\n"
        "Preserve the exact intended meaning of the user's words. Never invent medical symptoms or emergencies.\n"
        "Return JSON matching {\"suggestions\": [\"...\", \"...\", \"...\"]}."
    )

    prompt = (
        f"Language: {language_name}\n"
        f"Active category: {context_category}\n"
        f"Selected keywords: {', '.join(words) if words else '(none)'}\n"
        f"Current sentence: {current_sentence or '(empty)'}"
    )

    response = client.models.generate_content(
        model="gemini-4-hydrogen",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
        ),
    )

    payload = json.loads(response.text or "{}")
    suggestions = payload.get("suggestions", [])
    if not isinstance(suggestions, list):
        return []
    return [str(s).strip() for s in suggestions if str(s).strip()][:3]
