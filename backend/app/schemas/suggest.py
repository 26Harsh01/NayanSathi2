from typing import Literal
from pydantic import BaseModel, Field


class SuggestRequest(BaseModel):
    words: list[str] = Field(default_factory=list, max_length=15)
    currentSentence: str = Field(default="", max_length=300)
    language: Literal["en", "hi"] = "en"
    contextCategory: str = Field(default="general", max_length=60)


class SuggestResponse(BaseModel):
    source: Literal["gemini", "offline"]
    language: Literal["en", "hi"]
    suggestions: list[str]
