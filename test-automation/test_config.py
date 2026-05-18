#!/usr/bin/env python3
"""Shared configuration for the Fear & Hunger automation harness."""

import os
from pathlib import Path


DEFAULT_GAME_DIR = "~/Development/Fear And Hunger modding/Fear & Hunger V1.4.1"


def env_path(name, default):
    return Path(os.path.expanduser(os.environ.get(name, default))).resolve()


def env_str(name, default):
    return os.environ.get(name, default)


GAME_DIR = env_path("FH_GAME_DIR", DEFAULT_GAME_DIR)
NW_BINARY = env_path("FH_NW_BINARY", str(GAME_DIR / "nw"))
LOG_DIR = env_path("FH_AI_LOG_DIR", str(GAME_DIR / "ai_companion_logs"))
REPORTS_DIR = env_path("FH_TEST_REPORTS_DIR", str(Path(__file__).parent / "reports"))

CDP_PORT = int(env_str("FH_CDP_PORT", "9222"))
CDP_WS_TIMEOUT = int(env_str("FH_CDP_WS_TIMEOUT", "30"))

LM_STUDIO_BASE_URL = env_str("FH_LMSTUDIO_BASE_URL", "http://127.0.0.1:1234/v1").rstrip("/")
LM_STUDIO_CHAT_URL = env_str("FH_LMSTUDIO_CHAT_URL", LM_STUDIO_BASE_URL + "/chat/completions")
LM_STUDIO_MODELS_URL = env_str("FH_LMSTUDIO_MODELS_URL", LM_STUDIO_BASE_URL + "/models")
VISION_MODEL = env_str("FH_VISION_MODEL", "gemma-4-e4b-uncensored-hauhaucs-aggressive")
EMBEDDING_MODEL = env_str("FH_EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")
