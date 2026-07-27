"""
passenger_wsgi.py — entry point for cPanel / Phusion Passenger (Python).

Why this file exists
--------------------
cPanel's "Setup Python App" runs the app through Passenger, which loads a file
named exactly ``passenger_wsgi.py`` and looks for a callable named
``application``. The error "cannot find module 'servidor'" means Passenger's
startup file / entry point was pointing at a module that does not exist — this
application's code lives in ``server.py`` (module name ``server``), not
``servidor``.

FastAPI is an ASGI framework, but Passenger's Python integration speaks WSGI,
so we wrap the ASGI ``app`` with a2wsgi's ``ASGIMiddleware`` to expose a valid
WSGI ``application``. a2wsgi runs the ASGI app on a single persistent event
loop, which keeps the async MongoDB (motor) client working across requests.

cPanel "Setup Python App" settings
-----------------------------------
- Application root:        the folder that contains THIS file and ``server.py``
                           (e.g. .../backend)
- Application startup file: passenger_wsgi.py
- Application Entry point:  application
- Also add your environment variables (MONGO_URL, DB_NAME, RESEND_API_KEY,
  RESEND_FROM_EMAIL, ADMIN_EMAIL) in the "Environment variables" section, or
  keep them in a ``.env`` file next to server.py (it is loaded automatically).
"""

import os
import sys

# Ensure this directory is importable so `import server` resolves regardless of
# the working directory Passenger launches from.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from a2wsgi import ASGIMiddleware
from server import app as asgi_app

# Passenger looks for a WSGI callable named exactly `application`.
application = ASGIMiddleware(asgi_app)
