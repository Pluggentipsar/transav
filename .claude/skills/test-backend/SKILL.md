---
name: test-backend
description: Kor backend-tester med pytest, lint med ruff, och typkontroll med mypy
disable-model-invocation: true
allowed-tools: Bash, Read
---

Kor backend-kvalitetskontroller:

1. Aktivera venv:
   ```bash
   cd backend && .venv/Scripts/activate
   ```

2. Kor tester:
   ```bash
   pytest -v
   ```

3. Kor linting:
   ```bash
   ruff check app/
   ```

4. Kor typkontroll:
   ```bash
   mypy app/
   ```

5. Sammanfatta resultat: antal tester som passerade/failade, eventuella lint-/typfel.
   Om nagot failar, foreslå fixar.
