from celery import Celery
app = Celery('tasks', broker='amqp://guest@localhost//')
@app.task(bind=True, default_retry_delay=300, max_retries=5)
def my_task(self, x, y):
    try:
        result = x + y
        return result
    except Exception as exc:
        self.retry(exc=exc)
