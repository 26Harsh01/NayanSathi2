from fastapi import APIRouter, HTTPException
from app.core.config import settings
from app.schemas.suggest import SuggestRequest, SuggestResponse
from app.services.gemini_service import generate_gemini_suggestions

router = APIRouter()


@router.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "nayansathi-gazeconnect-fastapi",
        "geminiConfigured": bool(settings.GEMINI_API_KEY),
    }


@router.post("/api/gemini/suggest", response_model=SuggestResponse)
def suggest_sentences(payload: SuggestRequest):
    clean_words = [w.strip()[:80] for w in payload.words if w.strip()]
    clean_sentence = payload.currentSentence.strip()

    if not clean_words and not clean_sentence:
        raise HTTPException(
            status_code=400,
            detail="Provide selected words or a partial sentence.",
        )

    try:
        suggestions = generate_gemini_suggestions(
            words=clean_words,
            current_sentence=clean_sentence,
            language=payload.language,
            context_category=payload.contextCategory,
        )
        return SuggestResponse(
            source="gemini",
            language=payload.language,
            suggestions=suggestions,
        )
    except RuntimeError as exc:
        if str(exc) == "GEMINI_NOT_CONFIGURED":
            raise HTTPException(
                status_code=503,
                detail="Gemini API key is not configured on the server.",
            ) from exc
        raise HTTPException(status_code=502, detail="Upstream Gemini error.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Upstream Gemini error.") from exc
