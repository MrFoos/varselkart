from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    met_user_agent: str = "varselkart/1.0 (https://varselkart.no)"

    datex_username: str = ""
    datex_password: SecretStr = SecretStr("")

    avinor_api_key: SecretStr = SecretStr("")

    ntfy_token: SecretStr = SecretStr("")
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
