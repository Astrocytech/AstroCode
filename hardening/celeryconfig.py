CELERY_BROKER_URL = "amqp://guest@localhost/"
CELERY_RESULT_BACKEND = "rpc://" + CELERY_BROKER_URL.split("://")[-1]
