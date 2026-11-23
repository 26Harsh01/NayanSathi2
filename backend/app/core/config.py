import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "NayanSathi GazeConnect API"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
    ALLOWED_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]


settings = Settings()
