from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./cplatform.db"
)

_is_sqlite = DATABASE_URL.startswith("sqlite")
_kwargs = {}
if _is_sqlite:
    _kwargs["connect_args"] = {"check_same_thread": False}
else:
    _kwargs.update({
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10,
    })

engine = create_engine(DATABASE_URL, echo=False, **_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
