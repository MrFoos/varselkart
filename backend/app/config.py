from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    met_user_agent: str = "varselkart/1.0 gardenhagen@gmail.com"

    datex_username: str = ""
    datex_password: str = ""

    avinor_api_key: str = ""

    ntfy_token: str = ""
    ntfy_base_url: str = "https://ntfy.varselkart.no"

    database_path: str = "./varselkart.db"

    app_env: str = "development"
    app_port: int = 8000

    # Poll-intervaller i sekunder
    poll_interval_met: int = 600        # 10 min
    poll_interval_nve_snoskred: int = 3600  # 60 min
    poll_interval_nve_flom: int = 1800  # 30 min
    poll_interval_nve_jordskred: int = 1800
    poll_interval_vegvesen: int = 300   # 5 min
    poll_interval_avinor: int = 600     # 10 min


settings = Settings()
