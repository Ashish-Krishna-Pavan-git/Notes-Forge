"""
Route contract map for backend APIs.

Runtime route registration currently lives in app.main.
"""

API_ROUTES = {
    "health": "/api/health",
    "parser_health": "/api/health/parser",
    "version": "/api/version",
    "analyze": "/api/analyze",
    "preview": "/api/preview",
    "generate": "/api/generate",
    "download": "/api/download/{file_id}",
    "templates": "/api/templates",
    "templates_regenerate": "/api/templates/regenerate",
    "config": "/api/config",
    "config_update": "/api/config/update",
    "themes": "/api/themes",
    "themes_apply": "/api/themes/apply",
    "themes_save": "/api/themes/save",
    "themes_delete": "/api/themes/delete",
    "prompt": "/api/prompt",
}
