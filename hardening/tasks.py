from celery import Celery
app = Celery()
app.config_from_object("celeryconfig")
@app.task
def my_task(x):
    try:
        # task code here
        return x * 2
    except Exception as e:
        raise self.retry(exc=e, countdown=5)
