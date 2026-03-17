
import logging.config

def setup_logging():
    logging.config.dictConfig({
        'version': 1,
        'formatters': {
            'verbose': {
                'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': 'DEBUG',
                'formatter': 'verbose'
            },
            'file': {
                'class': 'logging.FileHandler',
                'filename': '/home/njonji/Desktop/ASTROCYTECH/AstroCode/hardening/app.log',
                'level': 'INFO',
                'formatter': 'verbose'
            }
        },
        'root': {
            'level': 'DEBUG',
            'handlers': ['console', 'file']
        }
    })

def get_logger(name):
    return logging.getLogger(name)

# Example usage
logger = get_logger(__name__)
logger.info('This is an info message')
